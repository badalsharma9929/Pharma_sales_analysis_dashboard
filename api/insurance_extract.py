from __future__ import annotations

import csv
import io
import re
from typing import Any

from fastapi import HTTPException, UploadFile
from openpyxl import load_workbook

from api.insurance_config import ALIASES, EXTRA, EXPORT_COLUMNS, POLICY_COLUMN
from api.insurance_utils import decrypt, norm, number, parse_date, phone, policy_value, text


def _report_year(value: Any) -> int | None:
    match = re.search(r"(?:19|20)\d{2}", text(value))
    if not match:
        return None
    year = int(match.group(0))
    return year if 1900 <= year <= 2100 else None


def _open_sheets(raw: bytes, filename: str, password: str):
    lower_name = filename.lower()
    if lower_name.endswith(".csv"):
        decoded = None
        for encoding in ("utf-8-sig", "utf-8", "cp1252"):
            try:
                decoded = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if decoded is None:
            raise HTTPException(400, f"Unable to decode {filename} as CSV")
        sample = decoded[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel
        return [list(csv.reader(io.StringIO(decoded), dialect))]

    if lower_name.endswith(".xls"):
        try:
            import xlrd
        except ImportError as exc:
            raise HTTPException(500, "Legacy .xls support is not installed") from exc
        try:
            workbook = xlrd.open_workbook(file_contents=raw)
        except Exception:
            workbook = xlrd.open_workbook(file_contents=decrypt(raw, password))
        return [
            [sheet.row_values(row_number) for row_number in range(sheet.nrows)]
            for sheet in workbook.sheets()
        ]

    workbook = load_workbook(
        io.BytesIO(decrypt(raw, password)),
        read_only=True,
        data_only=True,
    )
    return workbook.worksheets


async def extract_rows(
    files: list[UploadFile],
    password: str,
    labels: list[str],
    college: str,
    file_years: list[str] | None = None,
):
    alias = {key: {norm(item) for item in values + [key]} for key, values in ALIASES.items()}
    extra = {key: {norm(item) for item in values + [key]} for key, values in EXTRA.items()}
    raw_rows, logs = [], []
    source_sequence = 0

    for file_index, upload in enumerate(files):
        raw = await upload.read()
        if len(raw) > 15 * 1024 * 1024:
            raise HTTPException(413, f"{upload.filename} exceeds 15 MB")

        fallback_plan = text(labels[file_index]) if file_index < len(labels) else ""
        fallback_plan = fallback_plan or f"Data Set {file_index + 1}"
        year_override = _report_year(
            file_years[file_index]
            if file_years and file_index < len(file_years)
            else ""
        )

        try:
            worksheets = _open_sheets(raw, upload.filename or "report.xlsx", password)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(400, f"Unable to read {upload.filename}: {exc}") from exc

        used = extracted = 0
        detected_plans: set[str] = set()

        for worksheet in worksheets:
            best = None
            is_materialized = isinstance(worksheet, list)
            preview_rows = (
                worksheet[:15]
                if is_materialized
                else worksheet.iter_rows(
                    min_row=1,
                    max_row=min(15, worksheet.max_row or 15),
                    values_only=True,
                )
            )
            for row_number, row in enumerate(preview_rows, 1):
                headers = [norm(item) for item in row]
                score = sum(
                    any(header in values for values in alias.values())
                    or any(header in values for values in extra.values())
                    for header in headers
                )
                score += 5 * any(header in alias["Transaction_Date"] for header in headers)
                score += 4 * any(header in alias["transaction_amount"] for header in headers)
                if best is None or score > best[0]:
                    best = (score, row_number, headers)

            if not best:
                continue

            _, header_row, headers = best
            mapping, dimensions = {}, {}

            for key, values in alias.items():
                for index, header in enumerate(headers):
                    if header in values:
                        mapping[key] = index
                        break

            for key, values in extra.items():
                for index, header in enumerate(headers):
                    if header in values:
                        dimensions[key] = index
                        break

            # A year-labelled report can still be compared when it has no row-level
            # date column. In that case 1 January of the selected report year is used
            # only as an analysis anchor and is reported in data-quality controls.
            has_date = "Transaction_Date" in mapping
            has_amount = "transaction_amount" in mapping
            minimum_score = 4 if year_override else 5
            if best[0] < minimum_score or not has_amount or (not has_date and not year_override):
                continue

            used += 1
            data_rows = (
                worksheet[header_row:]
                if is_materialized
                else worksheet.iter_rows(min_row=header_row + 1, values_only=True)
            )
            for row in data_rows:
                if not any(value not in (None, "") for value in row):
                    continue

                get = lambda idx: row[idx] if idx is not None and idx < len(row) else None
                record = {key: get(mapping.get(key)) for key in EXPORT_COLUMNS + [POLICY_COLUMN]}
                record.update({key: get(index) for key, index in dimensions.items()})

                detected_plan = text(record.get("plan_name"))
                if detected_plan:
                    detected_plans.add(detected_plan)

                record.update(
                    _fallback_plan=fallback_plan,
                    _college=text(college),
                    _file=upload.filename or f"File {file_index + 1}",
                    _year_override=year_override,
                    _sequence=source_sequence,
                )
                raw_rows.append(record)
                source_sequence += 1
                extracted += 1

        logs.append(
            {
                "file": upload.filename,
                "fallback_label": fallback_plan,
                "detected_plans": sorted(detected_plans),
                "report_year": year_override,
                "sheets_used": used,
                "rows_extracted": extracted,
            }
        )

    return raw_rows, logs


def clean_rows(raw_rows: list[dict[str, Any]]):
    rows, exact_seen, ids = [], set(), set()
    invalid = exact_duplicates = id_duplicates = inferred_dates = year_overrides = 0
    has_policy = False
    canonical_plans: dict[str, str] = {}

    for raw in raw_rows:
        override_year = _report_year(raw.get("_year_override"))
        tx_date = parse_date(raw.get("Transaction_Date"))
        if not tx_date and override_year:
            from datetime import date

            tx_date = date(override_year, 1, 1)
            inferred_dates += 1
        if not tx_date:
            invalid += 1
            continue
        analysis_year = str(override_year or tx_date.year)
        if override_year:
            year_overrides += 1

        tx_id = text(raw.get("transaction_id"))
        if tx_id.endswith(".0") and tx_id[:-2].isdigit():
            tx_id = tx_id[:-2]

        policy = policy_value(raw.get(POLICY_COLUMN))
        has_policy = has_policy or bool(policy)

        exported = {
            "member_name": text(raw.get("member_name")),
            "email": text(raw.get("email")).lower(),
            "Care_Email": text(raw.get("Care_Email")).lower(),
            "contact_number": phone(raw.get("contact_number")),
            "Alternate_Contact": phone(raw.get("Alternate_Contact")),
            "Transaction_Date": tx_date.isoformat(),
            "transaction_amount": round(number(raw.get("transaction_amount")) or 0, 2),
            "transaction_id": tx_id,
            POLICY_COLUMN: policy,
            "passing_year": text(raw.get("passing_year")),
            "course": text(raw.get("course")),
        }

        detected_plan = text(raw.get("plan_name")) or text(raw.get("policy_name"))
        fallback_plan = text(raw.get("_fallback_plan"))
        fallback_key = norm(fallback_plan)
        explicit_common_plan = fallback_plan and fallback_key not in {
            "unspecified_plan",
        } and not fallback_key.startswith("data_set_")
        supplied_plan = (
            fallback_plan
            if explicit_common_plan
            else detected_plan or fallback_plan or "Unspecified Plan"
        )
        plan_key = norm(supplied_plan)
        plan = canonical_plans.setdefault(plan_key, supplied_plan)

        # The plan is part of the exact-duplicate key so identical-looking rows
        # belonging to different plans are not incorrectly removed.
        exact_key = (plan_key, analysis_year, *tuple(exported.values()))
        if exact_key in exact_seen:
            exact_duplicates += 1
            continue
        exact_seen.add(exact_key)

        id_key = (plan_key, analysis_year, tx_id)
        if tx_id and id_key in ids:
            id_duplicates += 1
            continue
        if tx_id:
            ids.add(id_key)

        # Business rule: transaction_amount is the premium amount.
        premium = exported["transaction_amount"]
        sum_insured = number(raw.get("sum_insured"))

        age = None
        dob = parse_date(raw.get("dob"))
        given_age = number(raw.get("age"))
        if dob:
            age = tx_date.year - dob.year - (
                (tx_date.month, tx_date.day) < (dob.month, dob.day)
            )
        elif given_age is not None and 0 <= given_age <= 120:
            age = int(given_age)

        products = []
        for key in ["plan_name", "policy_type", "policy_name"]:
            value = text(raw.get(key))
            if value and value not in products:
                products.append(value)

        rows.append(
            {
                "export": exported,
                "sequence": raw["_sequence"],
                "file": raw["_file"],
                "plan": plan,
                "college": raw["_college"],
                "date": tx_date,
                "year": analysis_year,
                "month_number": tx_date.month,
                "month_label": tx_date.strftime("%b"),
                "month_period": f"{tx_date.strftime('%b')} {analysis_year}",
                "amount": premium,
                "premium": premium,
                "sum_insured": sum_insured,
                "age": age,
                "state": text(raw.get("state")).title(),
                "city": text(raw.get("city")).title(),
                "pincode": text(raw.get("pincode")),
                "course": exported["course"],
                "passing_year": exported["passing_year"],
                "insurance_product": " • ".join(products),
                "insurer": text(raw.get("insurer")),
                "nominee_relationship": text(raw.get("nominee_relationship")).title(),
                "policy": policy,
            }
        )

    # Preserve the original source-file and source-row sequence.
    rows.sort(key=lambda item: item["sequence"])
    return rows, has_policy, {
        "invalid_dates_removed": invalid,
        "exact_duplicates_removed": exact_duplicates,
        "duplicate_transaction_ids_removed": id_duplicates,
        "report_year_overrides_applied": year_overrides,
        "dates_inferred_from_report_year": inferred_dates,
    }
