"""Landing-page read endpoints.

KPIs are computed with a single aggregate SQL query against shipments_latest
(via the existing db.cursor() helper) — no pipeline logic is rewritten. The
donut + trend endpoints reuse the existing query helpers.
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

# repo root on sys.path so `app.*` resolves even if this router is imported alone
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd
from fastapi import APIRouter

from app.store.db import cursor
from app.store.queries import get_monthly_trend, load_latest
from backend.schemas import DonutData, LandingKPIs, TrendData

router = APIRouter()

# Locked design-system colors (status buckets shown on the landing donut).
_BUCKET_COLORS = {
    "Early": "#4ADE80",
    "On Time": "#60A5FA",
    "Late": "#F87171",
    "Not Yet Delivered": "#94A3B8",
}
_BUCKET_ORDER = ["Early", "On Time", "Late", "Not Yet Delivered"]

# Single aggregate pass over shipments_latest. pickup_date is stored as an ISO
# string, so MIN/MAX is chronological and NULLs are ignored by SQLite.
_KPI_SQL = """
    SELECT
        COUNT(*)                                                        AS total,
        SUM(CASE WHEN current_status='Delivered'  THEN 1 ELSE 0 END)    AS delivered,
        SUM(CASE WHEN current_status NOT IN ('Delivered','RTO')
                 THEN 1 ELSE 0 END)                                     AS in_transit,
        SUM(CASE WHEN current_status='Pending'    THEN 1 ELSE 0 END)    AS pending,
        SUM(CASE WHEN current_status='RTO'        THEN 1 ELSE 0 END)    AS rto,
        SUM(CASE WHEN _sla_status='Early'   THEN 1 ELSE 0 END)          AS early,
        SUM(CASE WHEN _sla_status='On Time' THEN 1 ELSE 0 END)          AS on_time,
        SUM(CASE WHEN _sla_status='Late'    THEN 1 ELSE 0 END)          AS late,
        SUM(CASE WHEN _oda='YES' THEN 1 ELSE 0 END)                     AS oda_count,
        SUM(CASE WHEN _oda='NO'  THEN 1 ELSE 0 END)                     AS non_oda_count,
        SUM(CASE WHEN UPPER(COALESCE(payment_type,'')) LIKE '%COD%'
                   OR UPPER(COALESCE(payment_type,'')) LIKE '%CASH ON DELIVERY%'
                 THEN 1 ELSE 0 END)                                     AS cod_count,
        MIN(manifest_date)                                            AS date_min,
        MAX(manifest_date)                                            AS date_max
    FROM shipments_latest
"""


def _fmt_date(iso: str | None) -> str:
    """ISO timestamp string → 'DD Mon YYYY' (e.g. '15 Jan 2026')."""
    if not iso:
        return "—"
    try:
        return datetime.fromisoformat(iso).strftime("%d %b %Y")
    except (ValueError, TypeError):
        return str(iso)[:10]


@router.get("/kpis", response_model=LandingKPIs)
def landing_kpis() -> LandingKPIs:
    with cursor() as cur:
        cur.execute(_KPI_SQL)
        row = cur.fetchone()  # sqlite3.Row; SUM over empty table → NULL

    total = int(row["total"] or 0)
    if total == 0:
        return LandingKPIs(
            total=0, delivered=0, in_transit=0, pending=0, rto=0,
            early=0, on_time=0, late=0, eot_count=0, eot_percent=0.0,
            oda_count=0, non_oda_count=0, date_min="—", date_max="—",
            cod_count=0, late_count=0, rto_count=0,
        )

    delivered = int(row["delivered"] or 0)
    early = int(row["early"] or 0)
    on_time = int(row["on_time"] or 0)
    late = int(row["late"] or 0)
    rto = int(row["rto"] or 0)
    eot_count = early + on_time
    eot_percent = round(eot_count / delivered * 100, 1) if delivered > 0 else 0.0

    return LandingKPIs(
        total=total,
        delivered=delivered,
        in_transit=int(row["in_transit"] or 0),
        pending=int(row["pending"] or 0),
        rto=rto,
        early=early,
        on_time=on_time,
        late=late,
        eot_count=eot_count,
        eot_percent=eot_percent,
        oda_count=int(row["oda_count"] or 0),
        non_oda_count=int(row["non_oda_count"] or 0),
        date_min=_fmt_date(row["date_min"]),
        date_max=_fmt_date(row["date_max"]),
        cod_count=int(row["cod_count"] or 0),
        late_count=late,
        rto_count=rto,
    )


@router.get("/donut", response_model=DonutData)
def landing_donut() -> DonutData:
    df = load_latest()
    if len(df) == 0:
        return DonutData(labels=[], values=[], colors=[])

    # Bucket exactly like chart_pair._builder_landing: delivered rows keep their
    # SLA status; everything else becomes "Not Yet Delivered".
    is_delivered = df["Current Status"] == "Delivered"
    bucket = df["_sla_status"].where(is_delivered, "Not Yet Delivered")
    bucket = bucket.fillna("Not Yet Delivered")
    counts = bucket.astype(str).value_counts()

    labels: list[str] = []
    values: list[int] = []
    colors: list[str] = []
    seen: set[str] = set()
    for key in _BUCKET_ORDER:
        if key in counts.index:
            labels.append(key)
            values.append(int(counts[key]))
            colors.append(_BUCKET_COLORS[key])
            seen.add(key)
    for key in counts.index:
        if key not in seen:
            labels.append(key)
            values.append(int(counts[key]))
            colors.append("#71717A")

    return DonutData(labels=labels, values=values, colors=colors)


@router.get("/trend", response_model=TrendData)
def landing_trend() -> TrendData:
    df = get_monthly_trend()
    if df.empty:
        return TrendData(months=[], early=[], on_time=[], late=[])

    months = pd.to_datetime(df["month"] + "-01").dt.strftime("%b %Y").tolist()
    return TrendData(
        months=months,
        total_orders=[int(x) for x in df["total_orders"]],
        early=[int(x) for x in df["early"]],
        on_time=[int(x) for x in df["on_time"]],
        late=[int(x) for x in df["late"]],
    )
