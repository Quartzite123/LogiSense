"""AI Insights read endpoints (INSIGHTS_SPEC §4).

All three endpoints are pure cache reads — the narration was generated once at
upload/seed time and stored in ``insight_cache``. Zero live LLM calls here, so
page loads are instant.
"""
from __future__ import annotations

import sys
from pathlib import Path

# repo root on sys.path so `app.*` resolves even if this router is imported alone
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter, HTTPException

from app.store.db import get_conn
from backend.insights.snapshot import (
    get_latest_snapshot_id,
    get_previous_snapshot,
    read_insight_cache,
)

router = APIRouter(prefix="/api/insights", tags=["insights"])

_SEVERITY_RANK = {"red": 0, "yellow": 1, "green": 2, "grey": 3}


@router.get("/digest")
def insights_digest() -> dict:
    """What-Changed digest: 5 bullets comparing the latest snapshot to the previous."""
    conn = get_conn()
    try:
        snapshot_id = get_latest_snapshot_id(conn)
        if snapshot_id is None:
            return {"digest": None, "message": "Upload a file to generate insights"}
        cache = read_insight_cache(conn, snapshot_id)
        if not cache or not cache.get("digest"):
            return {"digest": None, "message": "Upload a file to generate insights"}

        snap = _snapshot_row(conn, snapshot_id)
        prev = get_previous_snapshot(conn, snapshot_id)
        return {
            "digest": cache["digest"],
            "snapshot_id": snapshot_id,
            "uploaded_at": snap.get("uploaded_at") if snap else None,
            "previous_uploaded_at": prev.get("uploaded_at") if prev else None,
        }
    finally:
        conn.close()


@router.get("/patterns")
def insights_patterns() -> dict:
    """All pattern cards with narration, sorted red → yellow → green → grey."""
    conn = get_conn()
    try:
        snapshot_id = get_latest_snapshot_id(conn)
        if snapshot_id is None:
            return {"patterns": [], "snapshot_id": None,
                    "message": "Upload a file to generate insights"}
        cache = read_insight_cache(conn, snapshot_id)
        if not cache:
            return {"patterns": [], "snapshot_id": snapshot_id,
                    "message": "Upload a file to generate insights"}
        patterns = sorted(
            cache.get("patterns", []),
            key=lambda p: _SEVERITY_RANK.get(p.get("severity"), 9),
        )
        return {"patterns": patterns, "snapshot_id": snapshot_id}
    finally:
        conn.close()


@router.get("/root-cause")
def insights_root_cause(company: str) -> dict:
    """Precomputed root-cause panel for a flagged company (INSIGHTS_SPEC §3.3)."""
    conn = get_conn()
    try:
        snapshot_id = get_latest_snapshot_id(conn)
        if snapshot_id is None:
            raise HTTPException(status_code=404, detail="No insights generated yet")
        cache = read_insight_cache(conn, snapshot_id)
        root_causes = (cache or {}).get("root_causes", {})
        rc = root_causes.get(company)
        if rc is None:
            raise HTTPException(
                status_code=404,
                detail=f"No root-cause analysis for '{company}'",
            )
        return {"company": company, "snapshot_id": snapshot_id, **rc}
    finally:
        conn.close()


def _snapshot_row(conn, snapshot_id: int) -> dict | None:
    cur = conn.cursor()
    cur.execute("SELECT * FROM upload_snapshots WHERE snapshot_id = ?", (snapshot_id,))
    row = cur.fetchone()
    return dict(row) if row else None
