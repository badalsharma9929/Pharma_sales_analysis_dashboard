from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.gzip import GZipMiddleware

from api.insurance_pipeline import analyze_raw_rows
from api.insurance_transfer import MAX_COMBINED_ROWS, unpack_prepared_rows


app = FastAPI()
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.post("/api/combine")
async def combine_reports(
    tokens: list[UploadFile] = File(...),
    college_name: str = Form(""),
    file_count: int = Form(0),
):
    if not tokens:
        raise HTTPException(400, "Prepare at least one report file before analysis")
    if len(tokens) > 20:
        raise HTTPException(400, "A maximum of 20 report files can be analysed")

    raw_rows, logs = [], []
    for token in tokens:
        token_rows, token_logs = unpack_prepared_rows(await token.read())
        raw_rows.extend(token_rows)
        logs.extend(token_logs)
        if len(raw_rows) > MAX_COMBINED_ROWS:
            raise HTTPException(413, "The combined reports exceed 200,000 rows")

    return analyze_raw_rows(
        raw_rows,
        logs,
        college_name,
        file_count or len(tokens),
    )
