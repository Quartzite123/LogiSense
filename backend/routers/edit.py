"""Reference-data endpoints — SLA matrix + pincode master (read + edit).

The matrix and pincode-ODA flag drive Expected-TAT computation *at ingest time*,
so edits here affect FUTURE uploads only — already-stored shipments keep the
`_expected_tat_days` / `_sla_status` they were computed with. All writes go
through the session-aware cursor(), so on the public demo an edit only touches
the visitor's own DB.
"""
from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.store.db import cursor
from backend.schemas import MatrixResponse, PincodeResponse, PincodeRow

router = APIRouter()

_ZONES = ["West", "South", "North", "East", "North-East"]
_ZONE_SET = set(_ZONES)

# Uploaded/custom files may spell the zones loosely; normalise to canonical names.
_ZONE_ALIASES = {
    "west": "West", "south": "South", "north": "North", "east": "East",
    "ne": "North-East", "north-east": "North-East", "northeast": "North-East",
    "north east": "North-East",
}


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
        # CAST both sides to TEXT so the match is robust whether pincode is stored
        # as TEXT (seed) or INTEGER (a custom uploaded file could differ).
        cur.execute(
            "UPDATE pincode_master_live SET oda = ? WHERE CAST(pincode AS TEXT) = ?",
            (oda, str(body.pincode).strip()),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, f"Pincode '{body.pincode}' not found.")
    return {"success": True, "pincode": str(body.pincode).strip(), "oda": oda}


@router.post("/matrix/reset")
def reset_matrix() -> dict:
    """Restore sla_matrix_live from the bundled app/reference/matrix.csv."""
    from app.store.seed import seed_matrix_from_csv

    seed_matrix_from_csv()  # DELETE + reload, session-aware via cursor()
    return {"success": True, "message": "Matrix reset to defaults"}


@router.post("/pincodes/reset")
def reset_pincodes() -> dict:
    """Restore pincode_master_live from app/reference/pincode_master.xlsx.

    Re-runs the original seed normalisation (6-digit pincodes, state→zone mapping,
    ODA canonicalisation). Does not recompute existing shipments.
    """
    import pandas as pd

    from app.store.queries import count_pincodes
    from app.store.seed import _load_pincode_master

    path = ROOT / "app" / "reference" / "pincode_master.xlsx"
    if not path.exists():
        raise HTTPException(500, "Reference pincode file not found on the server.")
    df = pd.read_excel(path, sheet_name="Pincode file")
    _load_pincode_master(df)  # DELETE + reload, session-aware
    return {"success": True, "rows_reset": count_pincodes()}


@router.post("/pincodes/upload")
async def upload_pincodes(file: UploadFile = File(...)) -> dict:
    """Replace pincode_master_live from a custom .xlsx (pincode/city/state/zone/oda)."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(422, "Please upload an .xlsx file.")

    import pandas as pd

    contents = await file.read()
    try:
        df = pd.read_excel(BytesIO(contents))
    except Exception as e:  # unreadable / not a real spreadsheet
        raise HTTPException(422, f"Could not read the Excel file: {e}")

    # Case-insensitive column match against the required 5.
    colmap = {str(c).strip().lower(): c for c in df.columns}
    required = ["pincode", "city", "state", "zone", "oda"]
    missing = [c for c in required if c not in colmap]
    if missing:
        raise HTTPException(
            422,
            f"Missing required column(s): {', '.join(missing)}. "
            "Expected: pincode, city, state, zone, oda.",
        )

    from app.store.seed import _normalise_oda

    rows: list[tuple] = []
    bad_zone = 0
    for _, r in df.iterrows():
        raw_pin = r[colmap["pincode"]]
        if pd.isna(raw_pin):
            continue
        try:
            pin = str(int(float(raw_pin)))
        except (ValueError, TypeError):
            pin = str(raw_pin).strip()
        if not pin.isdigit() or len(pin) != 6:
            continue
        zone_raw = r[colmap["zone"]]
        zone = _ZONE_ALIASES.get(str(zone_raw).strip().lower()) if not pd.isna(zone_raw) else None
        if zone is None:
            bad_zone += 1
            continue
        city_raw = r[colmap["city"]]
        city = None if pd.isna(city_raw) else str(city_raw).strip()
        state_raw = r[colmap["state"]]
        state = None if pd.isna(state_raw) else str(state_raw).strip()
        rows.append((pin, city, state, zone, _normalise_oda(r[colmap["oda"]])))

    if len(rows) < 100:
        detail = f"Only {len(rows)} valid rows found — need at least 100."
        if bad_zone:
            detail += f" ({bad_zone} rows had an unrecognised zone; use West/South/North/East/NE.)"
        raise HTTPException(422, detail)

    with cursor() as cur:
        cur.execute("DELETE FROM pincode_master_live")
        cur.executemany(
            "INSERT OR REPLACE INTO pincode_master_live(pincode, city, state, zone, oda) "
            "VALUES (?, ?, ?, ?, ?)",
            rows,
        )
    return {"success": True, "rows_loaded": len(rows)}
