"""Snapshot + insight-cache persistence for the AI Insights tab (INSIGHTS_SPEC §3.1/§4).

A snapshot is a lightweight metrics summary of ``shipments_latest`` written once
per upload, plus one row per company. The What-Changed digest compares snapshot N
against N-1; ``seed_snapshot_zero`` fabricates an N-1 for the very first (demo)
load so the first digest has something to say.

``generate_and_cache_insights`` is the single orchestrator both wiring sites
(upload.py and main.py auto-seed) call, so the detector → narrate → cache flow
lives in exactly one place.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from backend.insights.detectors import (
    compute_root_cause_facts,
    get_company_stats,
    run_all_detectors,
)
from backend.insights.groq_narrator import generate_insights

# Synthetic "previous state" perturbations for the seeded snapshot 0 (INSIGHTS_SPEC §3.1).
_SEED_COMPANY_OVERRIDES = {
    "NEXUS FABRICATION": {"total": 28},        # still active a period ago
    "PRISM INDUSTRIES": {"eot_percent_delta": 12.0},  # was healthier
}

_OVERALL_SQL = """
    SELECT COUNT(*)                                                       AS total,
           SUM(CASE WHEN current_status='Delivered' THEN 1 ELSE 0 END)    AS delivered,
           SUM(CASE WHEN _sla_status IN ('Early','On Time') THEN 1 ELSE 0 END) AS eot_ct,
           SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END)            AS late_count,
           SUM(CASE WHEN current_status='RTO' THEN 1 ELSE 0 END)          AS rto_count,
           SUM(CASE WHEN _oda='YES' THEN 1 ELSE 0 END)                    AS oda_count,
           MIN(manifest_date)                                             AS date_min,
           MAX(manifest_date)                                             AS date_max
    FROM shipments_latest
"""

_PER_COMPANY_SQL = """
    SELECT order_id                                                       AS company,
           COUNT(*)                                                       AS total,
           SUM(CASE WHEN current_status='Delivered' THEN 1 ELSE 0 END)    AS delivered,
           ROUND(100.0 * SUM(CASE WHEN _sla_status IN ('Early','On Time')
                                  THEN 1 ELSE 0 END)
                 / NULLIF(SUM(CASE WHEN current_status='Delivered'
                                   THEN 1 ELSE 0 END), 0), 1)             AS eot_percent,
           SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END)            AS late_count,
           SUM(CASE WHEN current_status NOT IN ('Delivered','RTO')
                    THEN 1 ELSE 0 END)                                    AS in_transit
    FROM shipments_latest
    WHERE order_id IS NOT NULL
    GROUP BY order_id
"""


def _overall_metrics(conn: sqlite3.Connection) -> dict:
    cur = conn.cursor()
    cur.execute(_OVERALL_SQL)
    r = cur.fetchone()
    total = int(r["total"] or 0)
    delivered = int(r["delivered"] or 0)
    eot_ct = int(r["eot_ct"] or 0)
    return {
        "total": total,
        "delivered": delivered,
        "eot_percent": round(100.0 * eot_ct / delivered, 1) if delivered else 0.0,
        "late_count": int(r["late_count"] or 0),
        "rto_count": int(r["rto_count"] or 0),
        "oda_count": int(r["oda_count"] or 0),
        "date_min": r["date_min"],
        "date_max": r["date_max"],
    }


def _insert_snapshot(conn: sqlite3.Connection, uploaded_at: str, file_count: int,
                     m: dict, companies: list[dict]) -> int:
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO upload_snapshots
            (uploaded_at, file_count, total, delivered, eot_percent,
             late_count, rto_count, oda_count, date_min, date_max)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        """,
        (uploaded_at, file_count, m["total"], m["delivered"], m["eot_percent"],
         m["late_count"], m["rto_count"], m["oda_count"], m["date_min"], m["date_max"]),
    )
    snapshot_id = int(cur.lastrowid)
    cur.executemany(
        """
        INSERT INTO snapshot_companies
            (snapshot_id, company, total, delivered, eot_percent, late_count, in_transit)
        VALUES (?,?,?,?,?,?,?)
        """,
        [(snapshot_id, c["company"], c["total"], c["delivered"],
          c["eot_percent"], c["late_count"], c["in_transit"]) for c in companies],
    )
    conn.commit()
    return snapshot_id


def write_upload_snapshot(conn: sqlite3.Connection, file_count: int = 1) -> int:
    """Snapshot the current shipments_latest state. Returns the new snapshot_id."""
    m = _overall_metrics(conn)
    cur = conn.cursor()
    cur.execute(_PER_COMPANY_SQL)
    companies = [dict(r) for r in cur.fetchall()]
    return _insert_snapshot(conn, datetime.now().isoformat(timespec="seconds"),
                            file_count, m, companies)


