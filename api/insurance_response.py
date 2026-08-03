from __future__ import annotations

import statistics
from datetime import datetime

from api.insurance_config import EXPORT_COLUMNS, POLICY_COLUMN
from api.insurance_utils import text


def _pct_change(current: float, previous: float):
    if not previous:
        return None
    return (current - previous) / previous * 100


def _year_rows(analysis):
    return sorted(
        analysis.get("yearly_trend", []),
        key=lambda row: int(str(row["label"])),
    )


def _kpis(rows, analysis):
    # Business definitions:
    # - Transaction Amount is the premium collected, inclusive of GST.
    # - Total Sum Insured is the sum of Sum Insured across the final cleaned rows.
    total_premium = sum(item["export"]["transaction_amount"] for item in rows)
    total_sum_insured = sum(
        item["sum_insured"] for item in rows if item.get("sum_insured") is not None
    )
    yearly = _year_rows(analysis)
    recommendation = analysis.get("plan_recommendation", [])
    sums = analysis.get("sum_insured", [])
    batches = analysis.get("passing_year", [])
    forecast = analysis.get("forecast_summary", [])
    forecast_meta = {
        str(row.get("label")): row.get("value")
        for row in analysis.get("forecast_methodology", [])
    }

    current = yearly[-1] if yearly else None
    previous = yearly[-2] if len(yearly) >= 2 else None

    return {
        "total_records": len(rows),
        "unique_members": len(
            {
                item["export"]["member_name"].lower()
                for item in rows
                if item["export"]["member_name"]
            }
        ),
        "total_transaction_amount": round(total_premium, 2),
        "average_transaction_amount": round(total_premium / len(rows), 2),
        "median_transaction_amount": round(
            statistics.median(item["amount"] for item in rows), 2
        ),
        "total_premium": round(total_premium, 2),
        "average_premium": round(total_premium / len(rows), 2),
        "total_sum_insured": round(total_sum_insured, 2),
        "most_selected_sum_insured": sums[0]["label"] if sums else "Not available",
        "top_plan": recommendation[0]["label"] if recommendation else "Not available",
        "top_batch": batches[0]["label"] if batches else "Not available",
        "years_compared": len(yearly),
        "plans_compared": len(analysis.get("plan_comparison", [])),
        "current_year": current["label"] if current else "Not available",
        "previous_year": previous["label"] if previous else "Not available",
        "current_year_premium": current["amount"] if current else 0,
        "previous_year_premium": previous["amount"] if previous else 0,
        "current_year_enrolments": current["count"] if current else 0,
        "previous_year_enrolments": previous["count"] if previous else 0,
        "forecast_year": forecast[0]["label"] if forecast else "Not available",
        "forecast_premium": forecast[0]["amount"] if forecast else 0,
        "forecast_enrolments": forecast[0]["count"] if forecast else 0,
        "forecast_growth_rate": forecast[0].get("growth_rate") if forecast else None,
        "forecast_confidence": forecast_meta.get("Confidence", "Low"),
    }


