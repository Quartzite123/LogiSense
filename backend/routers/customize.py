"""Customize — ad-hoc filtered query over shipments_latest.

All query params are optional AND-filters; empty means no filter. company,
status, sla_status and zone accept a comma-separated list (multi-select).
The date range filters on Manifest Date (the TAT clock).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter

from app.store.db import cursor
from backend.transit_risk import fmt_date

router = APIRouter()

_COLUMNS = """
    lrn, order_id, consignee_name, current_status,
    manifest_date, pickup_date, delivered_date, expected_date,
    destination_city, state, pin_code,
    _origin_zone, _destination_zone, _oda,
    _expected_tat_days, _actual_tat_days, _tat_variance_days, _sla_status
"""

_DATE_KEYS = ("manifest_date", "pickup_date", "delivered_date", "expected_date")


def _split(val: str | None) -> list[str]:
    if not val:
        return []
    return [v.strip() for v in val.split(",") if v.strip()]


def customize_records(
    company: str | None = None,
    status: str | None = None,
    sla_status: str | None = None,
    oda: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    zone: str | None = None,
) -> list[dict]:
    clauses: list[str] = []
    params: list = []

    def add_in(col: str, raw: str | None) -> None:
        vals = _split(raw)
        if vals:
            clauses.append(f"{col} IN ({','.join('?' * len(vals))})")
            params.extend(vals)

    add_in("order_id", company)
    add_in("current_status", status)
    add_in("_sla_status", sla_status)
    add_in("_destination_zone", zone)

    if oda and oda.strip().upper() in ("YES", "NO"):
        clauses.append("_oda = ?")
        params.append(oda.strip().upper())
    if date_from:
        clauses.append("date(manifest_date) >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("date(manifest_date) <= ?")
        params.append(date_to)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = f"SELECT {_COLUMNS} FROM shipments_latest{where}"

    with cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    out: list[dict] = []
    for r in rows:
        d = {k: r[k] for k in r.keys()}
        for dk in _DATE_KEYS:
            d[dk] = fmt_date(d.get(dk))
        if d.get("pin_code") is not None:
            d["pin_code"] = str(d["pin_code"])
        out.append(d)
    return out


@router.get("/orders")
def customize_orders(
    company: str | None = None,
    status: str | None = None,
    sla_status: str | None = None,
    oda: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    zone: str | None = None,
) -> list[dict]:
    return customize_records(company, status, sla_status, oda, date_from, date_to, zone)
