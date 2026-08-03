from __future__ import annotations

import json
import zlib
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException


MAX_TOKEN_BYTES = 3_800_000
MAX_DECOMPRESSED_BYTES = 80 * 1024 * 1024
MAX_COMBINED_ROWS = 200_000


def _json_default(value: Any):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)


def pack_prepared_rows(rows: list[dict[str, Any]], logs: list[dict[str, Any]]) -> bytes:
    serialized = json.dumps(
        {"rows": rows, "logs": logs},
        ensure_ascii=False,
        separators=(",", ":"),
        default=_json_default,
    ).encode("utf-8")
    compressed = zlib.compress(serialized, level=9)
    if len(compressed) > MAX_TOKEN_BYTES:
        raise HTTPException(
            413,
            "This report is too large after preparation. Split the workbook into two files for the same report year and select both files in that year slot.",
        )
    return compressed


def unpack_prepared_rows(token: bytes):
    if not isinstance(token, bytes) or not token or len(token) > MAX_TOKEN_BYTES:
        raise HTTPException(400, "A prepared report token is missing or invalid")
    try:
        decompressor = zlib.decompressobj()
        serialized = decompressor.decompress(
            token, MAX_DECOMPRESSED_BYTES + 1
        )
        if len(serialized) > MAX_DECOMPRESSED_BYTES or decompressor.unconsumed_tail:
            raise HTTPException(413, "Prepared report data is too large")
        serialized += decompressor.flush()
        payload = json.loads(serialized.decode("utf-8"))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, "Prepared report data is invalid or expired") from exc

    rows = payload.get("rows") if isinstance(payload, dict) else None
    logs = payload.get("logs") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not isinstance(logs, list):
        raise HTTPException(400, "Prepared report data has an invalid format")
    return rows, logs
