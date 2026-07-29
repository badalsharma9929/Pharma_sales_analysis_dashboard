from __future__ import annotations
import io, math, re
from datetime import date, datetime, timedelta
from typing import Any
import msoffcrypto
from fastapi import HTTPException


def norm(value: Any) -> str:
    text = "" if value is None else str(value).strip().lower().replace("&", " and ")
    text = re.sub(r"[()\[\]{}\\/\-]+", " ", text)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


def text(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    output = str(value).strip()
    return "" if output.lower() in {"nan", "none", "null", "nat"} else re.sub(r"\s+", " ", output)


def number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return None if isinstance(value, float) and math.isnan(value) else float(value)
    cleaned = re.sub(r"[^0-9.\-]", "", text(value).replace(",", ""))
    try:
        return float(cleaned)
    except (TypeError, ValueError):
        return None


def phone(value: Any) -> str:
    digits = re.sub(r"\D", "", text(value))
    if not digits or set(digits) == {"0"}:
        return ""
    if digits.startswith("0091") and len(digits) >= 14:
        digits = digits[4:]
    elif digits.startswith("91") and len(digits) >= 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    return digits[-10:] if len(digits) > 10 else digits


def parse_date(value: Any) -> date | None:
    if value in (None, "", 0, "0", "0.0"):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)) and 1 <= float(value) <= 100000:
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
    raw = text(value)
    formats = [
        "%d/%b/%y", "%d/%b/%Y", "%d-%b-%y", "%d-%b-%Y",
        "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y",
        "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%B/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def policy_value(value: Any) -> str:
    normalized = norm(value)
    if normalized in {"new", "n", "new_policy", "new_member"}:
        return "New"
    if normalized in {"renewal", "renew", "renewed", "r", "policy_renewal"}:
        return "Renewal"
    return ""


def decrypt(raw: bytes, password: str) -> bytes:
    if raw[:2] == b"PK":
        return raw
    try:
        encrypted = msoffcrypto.OfficeFile(io.BytesIO(raw))
        encrypted.load_key(password=password)
        output = io.BytesIO(); encrypted.decrypt(output)
        return output.getvalue()
    except Exception as exc:
        raise HTTPException(400, f"Could not unlock workbook. Check the password. ({exc})") from exc


def age_band(age: int) -> str:
    if age < 18: return "Under 18"
    if age <= 25: return "18–25"
    if age <= 35: return "26–35"
    if age <= 45: return "36–45"
    if age <= 55: return "46–55"
    if age <= 65: return "56–65"
    return "66+"


def premium_band(value: float) -> str:
    if value < 10000: return "Below ₹10,000"
    if value < 25000: return "₹10,000–₹24,999"
    if value < 50000: return "₹25,000–₹49,999"
    if value < 100000: return "₹50,000–₹99,999"
    return "₹100,000+"
