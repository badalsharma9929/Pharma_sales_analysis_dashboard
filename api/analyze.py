from __future__ import annotations

import io, math, re, statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any

import msoffcrypto
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from openpyxl import load_workbook

app = FastAPI()

EXPORT = ["member_name","email","Care_Email","contact_number","Alternate_Contact","Transaction_Date","transaction_amount","transaction_id","passing_year","course"]
POLICY = "Policy (New/Renewal)"
ALIASES = {
"member_name":["member name","member_name","full name","customer name","student name","name"],
"email":["email","email id","email address","personal email"],
"Care_Email":["care email","care_email","care email id","care email address"],
"contact_number":["contact number","contact_number","contact no","mobile number","mobile no","phone number"],
"Alternate_Contact":["alternate contact","alternate_contact","alternate number","alternate mobile","secondary contact"],
"Transaction_Date":["transaction date","transaction_date","payment date","txn date","date of transaction"],
"transaction_amount":["transaction amount","transaction_amount","payment amount","paid amount","txn amount","amount"],
"transaction_id":["transaction id","transaction_id","txn id","payment id","reference id","utr","receipt number"],
POLICY:["policy new renewal","policy (new renewal)","new renewal","new/renewal","policy status","new or renewal"],
"passing_year":["passing year","passing_year","year of passing","graduation year","passout year"],
"course":["course","course name","program","programme","program name"],
}
EXTRA = {
"dob":["dob","date of birth","birth date"],"age":["age","member age"],"gender":["gender","sex"],
"city":["city","town"],"state":["state","province"],"country":["country","nation"],"pincode":["pincode","pin code","postal code"],
"sum_insured":["sum insured","sum_insured","sum assured","coverage amount","cover amount"],
"premium":["premium inc gst","premium_inc_gst","premium including gst","gross premium","premium"],
"insurer":["insurer","insurance company","carrier"],"plan_name":["plan name","plan_name","insurance plan","product name"],
"policy_type":["policy type","policy_type","insurance type"],"policy_name":["policy name","policy_name"],
"pay_mode":["pay mode","pay_mode","payment mode"],"relationship":["relationship","member relationship"]
}

def norm(v:Any)->str:
    s="" if v is None else str(v).strip().lower().replace("&"," and ")
    s=re.sub(r"[()\[\]{}\\/\-]+"," ",s); s=re.sub(r"[^a-z0-9]+","_",s)
    return re.sub(r"_+","_",s).strip("_")

def text(v:Any)->str:
    if v is None:return ""
    if isinstance(v,float) and math.isnan(v):return ""
    s=str(v).strip(); return "" if s.lower() in {"nan","none","null","nat"} else re.sub(r"\s+"," ",s)

def number(v:Any):
    if v is None or isinstance(v,bool):return None
    if isinstance(v,(int,float)):return None if isinstance(v,float) and math.isnan(v) else float(v)
    s=re.sub(r"[^0-9.\-]","",text(v).replace(",",""))
    try:return float(s)
    except:return None

def phone(v:Any)->str:
    d=re.sub(r"\D","",text(v))
    if not d or set(d)=={"0"}:return ""
    if d.startswith("0091") and len(d)>=14:d=d[4:]
    elif d.startswith("91") and len(d)>=12:d=d[2:]
    elif d.startswith("0") and len(d)==11:d=d[1:]
    return d[-10:] if len(d)>10 else d

def dt(v:Any):
    if v in (None,"",0,"0","0.0"):return None
    if isinstance(v,datetime):return v.date()
    if isinstance(v,date):return v
    if isinstance(v,(int,float)) and 1<=float(v)<=100000:return (datetime(1899,12,30)+timedelta(days=float(v))).date()
    s=text(v)
    for f in ["%d/%b/%y","%d/%b/%Y","%d-%b-%y","%d-%b-%Y","%d/%m/%Y","%d/%m/%y","%d-%m-%Y","%d-%m-%y","%Y-%m-%d","%Y/%m/%d","%m/%d/%Y"]:
        try:return datetime.strptime(s,f).date()
        except:pass
    return None

def policy(v:Any)->str:
    n=norm(v)
    if n in {"new","n","new_policy","new_member"}:return "New"
    if n in {"renewal","renew","renewed","r","policy_renewal"}:return "Renewal"
    return ""

def decrypt(raw:bytes,password:str)->bytes:
    if raw[:2]==b"PK":return raw
    try:
        f=msoffcrypto.OfficeFile(io.BytesIO(raw)); f.load_key(password=password); out=io.BytesIO(); f.decrypt(out); return out.getvalue()
    except Exception as e:raise HTTPException(400,f"Could not unlock workbook. Check password. ({e})")

def band_age(a:int):
    return "Under 18" if a<18 else "18–25" if a<=25 else "26–35" if a<=35 else "36–45" if a<=45 else "46–55" if a<=55 else "56–65" if a<=65 else "66+"
def band_premium(v:float):
    return "Below ₹10,000" if v<10000 else "₹10,000–₹24,999" if v<25000 else "₹25,000–₹49,999" if v<50000 else "₹50,000–₹99,999" if v<100000 else "₹100,000+"
