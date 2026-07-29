from __future__ import annotations
import json
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from api.insurance_aggregate import build_analysis
from api.insurance_extract import clean_rows, extract_rows
from api.insurance_response import build_response

app = FastAPI()

@app.post("/")
async def analyze(files: list[UploadFile] = File(...), password: str = Form(""), file_labels: str = Form("[]"), college_name: str = Form("")):
    try:
        labels = json.loads(file_labels)
        if not isinstance(labels, list): labels = []
    except json.JSONDecodeError:
        labels = []
    raw_rows, logs = await extract_rows(files, password, labels, college_name)
    if not raw_rows: raise HTTPException(400, "No usable data sheet was found")
    rows, has_policy, cleaning = clean_rows(raw_rows)
    if not rows: raise HTTPException(400, "No rows remain after Transaction Date cleaning")
    analysis = build_analysis(rows)
    return build_response(rows, has_policy, analysis, len(raw_rows), cleaning, logs, college_name, len(files))
