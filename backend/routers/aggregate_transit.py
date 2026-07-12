"""Aggregate Transit — per-company breakdown of non-delivered orders.

Reuses transit_records() so the risk classification is identical to the
Transit section.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from datetime import date

from fastapi import APIRouter, Query

from app.store.db import cursor
from backend.schemas import (
    AggregateTransitCompany,
    CompanyDetailResponse,
    DaysOverdueItem,
    DetailOrder,
    RiskSummaryItem,
)
from backend.routers.transit import transit_records
from backend.transit_risk import fmt_date, to_date

router = APIRouter()


def aggregate_transit_companies() -> list[AggregateTransitCompany]:
    agg: dict[str, dict] = {}
    for d in transit_records():
        company = d["order_id"] or "Unknown"
        row = agg.setdefault(company, {
            "company": company, "total_in_flight": 0, "at_risk": 0,
            "due_today": 0, "on_track": 0, "rto": 0, "pending": 0,
        })
        row["total_in_flight"] += 1
        cat = d["category"]
        if cat == "At Risk":
            row["at_risk"] += 1
        elif cat == "Due Today":
            row["due_today"] += 1
        elif cat == "On Track":
            row["on_track"] += 1
        if d["current_status"] == "RTO":
            row["rto"] += 1
        if d["current_status"] == "Pending":
            row["pending"] += 1

    out = [AggregateTransitCompany(**row) for row in agg.values()]
    out.sort(key=lambda m: m.at_risk, reverse=True)
    return out


@router.get("/companies", response_model=list[AggregateTransitCompany])
def companies() -> list[AggregateTransitCompany]:
    return aggregate_transit_companies()


# The company drill-down uses the original 4-bucket date classification (At Risk
# / Due Today / On Track / Pending) so the Risk Status Summary matches the
# Streamlit version exactly — RTO orders are bucketed by date like any other.
_RISK_ORDER = ["At Risk", "Due Today", "On Track", "Pending"]

_DETAIL_SQL = """
    SELECT lrn, order_id, no_of_boxes, client, manifest_date, pickup_date,
           expected_date, invoice_number, consignee_name,
           current_status, _expected_tat_days
    FROM shipments_latest
    WHERE order_id = ? AND current_status NOT IN ('Delivered')
"""


def _classify4(manifest_iso, pickup_iso, expected, today) -> tuple[str, int | None]:
    """(risk_status, days_remaining). Transit clock = Manifest Date (→ Pickup)."""
    start = to_date(manifest_iso) or to_date(pickup_iso)
    dit = (today - start).days if start is not None else None
    exp = int(expected) if expected is not None else None
    if exp is None or dit is None:
        return "Pending", None
    dr = exp - dit
    if dr < 0:
        return "At Risk", dr
    if dr == 0:
        return "Due Today", dr
    return "On Track", dr


@router.get("/company-detail", response_model=CompanyDetailResponse)
def company_detail(company: str = Query(...)) -> CompanyDetailResponse:
    # NOTE: filter on order_id (the company identifier the dropdown uses); the
    # `client` column is a constant and is returned for display only.
    today = date.today()
    with cursor() as cur:
        cur.execute(_DETAIL_SQL, (company,))
        rows = cur.fetchall()

    counts = {k: 0 for k in _RISK_ORDER}
    overdue: dict[int, int] = {}
    orders: list[DetailOrder] = []

    for r in rows:
        cat, dr = _classify4(r["manifest_date"], r["pickup_date"], r["_expected_tat_days"], today)
        counts[cat] += 1
        if cat == "At Risk" and dr is not None:
            d = abs(dr)
            overdue[d] = overdue.get(d, 0) + 1
        orders.append(DetailOrder(
            lrn=r["lrn"],
            order_id=r["order_id"],
            no_of_boxes=int(r["no_of_boxes"]) if r["no_of_boxes"] is not None else None,
            client=r["client"],
            manifest_date=fmt_date(r["manifest_date"]),
            pickup_date=fmt_date(r["pickup_date"]),
            expected_date=fmt_date(r["expected_date"]),
            invoice_number=str(r["invoice_number"]) if r["invoice_number"] is not None else None,
            consignee_name=r["consignee_name"],
            risk_status=cat,
            days_remaining=dr,
        ))

    total = len(rows)
    risk_summary = [
        RiskSummaryItem(
            status=k,
            count=counts[k],
            percent=round(counts[k] / total * 100, 1) if total else 0.0,
        )
        for k in _RISK_ORDER
    ]
    days_overdue_breakdown = [
        DaysOverdueItem(days_overdue=d, count=c)
        for d, c in sorted(overdue.items(), key=lambda x: -x[0])
    ]
    return CompanyDetailResponse(
        company=company,
        risk_summary=risk_summary,
        days_overdue_breakdown=days_overdue_breakdown,
        orders=orders,
    )
