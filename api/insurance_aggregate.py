from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime

from api.insurance_utils import age_band, premium_band


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 2)


def _linear_projection(values: list[float], periods: int) -> list[float]:
    """Small, dependency-free least-squares projection with non-negative output."""
    if not values:
        return [0.0] * periods
    if len(values) == 1:
        return [max(0.0, values[0])] * periods

    n = len(values)
    mean_x = (n - 1) / 2
    mean_y = sum(values) / n
    denominator = sum((index - mean_x) ** 2 for index in range(n)) or 1
    slope = sum(
        (index - mean_x) * (value - mean_y)
        for index, value in enumerate(values)
    ) / denominator
    intercept = mean_y - slope * mean_x
    return [
        max(0.0, intercept + slope * (n + horizon))
        for horizon in range(periods)
    ]


def _next_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)


def grouped(counter: Counter, amounts=None, premiums=None):
    result = []
    for label, count in counter.most_common():
        row = {"label": label, "count": count}
        if amounts is not None:
            row["amount"] = round(amounts[label], 2)
        if premiums is not None:
            row["premium"] = round(premiums[label], 2)
        result.append(row)
    return result


def score_plans(plan_rows):
    if not plan_rows:
        return []

    maxima = {
        "count": max(row["count"] for row in plan_rows) or 1,
        "amount": max(row["amount"] for row in plan_rows) or 1,
        "batch_count": max(row["batch_count"] for row in plan_rows) or 1,
        "sum_insured_enrollments": max(
            row["sum_insured_enrollments"] for row in plan_rows
        )
        or 1,
    }

    scored = []
    for row in plan_rows:
        # transaction_amount is the premium amount. Premium and enrolment
        # therefore receive the largest weights in the college-level score.
        score = (
            0.40 * row["amount"] / maxima["amount"]
            + 0.30 * row["count"] / maxima["count"]
            + 0.15 * row["batch_count"] / maxima["batch_count"]
            + 0.15
            * row["sum_insured_enrollments"]
            / maxima["sum_insured_enrollments"]
        ) * 100
        scored.append({**row, "suitability_score": round(score, 1)})

    return sorted(scored, key=lambda row: row["suitability_score"], reverse=True)


