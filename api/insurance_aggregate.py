from __future__ import annotations
from collections import Counter, defaultdict
from datetime import datetime
from api.insurance_utils import age_band, premium_band


def grouped(counter: Counter, amounts=None, premiums=None):
    result = []
    for label, count in counter.most_common():
        row = {"label": label, "count": count}
        if amounts is not None: row["amount"] = round(amounts[label], 2)
        if premiums is not None: row["premium"] = round(premiums[label], 2)
        result.append(row)
    return result


def score_plans(plan_rows):
    if not plan_rows: return []
    maxima = {
        "count": max(row["count"] for row in plan_rows) or 1,
        "amount": max(row["amount"] for row in plan_rows) or 1,
        "batch_count": max(row["batch_count"] for row in plan_rows) or 1,
        "sum_insured_enrollments": max(row["sum_insured_enrollments"] for row in plan_rows) or 1,
    }
    scored = []
    for row in plan_rows:
        score = (
            .35 * row["count"] / maxima["count"] + .35 * row["amount"] / maxima["amount"]
            + .15 * row["batch_count"] / maxima["batch_count"]
            + .15 * row["sum_insured_enrollments"] / maxima["sum_insured_enrollments"]
        ) * 100
        scored.append({**row, "suitability_score": round(score, 1)})
    return sorted(scored, key=lambda row: row["suitability_score"], reverse=True)


