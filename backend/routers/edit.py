"""Reference-data endpoints — SLA matrix + pincode master (read + edit).

The matrix and pincode-ODA flag drive Expected-TAT computation *at ingest time*,
so edits here affect FUTURE uploads only — already-stored shipments keep the
`_expected_tat_days` / `_sla_status` they were computed with. All writes go
through the session-aware cursor(), so on the public demo an edit only touches
the visitor's own DB.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.store.db import cursor
from backend.schemas import MatrixResponse, PincodeResponse, PincodeRow

router = APIRouter()

_ZONES = ["West", "South", "North", "East", "North-East"]
_ZONE_SET = set(_ZONES)


class MatrixUpdate(BaseModel):
    zones: list[str]
    values: list[list[int]]


class PincodeUpdate(BaseModel):
    pincode: str
    oda: str


@router.get("/matrix", response_model=MatrixResponse)
def edit_matrix() -> MatrixResponse:
    with cursor() as cur:
        cur.execute("SELECT origin_zone, destination_zone, days FROM sla_matrix_live")
        m = {(r[0], r[1]): r[2] for r in cur.fetchall()}
    values = [[m.get((origin, dest)) for dest in _ZONES] for origin in _ZONES]
    return MatrixResponse(zones=_ZONES, values=values)


@router.put("/matrix")
def update_matrix(body: MatrixUpdate) -> dict:
    """Replace the live 5x5 SLA matrix. Affects future uploads only."""
    zones, values = body.zones, body.values
    if len(zones) != 5 or set(zones) != _ZONE_SET:
        raise HTTPException(422, "zones must be exactly the 5 standard zones.")
    if len(values) != 5 or any(len(row) != 5 for row in values):
        raise HTTPException(422, "values must be a 5x5 matrix.")
    for row in values:
        for v in row:
            if not isinstance(v, int) or not (1 <= v <= 30):
                raise HTTPException(422, "All matrix values must be whole numbers between 1 and 30.")

    with cursor() as cur:
        for i, origin in enumerate(zones):
            for j, dest in enumerate(zones):
                cur.execute(
                    "INSERT OR REPLACE INTO sla_matrix_live (origin_zone, destination_zone, days) "
                    "VALUES (?, ?, ?)",
                    (origin, dest, int(values[i][j])),
                )
    # Intentionally NOT recomputing shipments_latest — see module docstring.
    return {"success": True, "message": "Matrix updated"}


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


@router.put("/pincode")
def update_pincode(body: PincodeUpdate) -> dict:
    """Toggle a single pincode's ODA flag. Affects future uploads only."""
    oda = body.oda.strip().upper()
    if oda not in ("YES", "NO"):
        raise HTTPException(422, "oda must be 'YES' or 'NO'.")
    with cursor() as cur:
        cur.execute(
            "UPDATE pincode_master_live SET oda = ? WHERE pincode = ?",
            (oda, body.pincode),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, f"Pincode '{body.pincode}' not found.")
    return {"success": True, "pincode": body.pincode, "oda": oda}
