from __future__ import annotations
import statistics
from datetime import datetime
from api.insurance_config import EXPORT_COLUMNS, POLICY_COLUMN
from api.insurance_utils import text


def build_response(rows, has_policy, analysis, raw_count, cleaning, logs, college, file_count):
    columns = EXPORT_COLUMNS.copy()
    if has_policy: columns.insert(8, POLICY_COLUMN)
    cleaned = [{column: item["export"].get(column, "") for column in columns} for item in rows]
    analysis_rows = [{**{column: item["export"].get(column, "") for column in columns}, "Analysis_Plan": item["plan"], "College": item["college"], "Source_File": item["file"], "Transaction_Year": item["year"]} for item in rows]
    total_amount = sum(item["amount"] for item in rows); total_premium = sum(item["premium"] for item in rows)
    yearly = analysis["yearly_trend"]; recommendation = analysis["plan_recommendation"]; sums = analysis["sum_insured"]; states = analysis["state"]; batches = analysis["passing_year"]
    insights = []
    if yearly:
        best = max(yearly, key=lambda row: row["amount"]); insights.append(f"{best['label']} is the strongest transaction year with ₹{best['amount']:,.0f} in transaction value.")
    if recommendation:
        best = recommendation[0]; insights.append(f"{best['label']} currently ranks as the most suitable plan for {text(college) or 'the college'} based on transaction volume, sales value, batch reach and sum-insured enrolments (score {best['suitability_score']}/100).")
    if sums: insights.append(f"{sums[0]['label']} is the most frequently selected sum insured with {sums[0]['count']} enrolments.")
    if states: insights.append(f"{states[0]['label']} is the leading state by transaction count.")
    if batches: insights.append(f"Batch {batches[0]['label']} has the highest participation with {batches[0]['count']} records.")
    if len(yearly) >= 2 and yearly[-2]["amount"]:
        growth = (yearly[-1]["amount"] - yearly[-2]["amount"]) / yearly[-2]["amount"] * 100
        insights.append(f"Transaction value changed by {growth:+.1f}% in {yearly[-1]['label']} versus {yearly[-2]['label']}.")
    return {
        "meta": {"export_columns": columns,"policy_included": has_policy,"processed_at": datetime.now().isoformat(timespec="seconds"),"files_processed": file_count,"college_name": text(college),"plans": [row["label"] for row in analysis["plan_comparison"]]},
        "kpis": {"total_records": len(rows),"unique_members": len({item["export"]["member_name"].lower() for item in rows if item["export"]["member_name"]}),"total_transaction_amount": round(total_amount,2),"average_transaction_amount": round(total_amount/len(rows),2),"median_transaction_amount": round(statistics.median(item["amount"] for item in rows),2),"total_premium": round(total_premium,2),"average_premium": round(total_premium/len(rows),2),"most_selected_sum_insured": sums[0]["label"] if sums else "Not available","top_plan": recommendation[0]["label"] if recommendation else "Not available","years_compared": len(yearly),"plans_compared": len(analysis["plan_comparison"])},
        "cleaned_rows": cleaned,"analysis_rows": analysis_rows,"analysis": analysis,"insights": insights,
        "data_quality": {"rows_before_cleaning": raw_count,**cleaning,"final_rows": len(rows),"processing_log": logs},
    }
