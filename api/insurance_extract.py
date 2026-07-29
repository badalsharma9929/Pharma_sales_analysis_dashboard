from __future__ import annotations
import io
from typing import Any
from fastapi import HTTPException, UploadFile
from openpyxl import load_workbook
from api.insurance_config import ALIASES, EXTRA, EXPORT_COLUMNS, POLICY_COLUMN
from api.insurance_utils import decrypt, norm, number, parse_date, phone, policy_value, text

async def extract_rows(files: list[UploadFile], password: str, labels: list[str], college: str):
    alias = {key: {norm(item) for item in values + [key]} for key, values in ALIASES.items()}
    extra = {key: {norm(item) for item in values + [key]} for key, values in EXTRA.items()}
    raw_rows, logs = [], []
    source_sequence = 0
    for file_index, upload in enumerate(files):
        raw = await upload.read()
        if len(raw) > 15 * 1024 * 1024:
            raise HTTPException(413, f"{upload.filename} exceeds 15 MB")
        plan = text(labels[file_index]) if file_index < len(labels) else ""
        plan = plan or f"Plan {file_index + 1}"
        try:
            workbook = load_workbook(io.BytesIO(decrypt(raw, password)), read_only=True, data_only=True)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(400, f"Unable to read {upload.filename}: {exc}") from exc
        used = extracted = 0
        for worksheet in workbook.worksheets:
            best = None
            for row_number, row in enumerate(worksheet.iter_rows(min_row=1, max_row=min(15, worksheet.max_row), values_only=True), 1):
                headers = [norm(item) for item in row]
                score = sum(any(header in values for values in alias.values()) or any(header in values for values in extra.values()) for header in headers)
                score += 5 * any(header in alias["Transaction_Date"] for header in headers)
                if best is None or score > best[0]: best = (score, row_number, headers)
            if not best or best[0] < 5: continue
            _, header_row, headers = best
            mapping, dimensions = {}, {}
            for key, values in alias.items():
                for index, header in enumerate(headers):
                    if header in values: mapping[key] = index; break
            for key, values in extra.items():
                for index, header in enumerate(headers):
                    if header in values: dimensions[key] = index; break
            if "Transaction_Date" not in mapping or len(mapping) < 4: continue
            used += 1
            for row in worksheet.iter_rows(min_row=header_row + 1, values_only=True):
                if not any(value not in (None, "") for value in row): continue
                get = lambda idx: row[idx] if idx is not None and idx < len(row) else None
                record = {key: get(mapping.get(key)) for key in EXPORT_COLUMNS + [POLICY_COLUMN]}
                record.update({key: get(index) for key, index in dimensions.items()})
                record.update(_plan=plan, _college=text(college), _file=upload.filename or f"File {file_index + 1}", _sequence=source_sequence)
                raw_rows.append(record); source_sequence += 1; extracted += 1
        logs.append({"file": upload.filename, "plan": plan, "sheets_used": used, "rows_extracted": extracted})
    return raw_rows, logs


def clean_rows(raw_rows: list[dict[str, Any]]):
    rows, exact_seen, ids = [], set(), set()
    invalid = exact_duplicates = id_duplicates = 0
    has_policy = False
    for raw in raw_rows:
        tx_date = parse_date(raw.get("Transaction_Date"))
        if not tx_date: invalid += 1; continue
        tx_id = text(raw.get("transaction_id"))
        if tx_id.endswith(".0") and tx_id[:-2].isdigit(): tx_id = tx_id[:-2]
        policy = policy_value(raw.get(POLICY_COLUMN)); has_policy = has_policy or bool(policy)
        exported = {
            "member_name": text(raw.get("member_name")), "email": text(raw.get("email")).lower(),
            "Care_Email": text(raw.get("Care_Email")).lower(), "contact_number": phone(raw.get("contact_number")),
            "Alternate_Contact": phone(raw.get("Alternate_Contact")), "Transaction_Date": tx_date.isoformat(),
            "transaction_amount": round(number(raw.get("transaction_amount")) or 0, 2), "transaction_id": tx_id,
            POLICY_COLUMN: policy, "passing_year": text(raw.get("passing_year")), "course": text(raw.get("course")),
        }
        exact_key = tuple(exported.values())
        if exact_key in exact_seen: exact_duplicates += 1; continue
        exact_seen.add(exact_key)
        if tx_id and tx_id in ids: id_duplicates += 1; continue
        if tx_id: ids.add(tx_id)
        premium = number(raw.get("premium")) or exported["transaction_amount"]
        sum_insured = number(raw.get("sum_insured"))
        age = None; dob = parse_date(raw.get("dob")); given_age = number(raw.get("age"))
        if dob: age = tx_date.year - dob.year - ((tx_date.month, tx_date.day) < (dob.month, dob.day))
        elif given_age is not None and 0 <= given_age <= 120: age = int(given_age)
        products = []
        for key in ["plan_name", "policy_type", "policy_name"]:
            value = text(raw.get(key))
            if value and value not in products: products.append(value)
        rows.append({
            "export": exported, "sequence": raw["_sequence"], "file": raw["_file"], "plan": raw["_plan"],
            "college": raw["_college"], "date": tx_date, "year": str(tx_date.year), "month_number": tx_date.month,
            "month_label": tx_date.strftime("%b"), "month_period": tx_date.strftime("%b %Y"),
            "amount": exported["transaction_amount"], "premium": round(premium, 2), "sum_insured": sum_insured,
            "age": age, "state": text(raw.get("state")).title(), "city": text(raw.get("city")).title(),
            "pincode": text(raw.get("pincode")), "course": exported["course"], "passing_year": exported["passing_year"],
            "insurance_product": " • ".join(products), "insurer": text(raw.get("insurer")),
            "nominee_relationship": text(raw.get("nominee_relationship")).title(), "policy": policy,
        })
    rows.sort(key=lambda item: item["sequence"])
    return rows, has_policy, {"invalid_dates_removed": invalid, "exact_duplicates_removed": exact_duplicates, "duplicate_transaction_ids_removed": id_duplicates}