def build_analysis(rows):
    daily = defaultdict(lambda: [0, 0., 0.]); monthly = defaultdict(lambda: [0, 0., 0.]); yearly = defaultdict(lambda: [0, 0., 0.])
    month_year = defaultdict(lambda: [0, 0., 0.]); plan_month = defaultdict(lambda: [0, 0., 0.]); plan_year = defaultdict(lambda: [0, 0., 0.])
    plan_sum = defaultdict(lambda: [0, 0., 0.]); plan_batch = defaultdict(lambda: [0, 0., 0.])
    counters = {key: Counter() for key in ["policy","sum","premium_band","age","state","city","pincode","course","passing","product","insurer","nominee","plan"]}
    amounts = {key: defaultdict(float) for key in ["sum","premium_band","age","state","city","pincode","course","passing","product","insurer","nominee","plan"]}
    premiums = {key: defaultdict(float) for key in amounts}
    plan_members = defaultdict(set); plan_batches = defaultdict(set); plan_cover = Counter()

    for item in rows:
        for bucket, key in [(daily, item["date"].isoformat()), (monthly, item["date"].strftime("%Y-%m")), (yearly, item["year"])]:
            bucket[key][0] += 1; bucket[key][1] += item["amount"]; bucket[key][2] += item["premium"]
        my = (item["year"], item["month_number"], item["month_label"])
        month_year[my][0] += 1; month_year[my][1] += item["amount"]; month_year[my][2] += item["premium"]
        pm = (item["plan"], item["date"].strftime("%Y-%m"), item["month_period"])
        plan_month[pm][0] += 1; plan_month[pm][1] += item["amount"]; plan_month[pm][2] += item["premium"]
        py = (item["plan"], item["year"])
        plan_year[py][0] += 1; plan_year[py][1] += item["amount"]; plan_year[py][2] += item["premium"]
        counters["plan"][item["plan"]] += 1; amounts["plan"][item["plan"]] += item["amount"]; premiums["plan"][item["plan"]] += item["premium"]
        if item["export"]["member_name"]: plan_members[item["plan"]].add(item["export"]["member_name"].lower())
        if item["passing_year"]: plan_batches[item["plan"]].add(item["passing_year"])
        if item["policy"]: counters["policy"][item["policy"]] += 1
        if item["sum_insured"] and item["sum_insured"] > 0:
            cover = f"₹{item['sum_insured']:,.0f}"; plan_cover[item["plan"]] += 1
            counters["sum"][cover] += 1; amounts["sum"][cover] += item["amount"]; premiums["sum"][cover] += item["premium"]
            key = (item["plan"], cover); plan_sum[key][0] += 1; plan_sum[key][1] += item["amount"]; plan_sum[key][2] += item["premium"]
        if item["premium"] > 0:
            band = premium_band(item["premium"]); counters["premium_band"][band] += 1; amounts["premium_band"][band] += item["amount"]; premiums["premium_band"][band] += item["premium"]
        if item["age"] is not None:
            band = age_band(item["age"]); counters["age"][band] += 1; amounts["age"][band] += item["amount"]; premiums["age"][band] += item["premium"]
        for value, key in [(item["state"],"state"),(item["city"],"city"),(item["pincode"],"pincode"),(item["course"],"course"),(item["passing_year"],"passing"),(item["insurance_product"],"product"),(item["insurer"],"insurer"),(item["nominee_relationship"],"nominee")]:
            if value: counters[key][value] += 1; amounts[key][value] += item["amount"]; premiums[key][value] += item["premium"]
        if item["passing_year"]:
            key = (item["plan"], item["passing_year"]); plan_batch[key][0] += 1; plan_batch[key][1] += item["amount"]; plan_batch[key][2] += item["premium"]

    def trends(bucket, formatter=lambda key: key):
        return [{"label": formatter(key), "count": int(v[0]), "amount": round(v[1],2), "premium": round(v[2],2)} for key,v in sorted(bucket.items())]
    plan_rows = [{"label": plan,"count": counters["plan"][plan],"amount": round(amounts["plan"][plan],2),"premium": round(premiums["plan"][plan],2),"unique_members": len(plan_members[plan]),"batch_count": len(plan_batches[plan]),"sum_insured_enrollments": plan_cover[plan]} for plan in counters["plan"]]
    result = {
        "daily_trend": trends(daily, lambda key: datetime.strptime(key,"%Y-%m-%d").strftime("%d/%b/%Y")),
        "monthly_trend": trends(monthly, lambda key: datetime.strptime(key,"%Y-%m").strftime("%b %Y")),
        "yearly_trend": trends(yearly),
        "month_by_year": [{"label": month,"series": year,"sort": num,"count": int(v[0]),"amount": round(v[1],2),"premium": round(v[2],2)} for (year,num,month),v in sorted(month_year.items())],
        "plan_month_comparison": [{"label": display,"series": plan,"period": period,"count": int(v[0]),"amount": round(v[1],2),"premium": round(v[2],2)} for (plan,period,display),v in sorted(plan_month.items(), key=lambda x:(x[0][1],x[0][0]))],
        "plan_year_comparison": [{"label": year,"series": plan,"count": int(v[0]),"amount": round(v[1],2),"premium": round(v[2],2)} for (plan,year),v in sorted(plan_year.items(), key=lambda x:(x[0][1],x[0][0]))],
        "plan_sum_insured": [{"label": cover,"series": plan,"count": int(v[0]),"amount": round(v[1],2),"premium": round(v[2],2)} for (plan,cover),v in sorted(plan_sum.items(), key=lambda x:(x[0][1],x[0][0]))],
        "plan_batch_comparison": [{"label": batch,"series": plan,"count": int(v[0]),"amount": round(v[1],2),"premium": round(v[2],2)} for (plan,batch),v in sorted(plan_batch.items(), key=lambda x:(x[0][1],x[0][0]))],
        "plan_comparison": plan_rows,
        "plan_recommendation": score_plans(plan_rows),
        "policy": grouped(counters["policy"]), "sum_insured": grouped(counters["sum"], amounts["sum"], premiums["sum"]),
        "premium_bands": grouped(counters["premium_band"], amounts["premium_band"], premiums["premium_band"]),
        "age": grouped(counters["age"], amounts["age"], premiums["age"]), "state": grouped(counters["state"], amounts["state"], premiums["state"]),
        "city": grouped(counters["city"], amounts["city"], premiums["city"]), "pincode": grouped(counters["pincode"], amounts["pincode"], premiums["pincode"]),
        "course": grouped(counters["course"], amounts["course"], premiums["course"]), "passing_year": grouped(counters["passing"], amounts["passing"], premiums["passing"]),
        "insurance_products": grouped(counters["product"], amounts["product"], premiums["product"]), "insurers": grouped(counters["insurer"], amounts["insurer"], premiums["insurer"]),
        "nominee_relationship": grouped(counters["nominee"], amounts["nominee"], premiums["nominee"]),
    }
    return result