def _insights(
    rows,
    analysis,
    college: str,
    scope_name: str | None = None,
    include_forecast: bool = True,
):
    insights: list[str] = []
    scope = scope_name or text(college) or "the college"
    yearly = _year_rows(analysis)

    if len(yearly) >= 2:
        previous, current = yearly[-2], yearly[-1]
        premium_change = _pct_change(current["amount"], previous["amount"])
        enrolment_change = _pct_change(current["count"], previous["count"])
        average_change = _pct_change(current.get("average", 0), previous.get("average", 0))

        if premium_change is not None:
            direction = "increased" if premium_change >= 0 else "decreased"
            insights.append(
                f"Premium collected in {current['label']} {direction} by "
                f"{abs(premium_change):.1f}% versus {previous['label']}, moving from "
                f"₹{previous['amount']:,.0f} to ₹{current['amount']:,.0f}."
            )
        if enrolment_change is not None:
            direction = "increased" if enrolment_change >= 0 else "decreased"
            insights.append(
                f"Enrolments in {current['label']} {direction} by "
                f"{abs(enrolment_change):.1f}% versus {previous['label']} "
                f"({previous['count']} to {current['count']} records)."
            )
        if average_change is not None:
            direction = "higher" if average_change >= 0 else "lower"
            insights.append(
                f"Average premium per enrolment in {current['label']} is "
                f"{abs(average_change):.1f}% {direction} than {previous['label']} "
                f"(₹{current.get('average', 0):,.0f} versus ₹{previous.get('average', 0):,.0f})."
            )

        month_rows = analysis.get("month_by_year", [])
        current_months = [row for row in month_rows if str(row.get("series")) == str(current["label"])]
        previous_months = [row for row in month_rows if str(row.get("series")) == str(previous["label"])]
        if current_months:
            peak = max(current_months, key=lambda row: row["amount"])
            insights.append(
                f"The strongest month in {current['label']} is {peak['label']} with "
                f"₹{peak['amount']:,.0f} premium from {peak['count']} enrolments."
            )
        if previous_months:
            peak = max(previous_months, key=lambda row: row["amount"])
            insights.append(
                f"The strongest month in {previous['label']} was {peak['label']} with "
                f"₹{peak['amount']:,.0f} premium from {peak['count']} enrolments."
            )

        forecast = analysis.get("forecast_summary", [])
        if include_forecast and forecast:
            next_year = forecast[0]
            growth = next_year.get("growth_rate")
            movement = (
                f"{abs(growth):.1f}% {'growth' if growth >= 0 else 'decline'}"
                if growth is not None
                else "a directional continuation of the observed trend"
            )
            insights.append(
                f"The directional forecast for {next_year['label']} is "
                f"₹{next_year['amount']:,.0f} premium and {next_year['count']} enrolments, "
                f"equivalent to {movement}; confidence is {next_year.get('confidence', 'Low').lower()}."
            )
    elif yearly:
        only = yearly[0]
        insights.append(
            f"The {only['label']} report for {scope} contains {only['count']} enrolments and ₹{only['amount']:,.0f} in premium; no previous-year file was required for this analysis."
        )
        forecast = analysis.get("forecast_summary", [])
        if include_forecast and forecast:
            next_year = forecast[0]
            insights.append(
                f"The baseline forecast for {next_year['label']} is ₹{next_year['amount']:,.0f} premium and {next_year['count']} enrolments. Confidence is low because only one report year is available."
            )

    plan_rows = sorted(
        analysis.get("plan_comparison", []),
        key=lambda row: row["amount"],
        reverse=True,
    )
    if len(plan_rows) >= 2:
        leader, closest = plan_rows[0], plan_rows[1]
        gap = leader["amount"] - closest["amount"]
        gap_pct = gap / closest["amount"] * 100 if closest["amount"] else None
        comparison = (
            f", a {gap_pct:.1f}% lead"
            if gap_pct is not None
            else ""
        )
        insights.append(
            f"{leader['label']} leads premium collection at ₹{leader['amount']:,.0f}; "
            f"the closest plan is {closest['label']} at ₹{closest['amount']:,.0f}, "
            f"a gap of ₹{gap:,.0f}{comparison}."
        )

        enrolment_leader = max(plan_rows, key=lambda row: row["count"])
        batch_leader = max(plan_rows, key=lambda row: row["batch_count"])
        average_leader = max(plan_rows, key=lambda row: row.get("average", 0))
        insights.append(
            f"{enrolment_leader['label']} has the highest enrolment count "
            f"({enrolment_leader['count']}), while {batch_leader['label']} reaches the "
            f"most batches ({batch_leader['batch_count']})."
        )
        insights.append(
            f"{average_leader['label']} has the highest average premium per enrolment "
            f"at ₹{average_leader.get('average', 0):,.0f}."
        )

        recommendation = analysis.get("plan_recommendation", [])
        if len(recommendation) >= 2:
            score_gap = recommendation[0]["suitability_score"] - recommendation[1]["suitability_score"]
            if score_gap < 8:
                insights.append(
                    f"The top two suitability scores are close—{recommendation[0]['label']} "
                    f"at {recommendation[0]['suitability_score']}/100 and "
                    f"{recommendation[1]['label']} at {recommendation[1]['suitability_score']}/100—"
                    f"so policy benefits, claim service and exclusions should decide the final choice."
                )
            else:
                insights.append(
                    f"{recommendation[0]['label']} has a clear suitability lead of "
                    f"{score_gap:.1f} points over {recommendation[1]['label']} based on "
                    f"premium, enrolment, batch reach and sum-insured participation."
                )

    sums = analysis.get("sum_insured", [])
    if sums:
        total_cover_records = sum(row["count"] for row in sums)
        share = sums[0]["count"] / total_cover_records * 100 if total_cover_records else 0
        insights.append(
            f"{sums[0]['label']} is the most selected sum insured with {sums[0]['count']} "
            f"enrolments, representing {share:.1f}% of records that contain sum-insured data."
        )

    batches = analysis.get("passing_year", [])
    if batches:
        insights.append(
            f"Batch {batches[0]['label']} has the highest participation with "
            f"{batches[0]['count']} enrolments and ₹{batches[0].get('amount', 0):,.0f} premium."
        )

    states = analysis.get("state", [])
    if states:
        insights.append(
            f"{states[0]['label']} is the leading state with {states[0]['count']} "
            f"enrolments and ₹{states[0].get('amount', 0):,.0f} premium."
        )

    return insights


