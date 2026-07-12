"""Aggregate — per-company performance summary (one row per order_id)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd
from fastapi import APIRouter, Query

from app.store.db import cursor
from app.store.queries import get_monthly_by_company
from backend.schemas import AggregateCompany, MonthlyPoint

router = APIRouter()

_SQL = """
    SELECT
        order_id AS company,
        COUNT(*) AS total,
        SUM(CASE WHEN current_status='Delivered'  THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN current_status IN ('In Transit','Dispatched','Manifested')
                 THEN 1 ELSE 0 END)                                   AS in_transit,
        SUM(CASE WHEN current_status='Pending'    THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN current_status='RTO'        THEN 1 ELSE 0 END) AS rto,
        SUM(CASE WHEN _sla_status='Early'   THEN 1 ELSE 0 END)       AS early,
        SUM(CASE WHEN _sla_status='On Time' THEN 1 ELSE 0 END)       AS on_time,
        SUM(CASE WHEN _sla_status='Late'    THEN 1 ELSE 0 END)       AS late,
        SUM(CASE WHEN _oda='YES' THEN 1 ELSE 0 END)                  AS oda_count,
        AVG(_actual_tat_days)                                        AS avg_actual_tat
    FROM shipments_latest
    GROUP BY order_id
    ORDER BY total DESC
"""


def aggregate_companies() -> list[AggregateCompany]:
    with cursor() as cur:
        cur.execute(_SQL)
        rows = cur.fetchall()

    out: list[AggregateCompany] = []
    for r in rows:
        delivered = int(r["delivered"] or 0)
        early = int(r["early"] or 0)
        on_time = int(r["on_time"] or 0)
        eot = round((early + on_time) / delivered * 100, 1) if delivered > 0 else 0.0
        out.append(AggregateCompany(
            company=r["company"] or "Unknown",
            total=int(r["total"] or 0),
            delivered=delivered,
            in_transit=int(r["in_transit"] or 0),
            pending=int(r["pending"] or 0),
            rto=int(r["rto"] or 0),
            early=early,
            on_time=on_time,
            late=int(r["late"] or 0),
            eot_percent=eot,
            oda_count=int(r["oda_count"] or 0),
            avg_actual_tat=round(r["avg_actual_tat"], 1) if r["avg_actual_tat"] is not None else 0.0,
        ))
    return out


@router.get("/companies", response_model=list[AggregateCompany])
def companies() -> list[AggregateCompany]:
    return aggregate_companies()


@router.get("/monthly", response_model=list[MonthlyPoint])
def monthly(company: str = Query(...)) -> list[MonthlyPoint]:
    """Per-month Early/On Time/Late/Not-Delivered for one company."""
    df = get_monthly_by_company()
    df = df[df["company"] == company].copy()
    if df.empty:
        return []
    df = df.sort_values("month")
    labels = pd.to_datetime(df["month"] + "-01").dt.strftime("%b %Y").tolist()
    return [
        MonthlyPoint(
            month=labels[i],
            early=int(r["early"]),
            on_time=int(r["on_time"]),
            late=int(r["late"]),
            not_delivered=int(r["not_delivered"]),
        )
        for i, (_, r) in enumerate(df.iterrows())
    ]
