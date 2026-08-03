from __future__ import annotations

import json

from fastapi import FastAPI, File, Form, UploadFile

from api.insurance_extract import extract_rows
from api.insurance_pipeline import analyze_raw_rows

app = FastAPI()


@app.post("/")
async def analyze(
    files: list[UploadFile] = File(...),
    password: str = Form(""),
    file_labels: str = Form("[]"),
    file_years: str = Form("[]"),
    college_name: str = Form(""),
    analysis_mode: str = Form("comparison"),
):
    try:
        labels = json.loads(file_labels)
        if not isinstance(labels, list):
            labels = []
    except json.JSONDecodeError:
        labels = []

    try:
        years = json.loads(file_years)
        if not isinstance(years, list):
            years = []
    except json.JSONDecodeError:
        years = []

    raw_rows, logs = await extract_rows(
        files, password, labels, college_name, years
    )
    return analyze_raw_rows(
        raw_rows,
        logs,
        college_name,
        len(files),
        analysis_mode,
    )
