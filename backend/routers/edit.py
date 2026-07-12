"""Reference-data read endpoints — SLA matrix + pincode master (read-only).

Editing the matrix/pincodes requires new write endpoints (Phase 2.5); for now
this only exposes the current live reference data for display.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter, Query

from app.store.db import cursor
from backend.schemas import MatrixResponse, PincodeResponse, PincodeRow

router = APIRouter()

_ZONES = ["West", "South", "North", "East", "North-East"]


@router.get("/matrix", response_model=MatrixResponse)
def edit_matrix() -> MatrixResponse:
    with cursor() as cur:
        cur.execute("SELECT origin_zone, destination_zone, days FROM sla_matrix_live")
        m = {(r[0], r[1]): r[2] for r in cur.fetchall()}
    values = [[m.get((origin, dest)) for dest in _ZONES] for origin in _ZONES]
    return MatrixResponse(zones=_ZONES, values=values)


@router.get("/pincodes", response_model=PincodeResponse)
def edit_pincodes(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=500),
    search: str = "",
) -> PincodeResponse:
    where = ""
    params: list = []
    if search.strip():
        s = f"%{search.strip()}%"
        where = "WHERE pincode LIKE ? OR city LIKE ? OR state LIKE ?"
        params = [s, s, s]

    with cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM pincode_master_live {where}", params)
        total = cur.fetchone()[0]
        cur.execute(
            f"SELECT pincode, city, state, zone, oda FROM pincode_master_live {where} "
            "ORDER BY pincode LIMIT ? OFFSET ?",
            params + [per_page, (page - 1) * per_page],
        )
        rows = [
            PincodeRow(pincode=r[0], city=r[1], state=r[2], zone=r[3], oda=r[4])
            for r in cur.fetchall()
        ]

    return PincodeResponse(total=total, page=page, per_page=per_page, rows=rows)
