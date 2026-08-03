from __future__ import annotations

import json

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.gzip import GZipMiddleware

from api.insurance_extract import extract_rows
from api.insurance_transfer import pack_prepared_rows


app = FastAPI()
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.post("/api/prepare")
async def prepare_report(
    files: list[UploadFile] = File(...),
    password: str = Form(""),
    file_labels: str = Form("[]"),
    file_years: str = Form("[]"),
    college_name: str = Form(""),
):
    if len(files) != 1:
        raise HTTPException(400, "Prepare exactly one report file per request")

    try:
        labels = json.loads(file_labels)
        labels = labels if isinstance(labels, list) else []
    except json.JSONDecodeError:
        labels = []

    try:
        years = json.loads(file_years)
        years = years if isinstance(years, list) else []
    except json.JSONDecodeError:
        years = []

    raw_rows, logs = await extract_rows(
        files, password, labels, college_name, years
    )
    if not raw_rows:
        raise HTTPException(
            400,
            "No usable data sheet was found. Ensure the workbook contains a premium/amount column.",
        )

    return Response(
        content=pack_prepared_rows(raw_rows, logs),
        media_type="application/octet-stream",
        headers={"X-Rows-Extracted": str(len(raw_rows))},
    )
