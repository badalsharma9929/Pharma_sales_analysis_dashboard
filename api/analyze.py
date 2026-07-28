from __future__ import annotations

import io
import math
import re
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any

import msoffcrypto
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from openpyxl import load_workbook

app = FastAPI()

EXPORT_COLUMNS = [
    "member_name", "email", "Care_Email", "contact_number",
    "Alternate_Contact", "Transaction_Date", "transaction_amount",
    "transaction_id", "passing_year", "course",
]
POLICY_COLUMN = "Policy (New/Renewal)"

ALIASES = {
    "member_name": ["member name", "member_name", "membername", "full name", "customer name", "student name", "name"],
    "email": ["email", "email id", "email address", "personal email"],
    "Care_Email": ["care email", "care_email", "care email id", "care email address"],
    "contact_number": ["contact number", "contact_number", "contact no", "mobile number", "mobile no", "phone number", "primary contact"],
    "Alternate_Contact": ["alternate contact", "alternate_contact", "alternate number", "alternate mobile", "alternate contact number", "secondary contact"],
    "Transaction_Date": ["transaction date", "transaction_date", "payment date", "txn date", "date of transaction"],
    "transaction_amount": ["transaction amount", "transaction_amount", "payment amount", "paid amount", "txn amount", "amount", "transaction value"],
    "transaction_id": ["transaction id", "transaction_id", "txn id", "payment id", "reference id", "utr", "receipt number", "transaction reference"],
    POLICY_COLUMN: ["policy new renewal", "policy (new renewal)", "new renewal", "new/renewal", "policy status", "new or renewal"],
    "passing_year": ["passing year", "passing_year", "year of passing", "graduation year", "passout year", "pass out year", "batch", "batch year", "graduation batch", "alumni batch"],
    "course": ["course", "course name", "program", "programme", "program name", "programme name"],
}

EXTRA_ALIASES = {
    "dob": ["dob", "date of birth", "birth date", "member dob"],
    "age": ["age", "member age"],
    "gender": ["gender", "sex"],
    "city": ["city", "town", "member city"],
    "state": ["state", "province", "member state"],
    "country": ["country", "nation"],
    "pincode": ["pincode", "pin code", "postal code", "zip code", "zipcode", "member pincode", "member pin code"],
    "sum_insured": ["sum insured", "sum_insured", "sum assured", "coverage amount", "cover amount"],
    "premium": ["premium inc gst", "premium_inc_gst", "premium including gst", "gross premium", "premium", "total premium"],
    "insurer": ["insurer", "insurance company", "carrier"],
    "plan_name": ["plan name", "plan_name", "insurance plan", "product name"],
    "policy_type": ["policy type", "policy_type", "insurance type"],
    "policy_name": ["policy name", "policy_name"],
    "pay_mode": ["pay mode", "pay_mode", "payment mode"],
    "relationship": ["relationship", "member relationship", "relationship with employee", "member relation"],
    "nominee_relationship": ["nominee relationship", "nominee_relationship", "nominee relation", "nominee_relation", "nominee relationship with insured", "nominee relationship with member", "nominee relation with member", "nominee relation with policy holder", "nominee relation with proposer"],
    "new_existing_member": ["new existing member", "new_existing_member", "new/existing member", "new or existing member", "member status", "member type", "new existing", "new/existing"],
}


def normalize(value: Any) -> str:
    text = "" if value is None else str(value).strip().lower().replace("&", " and ")
    text = re.sub(r"[()\[\]{}\\/\-]+", " ", text)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


def clean_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none", "null", "nat", "n/a", "na"}:
        return ""
    return re.sub(r"\s+", " ", text)


def clean_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return None if isinstance(value, float) and math.isnan(value) else float(value)
    text = clean_text(value)
    if not text:
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = re.sub(r"[^0-9.\-]", "", text.replace(",", ""))
    if text in {"", "-", ".", "-."}:
        return None
    try:
        number = float(text)
        return -number if negative else number
    except ValueError:
        return None


