from __future__ import annotations

from fastapi import HTTPException

from api.insurance_aggregate import build_analysis, build_single_business_trends
from api.insurance_extract import clean_rows
from api.insurance_response import build_response


FORECAST_KEYS = {
    "annual_forecast",
    "forecast_summary",
    "monthly_forecast",
    "forecast_methodology",
}


def _single_analysis(rows):
    analysis = build_analysis(rows)
    for key in FORECAST_KEYS:
        analysis.pop(key, None)
    analysis.update(build_single_business_trends(rows))
    return analysis


def _comparison_analysis(rows):
    analysis = build_analysis(rows)
    analysis.update(build_single_business_trends(rows))
    return analysis


def analyze_raw_rows(
    raw_rows,
    logs,
    college_name: str,
    file_count: int,
    analysis_mode: str = "comparison",
):
    if not raw_rows:
        raise HTTPException(
            400,
            "No usable data sheet was found. Select a report year and ensure the workbook contains a premium/amount column.",
        )

    mode = "single" if analysis_mode == "single" else "comparison"
    rows, has_policy, cleaning = clean_rows(
        raw_rows,
        strict_single=mode == "single",
    )
    if not rows:
        raise HTTPException(
            400,
            "No rows remain after ordered duplicate checks and removal of blank, zero or invalid Transaction Dates",
        )

    analysis_builder = _single_analysis if mode == "single" else _comparison_analysis
    analysis = analysis_builder(rows)
    plan_names = list(dict.fromkeys(item["plan"] for item in rows))
    analysis_by_plan = {
        plan: analysis_builder([item for item in rows if item["plan"] == plan])
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
        mode,
    )
