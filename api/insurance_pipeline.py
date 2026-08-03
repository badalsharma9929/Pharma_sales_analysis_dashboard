from __future__ import annotations

from fastapi import HTTPException

from api.insurance_aggregate import build_analysis
from api.insurance_extract import clean_rows
from api.insurance_response import build_response


def analyze_raw_rows(raw_rows, logs, college_name: str, file_count: int):
    if not raw_rows:
        raise HTTPException(
            400,
            "No usable data sheet was found. Select a report year and ensure the workbook contains a premium/amount column.",
        )

    rows, has_policy, cleaning = clean_rows(raw_rows)
    if not rows:
        raise HTTPException(400, "No rows remain after Transaction Date cleaning")

    analysis = build_analysis(rows)
    plan_names = list(dict.fromkeys(item["plan"] for item in rows))
    analysis_by_plan = {
        plan: build_analysis([item for item in rows if item["plan"] == plan])
        for plan in plan_names
    }

    return build_response(
        rows,
        has_policy,
        analysis,
        analysis_by_plan,
        len(raw_rows),
        cleaning,
        logs,
        college_name,
        file_count,
    )
