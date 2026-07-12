"""POST /api/upload — ingest a Delhivery .xlsx via the existing pipeline.

This is a thin HTTP wrapper. It calls app/pipeline/ingest.py exactly as the
Streamlit upload dialog does: the app uses "always-replace" semantics — clear
shipments once per batch, then ingest the file onto the fresh DB.
"""
from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

# repo root on sys.path so `app.*` resolves even if this router is imported alone
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.pipeline.ingest import IngestError, clear_all_shipments, ingest_file
from app.store.queries import load_latest
from backend.schemas import COLUMN_DISPLAY_NAMES, UploadResponse

router = APIRouter()

_XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an .xlsx file.")

    contents = await file.read()
    try:
        # Mirror the Streamlit app's per-batch behaviour: clear once, then ingest.
        clear_all_shipments()
        summary = ingest_file(BytesIO(contents), file.filename)
    except IngestError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # surface pipeline failures as a clean 500
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")

    # After an always-replace ingest every winner is a fresh insert, but include
    # updates too so the count stays correct if that behaviour ever changes.
    rows_inserted = int(summary["rows_new"]) + int(summary["rows_updated"])
    return UploadResponse(
        success=True,
        rows_inserted=rows_inserted,
        filename=file.filename,
        warnings=summary.get("warnings", []),
    )


@router.get("/export")
def export_latest() -> StreamingResponse:
    """Export shipments_latest as .xlsx (CHANGES.md §2.5 — no CSV exports).

    Internal `_` columns are renamed to friendly headers (COLUMN_DISPLAY_NAMES).
    """
    df = load_latest()
    df = df.rename(
        columns={k: v for k, v in COLUMN_DISPLAY_NAMES.items() if k in df.columns}
    )
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type=_XLSX_MEDIA,
        headers={"Content-Disposition": "attachment; filename=logisense_export.xlsx"},
    )