def seed_snapshot_zero(conn: sqlite3.Connection) -> None:
    """Fabricate a synthetic "previous state" so the first digest can compare.

    Overall metrics are nudged worse-than-current (lower E+OT, lower volume, more
    late); NEXUS is still active and PRISM is a touch healthier (INSIGHTS_SPEC §3.1).
    Dated at the earliest manifest date in the current data.
    """
    if get_latest_snapshot_id(conn) is not None:
        return  # a snapshot already exists — don't double-seed

    m = _overall_metrics(conn)
    if m["total"] == 0:
        return

    perturbed = dict(m)
    perturbed["eot_percent"] = round(m["eot_percent"] - 2.5, 1)
    perturbed["total"] = int(m["total"] * 0.92)
    perturbed["delivered"] = int(m["delivered"] * 0.91)
    perturbed["late_count"] = int(m["late_count"] * 1.15)

    cur = conn.cursor()
    cur.execute(_PER_COMPANY_SQL)
    companies = [dict(r) for r in cur.fetchall()]
    for c in companies:
        ov = _SEED_COMPANY_OVERRIDES.get(c["company"])
        if not ov:
            continue
        if "total" in ov:
            c["total"] = ov["total"]
        if "eot_percent_delta" in ov and c["eot_percent"] is not None:
            c["eot_percent"] = round(c["eot_percent"] + ov["eot_percent_delta"], 1)

    uploaded_at = m["date_min"] or datetime.now().isoformat(timespec="seconds")
    _insert_snapshot(conn, uploaded_at, 1, perturbed, companies)


def get_previous_snapshot(conn: sqlite3.Connection, current_id: int) -> dict | None:
    """The snapshot immediately before ``current_id``, or None if it's the first."""
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM upload_snapshots WHERE snapshot_id < ? ORDER BY snapshot_id DESC LIMIT 1",
        (current_id,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def get_snapshot(conn: sqlite3.Connection, snapshot_id: int) -> dict | None:
    cur = conn.cursor()
    cur.execute("SELECT * FROM upload_snapshots WHERE snapshot_id = ?", (snapshot_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def get_latest_snapshot_id(conn: sqlite3.Connection) -> int | None:
    cur = conn.cursor()
    cur.execute("SELECT MAX(snapshot_id) AS m FROM upload_snapshots")
    r = cur.fetchone()
    return int(r["m"]) if r and r["m"] is not None else None


def write_insight_cache(conn: sqlite3.Connection, snapshot_id: int, insights: dict) -> None:
    """Persist digest/patterns/root_causes as JSON, keyed by snapshot_id."""
    cur = conn.cursor()
    cur.execute(
        """
        INSERT OR REPLACE INTO insight_cache
            (snapshot_id, generated_at, digest_bullets, patterns, root_causes)
        VALUES (?,?,?,?,?)
        """,
        (
            snapshot_id,
            datetime.now().isoformat(timespec="seconds"),
            json.dumps(insights.get("digest", [])),
            json.dumps(insights.get("patterns", [])),
            json.dumps(insights.get("root_causes", {})),
        ),
    )
    conn.commit()


def read_insight_cache(conn: sqlite3.Connection, snapshot_id: int) -> dict | None:
    """Parsed cached insights for a snapshot, or None if not cached."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM insight_cache WHERE snapshot_id = ?", (snapshot_id,))
    row = cur.fetchone()
    if not row:
        return None
    return {
        "snapshot_id": int(row["snapshot_id"]),
        "generated_at": row["generated_at"],
        "digest": json.loads(row["digest_bullets"] or "[]"),
        "patterns": json.loads(row["patterns"] or "[]"),
        "root_causes": json.loads(row["root_causes"] or "{}"),
    }


def generate_and_cache_insights(conn: sqlite3.Connection, snapshot_id: int,
                                previous_snapshot: dict | None) -> dict:
    """Run detectors, narrate (Groq or fallback), and cache — the shared trigger flow."""
    current_snapshot = get_snapshot(conn, snapshot_id) or {}
    detector_results = run_all_detectors(conn)
    company_stats = get_company_stats(conn)

    # Companies flagged in company-specific detectors get precomputed root-cause facts.
    flagged = [c["company"] for c in detector_results.get("volume_decline", {}).get("companies", [])]
    flagged += [c["company"] for c in detector_results.get("churned", {}).get("companies", [])]
    root_cause_facts = compute_root_cause_facts(conn, list(dict.fromkeys(flagged)))

    insights = generate_insights(
        detector_results, current_snapshot, previous_snapshot, company_stats, root_cause_facts
    )
    write_insight_cache(conn, snapshot_id, insights)
    return insights
