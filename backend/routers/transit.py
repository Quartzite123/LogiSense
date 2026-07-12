"""Transit section — non-delivered orders with risk triage + summary.

Queried directly from shipments_latest; risk classification lives in the shared
transit_risk module so transit, aggregate-transit and exports agree exactly.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter

from app.store.db import cursor
from backend.schemas import TransitOrder, TransitResponse, TransitSummary
from backend.transit_risk import CATEGORY_PRIORITY, classify, fmt_date, risk_label

router = APIRouter()

_ORDERS_SQL = """
    SELECT lrn, order_id, consignee_name, current_status,
           manifest_date, pickup_date, expected_date, _expected_tat_days,
           _oda, last_scan_date, destination_city, state, pin_code
    FROM shipments_latest
    WHERE current_status IN ('Manifested','Dispatched','In Transit','Pending','RTO')
      -- Safety net: only operationally-relevant recent orders (within 60 days of
      -- the newest manifest). Filters out any stale non-delivered rows that slip
      -- through. Shared by /transit/orders + /transit/summary (+ aggregate-transit).
      AND manifest_date >= (
          SELECT DATE(MAX(manifest_date), '-60 days') FROM shipments_latest
      )
"""


def transit_records(today: date | None = None) -> list[dict]:
    """All non-delivered orders enriched with risk fields (list of dicts).

    Shared by /orders, /summary, the aggregate-transit router and exports.
    Each dict also carries an internal `category` for counting/sorting.
    """
    if today is None:
        today = date.today()
    with cursor() as cur:
        cur.execute(_ORDERS_SQL)
        rows = cur.fetchall()

    records: list[dict] = []
    for r in rows:
        category, dit, dr = classify(
            r["current_status"], r["manifest_date"], r["pickup_date"],
            r["_expected_tat_days"], today,
        )
        records.append({
            "lrn": r["lrn"],
            "order_id": r["order_id"],
            "consignee_name": r["consignee_name"],
            "current_status": r["current_status"],
            "manifest_date": fmt_date(r["manifest_date"]),
            "expected_date": fmt_date(r["expected_date"]),
            "days_in_transit": dit,
            "days_remaining": dr,
            "risk_status": risk_label(category, dr),
            "_oda": r["_oda"],
            "last_scan_date": fmt_date(r["last_scan_date"]),
            "destination_city": r["destination_city"],
            "state": r["state"],
            "pin_code": str(r["pin_code"]) if r["pin_code"] is not None else None,
            "category": category,
        })

    # Default sort: At Risk → Due Today → RTO → on-track; longest in transit first.
    records.sort(key=lambda d: (
        CATEGORY_PRIORITY.get(d["category"], 9),
        -(d["days_in_transit"] if d["days_in_transit"] is not None else -1),
    ))
    return records


@router.get("/orders", response_model=TransitResponse)
def transit_orders() -> TransitResponse:
    recs = transit_records()
    orders = [
        TransitOrder(
            lrn=d["lrn"],
            order_id=d["order_id"],
            consignee_name=d["consignee_name"],
            current_status=d["current_status"],
            manifest_date=d["manifest_date"],
            expected_date=d["expected_date"],
            days_in_transit=d["days_in_transit"],
            days_remaining=d["days_remaining"],
            risk_status=d["risk_status"],
            oda=d["_oda"],
            last_scan_date=d["last_scan_date"],
            destination_city=d["destination_city"],
            state=d["state"],
            pin_code=d["pin_code"],
        )
        for d in recs
    ]
    return TransitResponse(
        orders=orders,
        at_risk_count=sum(1 for d in recs if d["category"] == "At Risk"),
        due_today_count=sum(1 for d in recs if d["category"] == "Due Today"),
        total_in_flight=len(recs),
    )


@router.get("/summary", response_model=TransitSummary)
def transit_summary() -> TransitSummary:
    recs = transit_records()
    return TransitSummary(
        total_in_flight=len(recs),
        at_risk=sum(1 for d in recs if d["category"] == "At Risk"),
        due_today=sum(1 for d in recs if d["category"] == "Due Today"),
        on_track=sum(1 for d in recs if d["category"] == "On Track"),
        rto_count=sum(1 for d in recs if d["current_status"] == "RTO"),
        pending_count=sum(1 for d in recs if d["current_status"] == "Pending"),
    )