def clean_phone(value: Any) -> str:
    digits = re.sub(r"\D", "", clean_text(value))
    if not digits or set(digits) == {"0"}:
        return ""
    if digits.startswith("0091") and len(digits) >= 14:
        digits = digits[4:]
    elif digits.startswith("91") and len(digits) >= 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    return digits[-10:] if len(digits) > 10 else digits


def clean_identifier(value: Any) -> str:
    text = clean_text(value)
    return text[:-2] if re.fullmatch(r"\d+\.0", text) else text


def clean_pincode(value: Any) -> str:
    digits = re.sub(r"\D", "", clean_identifier(value))
    return "" if not digits or set(digits) == {"0"} else digits


def parse_date(value: Any) -> date | None:
    if value in (None, "", 0, "0", "0.0"):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)) and 1 <= float(value) <= 100000:
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
    text = clean_text(value)
    for fmt in ["%d/%b/%y", "%d/%b/%Y", "%d-%b-%y", "%d-%b-%Y", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y", "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%m-%d-%Y"]:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def normalize_policy(value: Any) -> str:
    value = normalize(value)
    if value in {"new", "n", "new_policy", "new_member"}:
        return "New"
    if value in {"renewal", "renew", "renewed", "r", "policy_renewal"}:
        return "Renewal"
    return ""


def normalize_member_status(value: Any) -> str:
    value = normalize(value)
    if value in {"new", "new_member", "newly_added", "fresh"}:
        return "New Member"
    if value in {"existing", "existing_member", "old", "old_member", "current_member", "already_existing"}:
        return "Existing Member"
    return ""


def decrypt_workbook(raw: bytes, password: str) -> bytes:
    if raw[:2] == b"PK":
        return raw
    try:
        encrypted = msoffcrypto.OfficeFile(io.BytesIO(raw))
        encrypted.load_key(password=password)
        output = io.BytesIO()
        encrypted.decrypt(output)
        return output.getvalue()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not unlock workbook. Check the common password. ({exc})") from exc


def age_band(age: int) -> str:
    if age < 18:
        return "Under 18"
    if age <= 25:
        return "18–25"
    if age <= 35:
        return "26–35"
    if age <= 45:
        return "36–45"
    if age <= 55:
        return "46–55"
    if age <= 65:
        return "56–65"
    return "66+"


def premium_band(value: float) -> str:
    if value < 10000:
        return "Below ₹10,000"
    if value < 25000:
        return "₹10,000–₹24,999"
    if value < 50000:
        return "₹25,000–₹49,999"
    if value < 100000:
        return "₹50,000–₹99,999"
    return "₹100,000+"


def grouped(counts: Counter, totals: defaultdict | None = None, limit: int = 20) -> list[dict[str, Any]]:
    output = []
    for label, count in counts.most_common(limit):
        item = {"label": label, "count": count}
        if totals is not None:
            amount = round(totals[label], 2)
            item.update(amount=amount, average=round(amount / count, 2) if count else 0)
        output.append(item)
    return output


def chronological_group(counts: Counter, totals: defaultdict) -> list[dict[str, Any]]:
    def sort_key(label: str) -> tuple[int, str]:
        match = re.search(r"(19|20)\d{2}", label)
        return (int(match.group()) if match else 9999, label)
    return [{"label": label, "count": counts[label], "amount": round(totals[label], 2), "average": round(totals[label] / counts[label], 2)} for label in sorted(counts, key=sort_key)]


@app.post("/")
async def analyze(files: list[UploadFile] = File(...), password: str = Form("")):
    raw_rows = []
    processing_log = []
    aliases = {key: {normalize(alias) for alias in values + [key]} for key, values in ALIASES.items()}
    extras = {key: {normalize(alias) for alias in values + [key]} for key, values in EXTRA_ALIASES.items()}

    for upload in files:
        raw = await upload.read()
        if len(raw) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"{upload.filename} exceeds the 15 MB file limit.")
        try:
            workbook = load_workbook(io.BytesIO(decrypt_workbook(raw, password)), read_only=True, data_only=True)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unable to read {upload.filename}: {exc}") from exc

        sheets_used = 0
        rows_extracted = 0
        for worksheet in workbook.worksheets:
            best_header = None
            for row_number, row in enumerate(worksheet.iter_rows(min_row=1, max_row=min(15, worksheet.max_row), values_only=True), start=1):
                normalized_headers = [normalize(value) for value in row]
                score = sum(any(header in options for options in aliases.values()) or any(header in options for options in extras.values()) for header in normalized_headers)
                if any(header in aliases["Transaction_Date"] for header in normalized_headers):
                    score += 5
                if best_header is None or score > best_header[0]:
                    best_header = (score, row_number, list(row), normalized_headers)

            if not best_header or best_header[0] < 5:
                continue
            _, header_row, headers, normalized_headers = best_header
            mapping = {}
            dimensions = {}
            for key, options in aliases.items():
                for index, header in enumerate(normalized_headers):
                    if header in options:
                        mapping[key] = index
                        break
            for key, options in extras.items():
                for index, header in enumerate(normalized_headers):
                    if header in options:
                        dimensions[key] = index
                        break
            if "Transaction_Date" not in mapping or len(mapping) < 4:
                continue

            sheets_used += 1
            for row in worksheet.iter_rows(min_row=header_row + 1, values_only=True):
                if not any(value not in (None, "") for value in row):
                    continue
                def get(index: int | None) -> Any:
                    return row[index] if index is not None and index < len(row) else None
                record = {key: get(mapping.get(key)) for key in EXPORT_COLUMNS + [POLICY_COLUMN]}
                record.update({key: get(index) for key, index in dimensions.items()})
                raw_rows.append(record)
                rows_extracted += 1
        processing_log.append({"file": upload.filename, "sheets_used": sheets_used, "rows_extracted": rows_extracted})

    if not raw_rows:
        raise HTTPException(status_code=400, detail="No usable data sheet was found in the uploaded workbook.")

    cleaned_internal = []
    invalid_dates = exact_duplicates = duplicate_ids = 0
    exact_seen = set()
    transaction_ids = set()
    policy_available = False

    for source in raw_rows:
        transaction_date = parse_date(source.get("Transaction_Date"))
        if not transaction_date:
            invalid_dates += 1
            continue
        transaction_id = clean_identifier(source.get("transaction_id"))
        policy = normalize_policy(source.get(POLICY_COLUMN))
        policy_available = policy_available or bool(policy)
        export_row = {
            "member_name": clean_text(source.get("member_name")),
            "email": clean_text(source.get("email")).lower(),
            "Care_Email": clean_text(source.get("Care_Email")).lower(),
            "contact_number": clean_phone(source.get("contact_number")),
            "Alternate_Contact": clean_phone(source.get("Alternate_Contact")),
            "Transaction_Date": transaction_date.isoformat(),
            "transaction_amount": round(clean_number(source.get("transaction_amount")) or 0, 2),
            "transaction_id": transaction_id,
            POLICY_COLUMN: policy,
            "passing_year": clean_identifier(source.get("passing_year")),
            "course": clean_text(source.get("course")),
        }
        exact_key = tuple(export_row.values())
        if exact_key in exact_seen:
            exact_duplicates += 1
            continue
        exact_seen.add(exact_key)
        if transaction_id and transaction_id in transaction_ids:
            duplicate_ids += 1
            continue
        if transaction_id:
            transaction_ids.add(transaction_id)

        premium = clean_number(source.get("premium"))
        if premium in (None, 0):
            premium = export_row["transaction_amount"]
        dob = parse_date(source.get("dob"))
        provided_age = clean_number(source.get("age"))
        age = None
        if dob:
            age = transaction_date.year - dob.year - ((transaction_date.month, transaction_date.day) < (dob.month, dob.day))
        elif provided_age is not None and 0 <= provided_age <= 120:
            age = int(provided_age)
        product_parts = []
        for key in ("plan_name", "policy_type", "policy_name"):
            value = clean_text(source.get(key))
            if value and value not in product_parts:
                product_parts.append(value)
        cleaned_internal.append({
            "export": export_row,
            "date": transaction_date,
            "amount": export_row["transaction_amount"],
            "premium": round(premium or 0, 2),
            "sum_insured": clean_number(source.get("sum_insured")),
            "age": age,
            "state": clean_text(source.get("state")).title(),
            "city": clean_text(source.get("city")).title(),
            "pincode": clean_pincode(source.get("pincode")),
            "country": clean_text(source.get("country")).upper(),
            "course": export_row["course"],
            "passing_year": export_row["passing_year"],
            "insurance_product": " • ".join(product_parts),
            "insurer": clean_text(source.get("insurer")),
            "gender": clean_text(source.get("gender")).title(),
            "relationship": clean_text(source.get("relationship")).title(),
            "nominee_relationship": clean_text(source.get("nominee_relationship")).title(),
            "new_existing_member": normalize_member_status(source.get("new_existing_member")),
            "pay_mode": clean_text(source.get("pay_mode")).title(),
            "policy": policy,
        })

    if not cleaned_internal:
        raise HTTPException(status_code=400, detail="No rows remain after Transaction Date cleaning.")

    export_columns = EXPORT_COLUMNS.copy()
    if policy_available:
        export_columns.insert(8, POLICY_COLUMN)
    cleaned_internal.sort(key=lambda item: (item["date"], item["export"]["member_name"]), reverse=True)
    cleaned_rows = [{column: item["export"].get(column, "") for column in export_columns} for item in cleaned_internal]

    daily = defaultdict(lambda: [0, 0.0, 0.0])
    monthly = defaultdict(lambda: [0, 0.0, 0.0])
    policy_counts = Counter()
    sum_insured_counts, premium_band_counts, age_counts = Counter(), Counter(), Counter()
    state_counts, city_counts, pincode_counts = Counter(), Counter(), Counter()
    course_counts, passing_year_counts = Counter(), Counter()
    product_counts, insurer_counts = Counter(), Counter()
    gender_counts, relationship_counts = Counter(), Counter()
    nominee_counts, member_status_counts, pay_mode_counts = Counter(), Counter(), Counter()
    sum_insured_amount, sum_insured_premium = defaultdict(float), defaultdict(float)
    premium_band_amount, age_amount = defaultdict(float), defaultdict(float)
    state_amount, city_amount, pincode_amount = defaultdict(float), defaultdict(float), defaultdict(float)
    course_amount, passing_year_amount = defaultdict(float), defaultdict(float)
    product_amount, insurer_amount = defaultdict(float), defaultdict(float)
    nominee_amount, member_status_amount = defaultdict(float), defaultdict(float)

    for item in cleaned_internal:
        day_key = item["date"].isoformat()
        month_key = item["date"].strftime("%Y-%m")
        for bucket, key in ((daily, day_key), (monthly, month_key)):
            bucket[key][0] += 1
            bucket[key][1] += item["amount"]
            bucket[key][2] += item["premium"]
        if item["policy"]:
            policy_counts[item["policy"]] += 1
        if item["sum_insured"] and item["sum_insured"] > 0:
            label = f"₹{item['sum_insured']:,.0f}"
            sum_insured_counts[label] += 1
            sum_insured_amount[label] += item["amount"]
            sum_insured_premium[label] += item["premium"]
        if item["premium"] > 0:
            label = premium_band(item["premium"])
            premium_band_counts[label] += 1
            premium_band_amount[label] += item["premium"]
        if item["age"] is not None:
            label = age_band(item["age"])
            age_counts[label] += 1
            age_amount[label] += item["amount"]
        for value, counts, totals in (
            (item["state"], state_counts, state_amount),
            (item["city"], city_counts, city_amount),
            (item["pincode"], pincode_counts, pincode_amount),
            (item["course"], course_counts, course_amount),
            (item["passing_year"], passing_year_counts, passing_year_amount),
            (item["insurance_product"], product_counts, product_amount),
            (item["insurer"], insurer_counts, insurer_amount),
            (item["nominee_relationship"], nominee_counts, nominee_amount),
            (item["new_existing_member"], member_status_counts, member_status_amount),
        ):
            if value:
                counts[value] += 1
                totals[value] += item["amount"]
        if item["gender"]:
            gender_counts[item["gender"]] += 1
        if item["relationship"]:
            relationship_counts[item["relationship"]] += 1
        if item["pay_mode"]:
            pay_mode_counts[item["pay_mode"]] += 1

    daily_rows = [{"label": datetime.strptime(key, "%Y-%m-%d").strftime("%d %b %Y"), "count": values[0], "amount": round(values[1], 2), "premium": round(values[2], 2), "period": key} for key, values in sorted(daily.items())]
    monthly_rows = [{"label": datetime.strptime(key, "%Y-%m").strftime("%b %Y"), "count": values[0], "amount": round(values[1], 2), "premium": round(values[2], 2), "period": key} for key, values in sorted(monthly.items())]
    sum_insured_rows = [{"label": label, "count": count, "amount": round(sum_insured_amount[label], 2), "premium": round(sum_insured_premium[label], 2), "average": round(sum_insured_premium[label] / count, 2)} for label, count in sum_insured_counts.most_common()]
    premium_order = ["Below ₹10,000", "₹10,000–₹24,999", "₹25,000–₹49,999", "₹50,000–₹99,999", "₹100,000+"]
    premium_rows = [{"label": label, "count": premium_band_counts[label], "amount": round(premium_band_amount[label], 2), "average": round(premium_band_amount[label] / premium_band_counts[label], 2)} for label in premium_order if premium_band_counts[label]]
    age_order = ["Under 18", "18–25", "26–35", "36–45", "46–55", "56–65", "66+"]
    age_rows = [{"label": label, "count": age_counts[label], "amount": round(age_amount[label], 2)} for label in age_order if age_counts[label]]
    passing_year_rows = chronological_group(passing_year_counts, passing_year_amount)

    total_amount = round(sum(item["amount"] for item in cleaned_internal), 2)
    total_premium = round(sum(item["premium"] for item in cleaned_internal), 2)
    top_sum_insured = sum_insured_rows[0] if sum_insured_rows else None
    top_state, top_city = grouped(state_counts, state_amount, 1), grouped(city_counts, city_amount, 1)
    top_pincode, top_course = grouped(pincode_counts, pincode_amount, 1), grouped(course_counts, course_amount, 1)
    top_passing_year = grouped(passing_year_counts, passing_year_amount, 1)
    top_product, top_nominee = grouped(product_counts, product_amount, 1), grouped(nominee_counts, nominee_amount, 1)

    insights = []
    if top_sum_insured:
        insights.append(f"{top_sum_insured['label']} is the most selected sum insured with {top_sum_insured['count']} selections.")
    if premium_rows:
        most_frequent = max(premium_rows, key=lambda item: item["count"])
        highest_value = max(premium_rows, key=lambda item: item["amount"])
        insights += [f"{most_frequent['label']} is the most frequently purchased premium band ({most_frequent['count']} transactions).", f"{highest_value['label']} contributes the highest premium value at ₹{highest_value['amount']:,.0f}."]
    if top_state:
        insights.append(f"{top_state[0]['label']} is the leading state with {top_state[0]['count']} transactions.")
    if top_city:
        insights.append(f"{top_city[0]['label']} is the leading city with {top_city[0]['count']} transactions.")
    if top_pincode:
        insights.append(f"Pincode {top_pincode[0]['label']} has the highest transaction frequency ({top_pincode[0]['count']}).")
    if top_course:
        insights.append(f"{top_course[0]['label']} is the leading course segment with {top_course[0]['count']} transactions.")
    if top_passing_year:
        insights.append(f"Passing year/batch {top_passing_year[0]['label']} is the largest cohort with {top_passing_year[0]['count']} transactions.")
    if top_nominee:
        insights.append(f"{top_nominee[0]['label']} is the most common nominee relationship ({top_nominee[0]['count']} records).")
    if member_status_counts:
        dominant_status, dominant_count = member_status_counts.most_common(1)[0]
        insights.append(f"{dominant_status} is the larger member segment, representing {dominant_count / sum(member_status_counts.values()) * 100:.1f}% of records with member-status data.")
    if policy_counts:
        renewal_share = policy_counts.get("Renewal", 0) / sum(policy_counts.values()) * 100
        insights.append(f"Renewals represent {renewal_share:.1f}% of records carrying a valid New/Renewal policy status.")
    if monthly_rows:
        peak_month = max(monthly_rows, key=lambda item: item["amount"])
        insights.append(f"{peak_month['label']} is the highest-value transaction month at ₹{peak_month['amount']:,.0f}.")
    if len(monthly_rows) >= 2 and monthly_rows[-2]["amount"]:
        growth = (monthly_rows[-1]["amount"] - monthly_rows[-2]["amount"]) / monthly_rows[-2]["amount"] * 100
        insights.append(f"The latest month shows {abs(growth):.1f}% {'growth' if growth >= 0 else 'decline'} in transaction value versus the preceding month.")
    if daily_rows:
        peak_day = max(daily_rows, key=lambda item: item["amount"])
        insights.append(f"{peak_day['label']} is the highest-value transaction date at ₹{peak_day['amount']:,.0f}.")

    return {
        "meta": {"export_columns": export_columns, "policy_included": policy_available, "processed_at": datetime.now().isoformat(timespec="seconds"), "files_processed": len(files)},
        "kpis": {
            "total_records": len(cleaned_internal),
            "unique_members": len({item["export"]["member_name"].lower() for item in cleaned_internal if item["export"]["member_name"]}),
            "total_transaction_amount": total_amount,
            "average_transaction_amount": round(total_amount / len(cleaned_internal), 2),
            "median_transaction_amount": round(statistics.median(item["amount"] for item in cleaned_internal), 2),
            "total_premium": total_premium,
            "average_premium": round(total_premium / len(cleaned_internal), 2),
            "new_count": policy_counts.get("New", 0),
            "renewal_count": policy_counts.get("Renewal", 0),
            "most_selected_sum_insured": top_sum_insured["label"] if top_sum_insured else "Not available",
            "top_state": top_state[0]["label"] if top_state else "Not available",
            "top_city": top_city[0]["label"] if top_city else "Not available",
            "top_pincode": top_pincode[0]["label"] if top_pincode else "Not available",
            "top_course": top_course[0]["label"] if top_course else "Not available",
            "top_insurance_product": top_product[0]["label"] if top_product else "Not available",
        },
        "cleaned_rows": cleaned_rows,
        "analysis": {
            "daily_trend": daily_rows,
            "monthly_trend": monthly_rows,
            "policy": grouped(policy_counts),
            "sum_insured": sum_insured_rows,
            "premium_bands": premium_rows,
            "age": age_rows,
            "state": grouped(state_counts, state_amount),
            "city": grouped(city_counts, city_amount),
            "pincode": grouped(pincode_counts, pincode_amount),
            "course": grouped(course_counts, course_amount),
            "passing_year": passing_year_rows,
            "insurance_products": grouped(product_counts, product_amount),
            "insurers": grouped(insurer_counts, insurer_amount),
            "gender": grouped(gender_counts),
            "relationship": grouped(relationship_counts),
            "nominee_relationship": grouped(nominee_counts, nominee_amount),
            "new_existing_member": grouped(member_status_counts, member_status_amount),
            "pay_mode": grouped(pay_mode_counts),
        },
        "insights": insights,
        "data_quality": {"rows_before_cleaning": len(raw_rows), "invalid_dates_removed": invalid_dates, "exact_duplicates_removed": exact_duplicates, "duplicate_transaction_ids_removed": duplicate_ids, "final_rows": len(cleaned_rows), "processing_log": processing_log},
    }
