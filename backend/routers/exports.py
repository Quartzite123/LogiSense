"""Excel export endpoints (CHANGES.md §2.5 — all exports are .xlsx via openpyxl).

Each export reuses the same record builder as its JSON endpoint so the two
never diverge. Internal `_` columns are renamed to friendly headers.
"""
from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.schemas import COLUMN_DISPLAY_NAMES
from backend.routers.tat import tat_records
from backend.routers.transit import transit_records
from backend.routers.aggregate import aggregate_companies
from backend.routers.aggregate_transit import aggregate_transit_companies
from backend.routers.customize import customize_records

router = APIRouter()

_XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _friendly(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(
        columns={k: v for k, v in COLUMN_DISPLAY_NAMES.items() if k in df.columns}
    )


def _xlsx(df: pd.DataFrame, filename: str) -> StreamingResponse:
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type=_XLSX_MEDIA,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/tat")
def export_tat() -> StreamingResponse:
    return _xlsx(_friendly(pd.DataFrame(tat_records())), "logisense_tat.xlsx")


@router.get("/transit")
def export_transit() -> StreamingResponse:
    df = pd.DataFrame(transit_records()).drop(columns=["category"], errors="ignore")
    return _xlsx(_friendly(df), "logisense_transit.xlsx")


@router.get("/aggregate")
def export_aggregate() -> StreamingResponse:
    df = pd.DataFrame([m.model_dump() for m in aggregate_companies()])
    return _xlsx(df, "logisense_aggregate.xlsx")


@router.get("/aggregate-transit")
def export_aggregate_transit() -> StreamingResponse:
    df = pd.DataFrame([m.model_dump() for m in aggregate_transit_companies()])
    return _xlsx(df, "logisense_aggregate_transit.xlsx")


@router.get("/customize")
def export_customize(
    company: str | None = None,
    status: str | None = None,
    sla_status: str | None = None,
    oda: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    zone: str | None = None,
) -> StreamingResponse:
    rows = customize_records(company, status, sla_status, oda, date_from, date_to, zone)
    return _xlsx(_friendly(pd.DataFrame(rows)), "logisense_customize.xlsx")