def build_analysis(rows):
    daily = defaultdict(lambda: [0, 0.0, 0.0])
    monthly = defaultdict(lambda: [0, 0.0, 0.0])
    yearly = defaultdict(lambda: [0, 0.0, 0.0])
    month_year = defaultdict(lambda: [0, 0.0, 0.0])
    plan_month = defaultdict(lambda: [0, 0.0, 0.0])
    plan_year = defaultdict(lambda: [0, 0.0, 0.0])
    plan_sum = defaultdict(lambda: [0, 0.0, 0.0])
    plan_batch = defaultdict(lambda: [0, 0.0, 0.0])
    dimension_year = defaultdict(lambda: [0, 0.0])

    counters = {
        key: Counter()
        for key in [
            "policy",
            "sum",
            "premium_band",
            "age",
            "state",
            "city",
            "pincode",
            "course",
            "passing",
            "product",
            "insurer",
            "nominee",
            "plan",
        ]
    }
    amounts = {
        key: defaultdict(float)
        for key in [
            "sum",
            "premium_band",
            "age",
            "state",
            "city",
            "pincode",
            "course",
            "passing",
            "product",
            "insurer",
            "nominee",
            "plan",
        ]
    }
    premiums = {key: defaultdict(float) for key in amounts}

    plan_members = defaultdict(set)
    plan_batches = defaultdict(set)
    plan_cover = Counter()
    year_members = defaultdict(set)

    for item in rows:
        for bucket, key in [
            (daily, item["date"].isoformat()),
            (monthly, f"{item['year']}-{item['month_number']:02d}"),
            (yearly, item["year"]),
        ]:
            bucket[key][0] += 1
            bucket[key][1] += item["amount"]
            bucket[key][2] += item["amount"]

        month_key = (item["year"], item["month_number"], item["month_label"])
        month_year[month_key][0] += 1
        month_year[month_key][1] += item["amount"]
        month_year[month_key][2] += item["amount"]

        plan_month_key = (
            item["plan"],
            f"{item['year']}-{item['month_number']:02d}",
            item["month_period"],
        )
        plan_month[plan_month_key][0] += 1
        plan_month[plan_month_key][1] += item["amount"]
        plan_month[plan_month_key][2] += item["amount"]

        plan_year_key = (item["plan"], item["year"])
        plan_year[plan_year_key][0] += 1
        plan_year[plan_year_key][1] += item["amount"]
        plan_year[plan_year_key][2] += item["amount"]

        counters["plan"][item["plan"]] += 1
        amounts["plan"][item["plan"]] += item["amount"]
        premiums["plan"][item["plan"]] += item["amount"]

        member_name = item["export"]["member_name"]
        if member_name:
            plan_members[item["plan"]].add(member_name.lower())
            year_members[item["year"]].add(member_name.lower())
        if item["passing_year"]:
            plan_batches[item["plan"]].add(item["passing_year"])
        if item["policy"]:
            counters["policy"][item["policy"]] += 1
            dimension_year[("policy", item["policy"], item["year"])][0] += 1
            dimension_year[("policy", item["policy"], item["year"])][1] += item["amount"]

        if item["sum_insured"] and item["sum_insured"] > 0:
            cover = f"₹{item['sum_insured']:,.0f}"
            plan_cover[item["plan"]] += 1
            counters["sum"][cover] += 1
            amounts["sum"][cover] += item["amount"]
            premiums["sum"][cover] += item["amount"]
            dimension_year[("sum", cover, item["year"])][0] += 1
            dimension_year[("sum", cover, item["year"])][1] += item["amount"]

            key = (item["plan"], cover)
            plan_sum[key][0] += 1
            plan_sum[key][1] += item["amount"]
            plan_sum[key][2] += item["amount"]

        if item["amount"] > 0:
            band = premium_band(item["amount"])
            counters["premium_band"][band] += 1
            amounts["premium_band"][band] += item["amount"]
            premiums["premium_band"][band] += item["amount"]
            dimension_year[("premium_band", band, item["year"])][0] += 1
            dimension_year[("premium_band", band, item["year"])][1] += item["amount"]

        if item["age"] is not None:
            band = age_band(item["age"])
            counters["age"][band] += 1
            amounts["age"][band] += item["amount"]
            premiums["age"][band] += item["amount"]

        for value, key in [
            (item["state"], "state"),
            (item["city"], "city"),
            (item["pincode"], "pincode"),
            (item["course"], "course"),
            (item["passing_year"], "passing"),
            (item["insurance_product"], "product"),
            (item["insurer"], "insurer"),
            (item["nominee_relationship"], "nominee"),
        ]:
            if value:
                counters[key][value] += 1
                amounts[key][value] += item["amount"]
                premiums[key][value] += item["amount"]
                if key in {"state", "course", "passing"}:
                    dimension_year[(key, value, item["year"])][0] += 1
                    dimension_year[(key, value, item["year"])][1] += item["amount"]

        if item["passing_year"]:
            key = (item["plan"], item["passing_year"])
            plan_batch[key][0] += 1
            plan_batch[key][1] += item["amount"]
            plan_batch[key][2] += item["amount"]

    def trends(bucket, formatter=lambda key: key):
        return [
            {
                "label": formatter(key),
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
                "average": round(values[1] / values[0], 2) if values[0] else 0,
            }
            for key, values in sorted(bucket.items())
        ]

    plan_rows = [
        {
            "label": plan,
            "count": counters["plan"][plan],
            "amount": round(amounts["plan"][plan], 2),
            "premium": round(amounts["plan"][plan], 2),
            "average": round(
                amounts["plan"][plan] / counters["plan"][plan], 2
            )
            if counters["plan"][plan]
            else 0,
            "unique_members": len(plan_members[plan]),
            "batch_count": len(plan_batches[plan]),
            "sum_insured_enrollments": plan_cover[plan],
        }
        for plan in counters["plan"]
    ]

    yearly_rows = trends(yearly)
    years = sorted(yearly.keys(), key=lambda value: int(value))
    latest_year = years[-1] if years else ""
    previous_year = years[-2] if len(years) >= 2 else ""
    latest_vs_previous = [
        row
        for row in yearly_rows
        if row["label"] in {previous_year, latest_year}
    ]

    for row in yearly_rows:
        row["unique_members"] = len(year_members[str(row["label"])])

    comparison_summary = []
    if len(latest_vs_previous) == 2:
        previous, current = latest_vs_previous
        comparison_metrics = [
            ("Premium collected", previous["amount"], current["amount"], "currency"),
            ("Enrolments", previous["count"], current["count"], "number"),
            ("Average premium", previous["average"], current["average"], "currency"),
            (
                "Unique members",
                previous.get("unique_members", 0),
                current.get("unique_members", 0),
                "number",
            ),
        ]
        comparison_summary = [
            {
                "label": label,
                "previous": round(float(previous_value), 2),
                "current": round(float(current_value), 2),
                "change": round(float(current_value) - float(previous_value), 2),
                "percentage_change": _pct_change(
                    float(current_value), float(previous_value)
                ),
                "format": value_format,
                "previous_year": previous_year,
                "current_year": latest_year,
            }
            for label, previous_value, current_value, value_format in comparison_metrics
        ]

    annual_amounts = [float(row["amount"]) for row in yearly_rows]
    annual_counts = [float(row["count"]) for row in yearly_rows]
    annual_averages = [float(row["average"]) for row in yearly_rows]
    amount_projection = _linear_projection(annual_amounts, 3)
    count_projection = _linear_projection(annual_counts, 3)
    average_projection = _linear_projection(annual_averages, 3)
    history_years = len(yearly_rows)
    forecast_confidence = (
        "High" if history_years >= 5 else "Moderate" if history_years >= 3 else "Low"
    )
    base_uncertainty = 0.08 if history_years >= 5 else 0.12 if history_years >= 3 else 0.20
    annual_forecast = [
        {
            **row,
            "series": "Actual",
            "status": "Actual",
            "amount_low": row["amount"],
            "amount_high": row["amount"],
        }
        for row in yearly_rows
    ]
    forecast_summary = []
    if yearly_rows:
        # Repeat the latest actual point in the forecast series to create a visual bridge.
        annual_forecast.append(
            {
                **yearly_rows[-1],
                "series": "Forecast",
                "status": "Forecast base",
                "amount_low": yearly_rows[-1]["amount"],
                "amount_high": yearly_rows[-1]["amount"],
            }
        )
        latest_numeric_year = int(str(yearly_rows[-1]["label"]))
        prior_amount = annual_amounts[-1]
        for horizon in range(1, 4):
            amount_value = round(amount_projection[horizon - 1], 2)
            count_value = max(0, int(round(count_projection[horizon - 1])))
            average_value = round(
                amount_value / count_value if count_value else average_projection[horizon - 1],
                2,
            )
            uncertainty = base_uncertainty * (1 + 0.35 * (horizon - 1))
            row = {
                "label": str(latest_numeric_year + horizon),
                "series": "Forecast",
                "status": "Forecast",
                "count": count_value,
                "amount": amount_value,
                "premium": amount_value,
                "average": average_value,
                "amount_low": round(max(0, amount_value * (1 - uncertainty)), 2),
                "amount_high": round(amount_value * (1 + uncertainty), 2),
                "growth_rate": _pct_change(amount_value, prior_amount),
                "confidence": forecast_confidence,
            }
            annual_forecast.append(row)
            forecast_summary.append(row)
            prior_amount = amount_value

    monthly_forecast = []
    if monthly:
        first_period = min(monthly)
        last_period = max(monthly)
        cursor_year, cursor_month = map(int, first_period.split("-"))
        end_year, end_month = map(int, last_period.split("-"))
        month_keys = []
        while (cursor_year, cursor_month) <= (end_year, end_month):
            month_keys.append(f"{cursor_year:04d}-{cursor_month:02d}")
            cursor_year, cursor_month = _next_month(cursor_year, cursor_month)

        historical_amounts = [float(monthly[key][1]) for key in month_keys]
        historical_counts = [float(monthly[key][0]) for key in month_keys]
        amount_month_projection = _linear_projection(historical_amounts, 12)
        count_month_projection = _linear_projection(historical_counts, 12)
        overall_amount = sum(historical_amounts) / len(historical_amounts)
        overall_count = sum(historical_counts) / len(historical_counts)
        amount_seasonality, count_seasonality = {}, {}
        for month_number in range(1, 13):
            amount_samples = [
                historical_amounts[index]
                for index, key in enumerate(month_keys)
                if int(key[-2:]) == month_number
            ]
            count_samples = [
                historical_counts[index]
                for index, key in enumerate(month_keys)
                if int(key[-2:]) == month_number
            ]
            amount_seasonality[month_number] = (
                sum(amount_samples) / len(amount_samples) / overall_amount
                if amount_samples and overall_amount and len(month_keys) >= 12
                else 1
            )
            count_seasonality[month_number] = (
                sum(count_samples) / len(count_samples) / overall_count
                if count_samples and overall_count and len(month_keys) >= 12
                else 1
            )

        for key in month_keys[-12:]:
            values = monthly[key]
            monthly_forecast.append(
                {
                    "label": datetime.strptime(key, "%Y-%m").strftime("%b %Y"),
                    "series": "Actual",
                    "status": "Actual",
                    "count": int(values[0]),
                    "amount": round(values[1], 2),
                    "premium": round(values[1], 2),
                    "average": round(values[1] / values[0], 2) if values[0] else 0,
                }
            )

        next_year, next_month_number = _next_month(end_year, end_month)
        for horizon in range(12):
            amount_value = max(
                0,
                amount_month_projection[horizon]
                * amount_seasonality[next_month_number],
            )
            count_value = max(
                0,
                int(
                    round(
                        count_month_projection[horizon]
                        * count_seasonality[next_month_number]
                    )
                ),
            )
            monthly_forecast.append(
                {
                    "label": date(next_year, next_month_number, 1).strftime("%b %Y"),
                    "series": "Forecast",
                    "status": "Forecast",
                    "count": count_value,
                    "amount": round(amount_value, 2),
                    "premium": round(amount_value, 2),
                    "average": round(amount_value / count_value, 2) if count_value else 0,
                }
            )
            next_year, next_month_number = _next_month(next_year, next_month_number)

    def dimension_comparison(kind: str):
        return [
            {
                "label": label,
                "series": year,
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
                "average": round(values[1] / values[0], 2) if values[0] else 0,
            }
            for (dimension, label, year), values in sorted(
                dimension_year.items(), key=lambda item: (item[0][2], item[0][1])
            )
            if dimension == kind and year in {previous_year, latest_year}
        ]

    result = {
        "daily_trend": trends(
            daily,
            lambda key: datetime.strptime(key, "%Y-%m-%d").strftime("%d/%b/%Y"),
        ),
        "monthly_trend": trends(
            monthly,
            lambda key: datetime.strptime(key, "%Y-%m").strftime("%b %Y"),
        ),
        "yearly_trend": yearly_rows,
        "latest_vs_previous": latest_vs_previous,
        "comparison_summary": comparison_summary,
        "annual_forecast": annual_forecast,
        "forecast_summary": forecast_summary,
        "monthly_forecast": monthly_forecast,
        "forecast_methodology": [
            {
                "label": "Method",
                "value": (
                    "Single-year baseline with monthly trend and seasonality when at least 12 months are available"
                    if history_years == 1
                    else "Least-squares trend with monthly seasonality when at least 12 months are available"
                ),
            },
            {"label": "Confidence", "value": forecast_confidence},
            {"label": "Historical years", "value": history_years},
        ],
        "policy_year_comparison": dimension_comparison("policy"),
        "sum_insured_year_comparison": dimension_comparison("sum"),
        "premium_band_year_comparison": dimension_comparison("premium_band"),
        "state_year_comparison": dimension_comparison("state"),
        "course_year_comparison": dimension_comparison("course"),
        "passing_year_comparison": dimension_comparison("passing"),
        "month_by_year": [
            {
                "label": month,
                "series": year,
                "sort": number,
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
                "average": round(values[1] / values[0], 2) if values[0] else 0,
            }
            for (year, number, month), values in sorted(month_year.items())
        ],
        "plan_month_comparison": [
            {
                "label": display,
                "series": plan,
                "period": period,
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
                "average": round(values[1] / values[0], 2) if values[0] else 0,
            }
            for (plan, period, display), values in sorted(
                plan_month.items(), key=lambda item: (item[0][1], item[0][0])
            )
        ],
        "plan_year_comparison": [
            {
                "label": year,
                "series": plan,
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
                "average": round(values[1] / values[0], 2) if values[0] else 0,
            }
            for (plan, year), values in sorted(
                plan_year.items(), key=lambda item: (item[0][1], item[0][0])
            )
        ],
        "latest_vs_previous_by_plan": [
            {
                "label": year,
                "series": plan,
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
                "average": round(values[1] / values[0], 2) if values[0] else 0,
            }
            for (plan, year), values in sorted(
                plan_year.items(), key=lambda item: (item[0][1], item[0][0])
            )
            if year in {previous_year, latest_year}
        ],
        "plan_sum_insured": [
            {
                "label": cover,
                "series": plan,
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
            }
            for (plan, cover), values in sorted(
                plan_sum.items(), key=lambda item: (item[0][1], item[0][0])
            )
        ],
        "plan_batch_comparison": [
            {
                "label": batch,
                "series": plan,
                "count": int(values[0]),
                "amount": round(values[1], 2),
                "premium": round(values[1], 2),
            }
            for (plan, batch), values in sorted(
                plan_batch.items(), key=lambda item: (item[0][1], item[0][0])
            )
        ],
        "plan_comparison": plan_rows,
        "plan_recommendation": score_plans(plan_rows),
        "policy": grouped(counters["policy"]),
        "sum_insured": grouped(counters["sum"], amounts["sum"], premiums["sum"]),
        "premium_bands": grouped(
            counters["premium_band"],
            amounts["premium_band"],
            premiums["premium_band"],
        ),
        "age": grouped(counters["age"], amounts["age"], premiums["age"]),
        "state": grouped(counters["state"], amounts["state"], premiums["state"]),
        "city": grouped(counters["city"], amounts["city"], premiums["city"]),
        "pincode": grouped(
            counters["pincode"], amounts["pincode"], premiums["pincode"]
        ),
        "course": grouped(counters["course"], amounts["course"], premiums["course"]),
        "passing_year": grouped(
            counters["passing"], amounts["passing"], premiums["passing"]
        ),
        "insurance_products": grouped(
            counters["product"], amounts["product"], premiums["product"]
        ),
        "insurers": grouped(
            counters["insurer"], amounts["insurer"], premiums["insurer"]
        ),
        "nominee_relationship": grouped(
            counters["nominee"], amounts["nominee"], premiums["nominee"]
        ),
    }
    return result


def build_single_business_trends(rows):
    """Additional exact-frequency trends used only by Single Report Analysis."""
    counters = {
        "premium_amounts": Counter(),
        "gender": Counter(),
        "country": Counter(),
        "payment_modes": Counter(),
    }
    amounts = {key: defaultdict(float) for key in counters}

    for item in rows:
        premium = float(item["amount"])
        premium_label = (
            f"₹{premium:,.0f}" if premium.is_integer() else f"₹{premium:,.2f}"
        )
        counters["premium_amounts"][premium_label] += 1
        amounts["premium_amounts"][premium_label] += premium

        for key, value in [
            ("gender", item.get("gender")),
            ("country", item.get("country")),
            ("payment_modes", item.get("payment_mode")),
        ]:
            if value:
                counters[key][value] += 1
                amounts[key][value] += premium

    result = {}
    for key in counters:
        result[key] = grouped(counters[key], amounts[key], amounts[key])
        for row in result[key]:
            row["average"] = round(row["amount"] / row["count"], 2)
    return result