def grouped(c:Counter,t=None,limit=20):
    out=[]
    for label,count in c.most_common(limit):
        r={"label":label,"count":count}
        if t is not None:r.update(amount=round(t[label],2),average=round(t[label]/count,2))
        out.append(r)
    return out

@app.post("/")
async def analyze(files:list[UploadFile]=File(...),password:str=Form("")):
    raw_rows=[]; logs=[]
    alias={k:{norm(x) for x in v+[k]} for k,v in ALIASES.items()}; extra={k:{norm(x) for x in v+[k]} for k,v in EXTRA.items()}
    for upload in files:
        raw=await upload.read()
        if len(raw)>15*1024*1024:raise HTTPException(413,f"{upload.filename} exceeds 15 MB")
        try:wb=load_workbook(io.BytesIO(decrypt(raw,password)),read_only=True,data_only=True)
        except HTTPException:raise
        except Exception as e:raise HTTPException(400,f"Unable to read {upload.filename}: {e}")
        used=extracted=0
        for ws in wb.worksheets:
            best=None
            for rn,row in enumerate(ws.iter_rows(min_row=1,max_row=min(15,ws.max_row),values_only=True),1):
                hs=[norm(x) for x in row]; score=sum(any(h in a for a in alias.values()) or any(h in a for a in extra.values()) for h in hs)+5*any(h in alias["Transaction_Date"] for h in hs)
                if best is None or score>best[0]:best=(score,rn,list(row),hs)
            if not best or best[0]<5:continue
            _,hr,headers,hs=best; mapping={}; dims={}
            for k,a in alias.items():
                for i,h in enumerate(hs):
                    if h in a:mapping[k]=i;break
            for k,a in extra.items():
                for i,h in enumerate(hs):
                    if h in a:dims[k]=i;break
            if "Transaction_Date" not in mapping or len(mapping)<4:continue
            used+=1
            for row in ws.iter_rows(min_row=hr+1,values_only=True):
                if not any(x not in (None,"") for x in row):continue
                get=lambda i: row[i] if i is not None and i<len(row) else None
                rec={k:get(mapping.get(k)) for k in EXPORT+[POLICY]}; rec.update({k:get(i) for k,i in dims.items()}); raw_rows.append(rec);extracted+=1
        logs.append({"file":upload.filename,"sheets_used":used,"rows_extracted":extracted})
    if not raw_rows:raise HTTPException(400,"No usable data sheet found")
    rows=[]; invalid=exact_dup=id_dup=0; exact_seen=set(); ids=set(); has_policy=False
    for r in raw_rows:
        d=dt(r.get("Transaction_Date"))
        if not d:invalid+=1;continue
        tid=text(r.get("transaction_id"));tid=tid[:-2] if tid.endswith(".0") and tid[:-2].isdigit() else tid
        p=policy(r.get(POLICY));has_policy=has_policy or bool(p)
        export={"member_name":text(r.get("member_name")),"email":text(r.get("email")).lower(),"Care_Email":text(r.get("Care_Email")).lower(),"contact_number":phone(r.get("contact_number")),"Alternate_Contact":phone(r.get("Alternate_Contact")),"Transaction_Date":d.isoformat(),"transaction_amount":round(number(r.get("transaction_amount")) or 0,2),"transaction_id":tid,POLICY:p,"passing_year":text(r.get("passing_year")),"course":text(r.get("course"))}
        key=tuple(export.values())
        if key in exact_seen:exact_dup+=1;continue
        exact_seen.add(key)
        if tid and tid in ids:id_dup+=1;continue
        if tid:ids.add(tid)
        prem=number(r.get("premium")) or export["transaction_amount"]; si=number(r.get("sum_insured"))
        age=None;dob=dt(r.get("dob"));av=number(r.get("age"))
        if dob:age=d.year-dob.year-((d.month,d.day)<(dob.month,dob.day))
        elif av is not None and 0<=av<=120:age=int(av)
        products=[]
        for k in ["plan_name","policy_type","policy_name"]:
            v=text(r.get(k))
            if v and v not in products:products.append(v)
        rows.append({"export":export,"date":d,"amount":export["transaction_amount"],"premium":round(prem,2),"sum_insured":si,"age":age,"state":text(r.get("state")).title(),"city":text(r.get("city")).title(),"country":text(r.get("country")).upper(),"course":export["course"],"passing_year":export["passing_year"],"insurance_product":" • ".join(products),"insurer":text(r.get("insurer")),"gender":text(r.get("gender")).title(),"relationship":text(r.get("relationship")).title(),"pay_mode":text(r.get("pay_mode")).title(),"policy":p})
    if not rows:raise HTTPException(400,"No rows remain after Transaction Date cleaning")
    cols=EXPORT.copy();
    if has_policy:cols.insert(8,POLICY)
    cleaned=[{c:x["export"].get(c,"") for c in cols} for x in sorted(rows,key=lambda x:x["date"],reverse=True)]
    daily=defaultdict(lambda:[0,0.,0.]);monthly=defaultdict(lambda:[0,0.,0.]); pc=Counter(); sic=Counter();sit=defaultdict(float);sip=defaultdict(float); pbc=Counter();pbt=defaultdict(float)
    ac=Counter();at=defaultdict(float); sc=Counter();st=defaultdict(float); cc=Counter();ct=defaultdict(float); coc=Counter();cot=defaultdict(float); prc=Counter();prt=defaultdict(float); inc=Counter();intot=defaultdict(float); gc=Counter();rc=Counter();payc=Counter()
    for x in rows:
        for bucket,key in [(daily,x["date"].isoformat()),(monthly,x["date"].strftime("%Y-%m"))]:bucket[key][0]+=1;bucket[key][1]+=x["amount"];bucket[key][2]+=x["premium"]
        if x["policy"]:pc[x["policy"]]+=1
        if x["sum_insured"] and x["sum_insured"]>0:
            l=f"₹{x['sum_insured']:,.0f}";sic[l]+=1;sit[l]+=x["amount"];sip[l]+=x["premium"]
        if x["premium"]>0:l=band_premium(x["premium"]);pbc[l]+=1;pbt[l]+=x["premium"]
        if x["age"] is not None:l=band_age(x["age"]);ac[l]+=1;at[l]+=x["amount"]
        for v,c,t in [(x["state"],sc,st),(x["course"],coc,cot),(x["insurance_product"],prc,prt),(x["insurer"],inc,intot)]:
            if v:c[v]+=1;t[v]+=x["amount"]
        if x["city"]:cc[x["city"]]+=1;ct[x["city"]]+=x["amount"]
        if x["gender"]:gc[x["gender"]]+=1
        if x["relationship"]:rc[x["relationship"]]+=1
        if x["pay_mode"]:payc[x["pay_mode"]]+=1
    sum_rows=[{"label":l,"count":c,"amount":round(sit[l],2),"premium":round(sip[l],2),"average":round(sip[l]/c,2)} for l,c in sic.most_common()]
    premium_rows=[{"label":l,"count":c,"amount":round(pbt[l],2),"average":round(pbt[l]/c,2)} for l,c in pbc.most_common()]
    total=sum(x["amount"] for x in rows); premium_total=sum(x["premium"] for x in rows)
    top_sum=sum_rows[0] if sum_rows else None;top_course=grouped(coc,cot,1);top_state=grouped(sc,st,1);top_product=grouped(prc,prt,1)
    insights=[]
    if top_sum:insights.append(f"{top_sum['label']} is the most selected sum insured with {top_sum['count']} selections.")
    if premium_rows:
        most=max(premium_rows,key=lambda x:x["count"]);value=max(premium_rows,key=lambda x:x["amount"]);insights += [f"{most['label']} is the most frequently purchased premium band.",f"{value['label']} contributes the highest premium value."]
    if top_state:insights.append(f"{top_state[0]['label']} is the leading state by transaction count.")
    if top_course:insights.append(f"{top_course[0]['label']} is the leading course segment.")
    return {"meta":{"export_columns":cols,"policy_included":has_policy,"processed_at":datetime.now().isoformat(timespec="seconds")},"kpis":{"total_records":len(rows),"unique_members":len({x['export']['member_name'].lower() for x in rows if x['export']['member_name']}),"total_transaction_amount":round(total,2),"average_transaction_amount":round(total/len(rows),2),"median_transaction_amount":round(statistics.median(x['amount'] for x in rows),2),"total_premium":round(premium_total,2),"average_premium":round(premium_total/len(rows),2),"new_count":pc.get('New',0),"renewal_count":pc.get('Renewal',0),"most_selected_sum_insured":top_sum['label'] if top_sum else 'Not available',"top_state":top_state[0]['label'] if top_state else 'Not available',"top_course":top_course[0]['label'] if top_course else 'Not available',"top_insurance_product":top_product[0]['label'] if top_product else 'Not available'},"cleaned_rows":cleaned,"analysis":{"daily_trend":[{"label":k,"count":v[0],"amount":round(v[1],2),"premium":round(v[2],2)} for k,v in sorted(daily.items())],"monthly_trend":[{"label":k,"count":v[0],"amount":round(v[1],2),"premium":round(v[2],2)} for k,v in sorted(monthly.items())],"policy":grouped(pc),"sum_insured":sum_rows,"premium_bands":premium_rows,"age":grouped(ac,at),"state":grouped(sc,st),"city":grouped(cc,ct),"course":grouped(coc,cot),"insurance_products":grouped(prc,prt),"insurers":grouped(inc,intot),"gender":grouped(gc),"relationship":grouped(rc),"pay_mode":grouped(payc)},"insights":insights,"data_quality":{"rows_before_cleaning":len(raw_rows),"invalid_dates_removed":invalid,"exact_duplicates_removed":exact_dup,"duplicate_transaction_ids_removed":id_dup,"final_rows":len(rows),"processing_log":logs}}