def _single_business_insights(analysis):
    insights = []
    premium_amounts = analysis.get("premium_amounts", [])
    if premium_amounts:
        leader = premium_amounts[0]
        insights.append(
            f"{leader['label']} is the premium amount paid most often, appearing in "
            f"{leader['count']} clean transactions."
        )

    products = analysis.get("insurance_products", [])
    if products:
        leader = products[0]
        insights.append(
            f"{leader['label']} is the most frequently selected insurance product or "
            f"policy type, with {leader['count']} enrolments and "
            f"₹{leader.get('amount', 0):,.0f} premium."
        )

    insurers = analysis.get("insurers", [])
    if insurers:
        leader = insurers[0]
        insights.append(
            f"{leader['label']} is the most frequently selected insurer, with "
            f"{leader['count']} enrolments and ₹{leader.get('amount', 0):,.0f} premium."
        )
    return insights


def build_response(
    rows,
    has_policy,
    analysis,
    analysis_by_plan,
    raw_count,
    cleaning,
    logs,
    college,
    file_count,
    analysis_mode="comparison",
):
    columns = EXPORT_COLUMNS.copy()
    if has_policy:
        columns.insert(8, POLICY_COLUMN)

    cleaned = [
        {column: item["export"].get(column, "") for column in columns}
        for item in rows
    ]
    analysis_rows = [
        {
            **{column: item["export"].get(column, "") for column in columns},
            "Analysis_Plan": item["plan"],
            "College": item["college"],
            "Source_File": item["file"],
            "Transaction_Year": item["year"],
        }
        for item in rows
    ]

    plans = list(analysis_by_plan.keys())
    rows_by_plan = {
        plan: [item for item in rows if item["plan"] == plan]
        for plan in plans
    }
    kpis = _kpis(rows, analysis)
    kpis_by_plan = {
        plan: _kpis(rows_by_plan[plan], analysis_by_plan[plan])
        for plan in plans
    }
    is_single = analysis_mode == "single"
    insights = _insights(
        rows,
        analysis,
        college,
        include_forecast=not is_single,
    )
    if is_single:
        insights.extend(_single_business_insights(analysis))
    insights_by_plan = {
        plan: (
            _insights(
                rows_by_plan[plan],
                analysis_by_plan[plan],
                college,
                scope_name=plan,
                include_forecast=not is_single,
            )
            + (
                _single_business_insights(analysis_by_plan[plan])
                if is_single
                else []
            )
        )
        for plan in plans
    }

    if is_single:
        for values, scoped_analysis in [
            (kpis, analysis),
            *[
                (kpis_by_plan[plan], analysis_by_plan[plan])
                for plan in plans
            ],
        ]:
            premium_amounts = scoped_analysis.get("premium_amounts", [])
            insurers = scoped_analysis.get("insurers", [])
            products = scoped_analysis.get("insurance_products", [])
            values.update(
                {
                    "most_common_premium": premium_amounts[0]["label"]
                    if premium_amounts
                    else "Not available",
                    "most_selected_insurer": insurers[0]["label"]
                    if insurers
                    else "Not available",
                    "most_selected_product": products[0]["label"]
                    if products
                    else "Not available",
                }
            )
            for key in [
                "forecast_year",
                "forecast_premium",
                "forecast_enrolments",
                "forecast_growth_rate",
                "forecast_confidence",
            ]:
                values.pop(key, None)

    yearly = _year_rows(analysis)
    current_year = yearly[-1]["label"] if yearly else ""
    previous_year = yearly[-2]["label"] if len(yearly) >= 2 else ""

    meta = {
            "export_columns": columns,
            "policy_included": has_policy,
            "processed_at": datetime.now().isoformat(timespec="seconds"),
            "files_processed": file_count,
            "college_name": text(college),
            "plans": plans,
            "current_year": current_year,
            "previous_year": previous_year,
            "premium_definition": "transaction_amount_including_gst",
            "sum_insured_definition": "sum_of_sum_insured",
            "analysis_mode": analysis_mode,
        }
    if not is_single:
        meta.update(
            forecast_method="Least-squares trend with monthly seasonality",
            forecast_confidence=kpis.get("forecast_confidence", "Low"),
        )

    return {
        "meta": meta,
        "kpis": kpis,
        "kpis_by_plan": kpis_by_plan,
        "cleaned_rows": cleaned,
        "analysis_rows": analysis_rows,
        "analysis": analysis,
        "analysis_by_plan": analysis_by_plan,
        "insights": insights,
        "insights_by_plan": insights_by_plan,
        "data_quality": {
            "rows_before_cleaning": raw_count,
            **cleaning,
            "final_rows": len(rows),
            "processing_log": logs,
        },
    }
