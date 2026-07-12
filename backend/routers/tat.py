"""TAT Analysis — delivered orders + E+OT summary + ODA performance chart.

Queried directly from shipments_latest. TAT = Delivered Date − Manifest Date
is already stored as _actual_tat_days by the pipeline; we only read here.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter

from app.store.db import cursor
from backend.schemas import TatSummary
from backend.transit_risk import fmt_date

router = APIRouter()

_ORDERS_SQL = """
    SELECT lrn, order_id, consignee_name, manifest_date, delivered_date,
           destination_city, state, pin_code,
           _origin_zone, _destination_zone, _oda,
           _expected_tat_days, _actual_tat_days, _tat_variance_days, _sla_status
    FROM shipments_latest
    WHERE current_status = 'Delivered' AND manifest_date IS NOT NULL
"""

_SUMMARY_SQL = """
    SELECT
        COUNT(*)                                                    AS total_delivered,
        SUM(CASE WHEN _sla_status='Early'   THEN 1 ELSE 0 END)      AS early,
        SUM(CASE WHEN _sla_status='On Time' THEN 1 ELSE 0 END)      AS on_time,
        SUM(CASE WHEN _sla_status='Late'    THEN 1 ELSE 0 END)      AS late,
        SUM(CASE WHEN _oda='YES' THEN 1 ELSE 0 END)                 AS oda_total,
        SUM(CASE WHEN _oda='YES' AND _sla_status IN ('Early','On Time')
                 THEN 1 ELSE 0 END)                                 AS oda_eot,
        SUM(CASE WHEN _oda='NO' THEN 1 ELSE 0 END)                  AS non_total,
        SUM(CASE WHEN _oda='NO' AND _sla_status IN ('Early','On Time')
                 THEN 1 ELSE 0 END)                                 AS non_eot,
        AVG(_actual_tat_days)                                       AS avg_actual_tat,
        AVG(_expected_tat_days)                                     AS avg_expected_tat
    FROM shipments_latest
    WHERE current_status = 'Delivered'
"""

_ODA_CHART_SQL = """
    SELECT _oda,
        SUM(CASE WHEN _sla_status='Early'   THEN 1 ELSE 0 END) AS early,
        SUM(CASE WHEN _sla_status='On Time' THEN 1 ELSE 0 END) AS on_time,
        SUM(CASE WHEN _sla_status='Late'    THEN 1 ELSE 0 END) AS late,
        COUNT(*) AS total
    FROM shipments_latest
    WHERE current_status='Delivered'
      AND _oda IN ('YES','NO')
      AND _sla_status IN ('Early','On Time','Late')
    GROUP BY _oda
"""


def tat_records() -> list[dict]:
    """Delivered orders (manifest not null) as display dicts (shared with export)."""
    with cursor() as cur:
        cur.execute(_ORDERS_SQL)
        rows = cur.fetchall()
    return [
        {
            "lrn": r["lrn"],
            "order_id": r["order_id"],
            "consignee_name": r["consignee_name"],
            "manifest_date": fmt_date(r["manifest_date"]),
            "delivered_date": fmt_date(r["delivered_date"]),
            "destination_city": r["destination_city"],
            "state": r["state"],
            "pin_code": str(r["pin_code"]) if r["pin_code"] is not None else None,
            "_origin_zone": r["_origin_zone"],
            "_destination_zone": r["_destination_zone"],
            "_oda": r["_oda"],
            "_expected_tat_days": r["_expected_tat_days"],
            "_actual_tat_days": r["_actual_tat_days"],
            "_tat_variance_days": r["_tat_variance_days"],
            "_sla_status": r["_sla_status"],
        }
        for r in rows
    ]


@router.get("/orders")
def tat_orders() -> list[dict]:
    return tat_records()


def _pct(n: int, d: int) -> float:
    return round(n / d * 100, 1) if d > 0 else 0.0


@router.get("/summary", response_model=TatSummary)
def tat_summary() -> TatSummary:
    with cursor() as cur:
        cur.execute(_SUMMARY_SQL)
        r = cur.fetchone()

    total = int(r["total_delivered"] or 0)
    early = int(r["early"] or 0)
    on_time = int(r["on_time"] or 0)
    late = int(r["late"] or 0)
    oda_total = int(r["oda_total"] or 0)
    oda_eot = int(r["oda_eot"] or 0)
    non_total = int(r["non_total"] or 0)
    non_eot = int(r["non_eot"] or 0)

    return TatSummary(
        total_delivered=total,
        early=early,
        on_time=on_time,
        late=late,
        eot_percent=_pct(early + on_time, total),
        oda_eot_percent=_pct(oda_eot, oda_total),
        non_oda_eot_percent=_pct(non_eot, non_total),
        avg_actual_tat=round(r["avg_actual_tat"], 1) if r["avg_actual_tat"] is not None else 0.0,
        avg_expected_tat=round(r["avg_expected_tat"], 1) if r["avg_expected_tat"] is not None else 0.0,
    )


@router.get("/oda-chart")
def tat_oda_chart() -> dict:
    """ODA vs Non-ODA performance. Groups with 0 rows are omitted entirely
    (prevents the phantom empty-bar bug from the Streamlit version)."""
    with cursor() as cur:
        cur.execute(_ODA_CHART_SQL)
        rows = cur.fetchall()

    out: dict[str, dict] = {}
    for r in rows:
        total = int(r["total"] or 0)
        if total <= 0:
            continue
        group = {
            "early": int(r["early"] or 0),
            "on_time": int(r["on_time"] or 0),
            "late": int(r["late"] or 0),
            "total": total,
        }
        if r["_oda"] == "YES":
            out["oda"] = group
        elif r["_oda"] == "NO":
            out["non_oda"] = group
    return out
