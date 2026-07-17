"""Deterministic SQL pattern detectors for the AI Insights tab (INSIGHTS_SPEC §3.2).

Eight fixed detectors run against ``shipments_latest`` after every upload and
return *structured* findings — numbers, company names, pincodes; never prose.
A single Groq call (see groq_narrator.py) later turns these into plain English.

Design notes
------------
* "Month" is ``strftime('%Y-%m', manifest_date)`` — the same basis the landing
  trend uses (app/store/queries.get_monthly_trend), so detectors agree with the
  rest of the dashboard.
* "late%" is always Late / (Early + On Time + Late) — the share of *adjudicated*
  (delivered-with-SLA) shipments that missed SLA. Non-delivered rows have a NULL
  ``_sla_status`` and are excluded from the denominator.
* Every detector takes a live ``sqlite3.Connection`` and returns a plain dict of
  JSON-serialisable primitives. ``run_all_detectors`` isolates each one in its
  own try/except so a single failure never blocks the others.
"""
from __future__ import annotations

import sqlite3

# Destination zones treated as the monsoon-sensitive "East/NE" bucket.
_EAST_NE = ("East", "North-East")

# ---------------------------------------------------------------------------
# shared loaders
# ---------------------------------------------------------------------------

def _rows(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur.fetchall()


def _load_company_months(conn: sqlite3.Connection):
    """Return ``(months, per_company)``.

    ``months``      -> sorted list of distinct 'YYYY-MM' strings.
    ``per_company`` -> {company: {month: {"vol", "late", "eot", "adj"}}}.
    """
    rows = _rows(
        conn,
        """
        SELECT order_id AS company,
               strftime('%Y-%m', manifest_date) AS month,
               COUNT(*)                                                   AS vol,
               SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END)        AS late,
               SUM(CASE WHEN _sla_status IN ('Early','On Time')
                        THEN 1 ELSE 0 END)                                AS eot,
               SUM(CASE WHEN _sla_status IN ('Early','On Time','Late')
                        THEN 1 ELSE 0 END)                                AS adj
        FROM shipments_latest
        WHERE manifest_date IS NOT NULL AND order_id IS NOT NULL
        GROUP BY company, month
        """,
    )
    months: set[str] = set()
    per_company: dict[str, dict[str, dict]] = {}
    for r in rows:
        months.add(r["month"])
        per_company.setdefault(r["company"], {})[r["month"]] = {
            "vol": int(r["vol"] or 0),
            "late": int(r["late"] or 0),
            "eot": int(r["eot"] or 0),
            "adj": int(r["adj"] or 0),
        }
    return sorted(months), per_company


def _halves(months: list[str]) -> tuple[list[str], list[str]]:
    """Split the timeline into a first / last window (up to 4 months each)."""
    k = max(1, min(4, len(months) // 2))
    return months[:k], months[-k:]


def _vol(md: dict, window: list[str]) -> int:
    return sum(md.get(m, {}).get("vol", 0) for m in window)


def _late_pct(md: dict, window: list[str]) -> float:
    late = sum(md.get(m, {}).get("late", 0) for m in window)
    adj = sum(md.get(m, {}).get("adj", 0) for m in window)
    return round(100.0 * late / adj, 1) if adj else 0.0


def _pct_change(start: float, end: float) -> float:
    return round(100.0 * (end - start) / start, 1) if start else 0.0


# ---------------------------------------------------------------------------
# the 8 detectors
# ---------------------------------------------------------------------------

def detect_volume_decline_late_rise(conn: sqlite3.Connection) -> dict:
    """Volume down >30% AND late% up >15 points (first half vs last half)."""
    months, per_company = _load_company_months(conn)
    first, last = _halves(months)
    out = []
    for company, md in per_company.items():
        vol_start, vol_end = _vol(md, first), _vol(md, last)
        if vol_start < 10:  # ignore trivially small clients
            continue
        late_start, late_end = _late_pct(md, first), _late_pct(md, last)
        vol_down = vol_end < vol_start * 0.70
        late_up = (late_end - late_start) > 15
        if vol_down and late_up:
            severity = "red" if (vol_end <= vol_start * 0.30 or late_end >= 50) else "yellow"
            out.append({
                "company": company,
                "vol_start": vol_start, "vol_end": vol_end,
                "vol_change_pct": _pct_change(vol_start, vol_end),
                "late_start": late_start, "late_end": late_end,
                "late_rise_points": round(late_end - late_start, 1),
                "severity": severity,
            })
    out.sort(key=lambda d: d["late_rise_points"], reverse=True)
    return {"fired": bool(out), "companies": out}


def detect_churned_clients(conn: sqlite3.Connection) -> dict:
    """Formerly-active clients that fell silent at the end of the timeline.

    Fires on a *cliff*: zero orders in the final month while the prior month was
    still at >=30% of the client's peak — distinguishing a client that went dark
    from one that merely tapered off (that is a decline, not a churn).
    """
    months, per_company = _load_company_months(conn)
    if len(months) < 3:
        return {"fired": False, "companies": []}
    last, prev = months[-1], months[-2]
    out = []
    for company, md in per_company.items():
        vols = {m: md.get(m, {}).get("vol", 0) for m in months}
        total = sum(vols.values())
        peak = max(vols.values()) if vols else 0
        if peak < 10 or total < 30:
            continue
        if vols[last] == 0 and vols[prev] >= 0.30 * peak:
            active = [m for m in months if vols[m] > 0]
            out.append({
                "company": company,
                "last_active_month": active[-1] if active else prev,
                "peak_volume": peak,
                "avg_late_pct": _late_pct(md, months),
            })
    out.sort(key=lambda d: d["peak_volume"], reverse=True)
    return {"fired": bool(out), "companies": out}


def detect_growth_improvement(conn: sqlite3.Connection) -> dict:
    """Volume up >40% AND late% down >15 points (first half vs last half)."""
    months, per_company = _load_company_months(conn)
    first, last = _halves(months)
    out = []
    for company, md in per_company.items():
        vol_start, vol_end = _vol(md, first), _vol(md, last)
        if vol_start < 5:
            continue
        late_start, late_end = _late_pct(md, first), _late_pct(md, last)
        vol_up = vol_end > vol_start * 1.40
        late_down = (late_start - late_end) > 15
        if vol_up and late_down:
            out.append({
                "company": company,
                "vol_start": vol_start, "vol_end": vol_end,
                "vol_change_pct": _pct_change(vol_start, vol_end),
                "late_start": late_start, "late_end": late_end,
                "late_drop_points": round(late_start - late_end, 1),
            })
    out.sort(key=lambda d: d["vol_change_pct"], reverse=True)
    return {"fired": bool(out), "companies": out}


def detect_oda_structural_lateness(conn: sqlite3.Connection) -> dict:
    """ODA late% vs non-ODA late%. Fires when ODA is >1.5x non-ODA."""
    rows = _rows(
        conn,
        """
        SELECT _oda AS oda,
               COUNT(*)                                                  AS cnt,
               SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END)       AS late,
               SUM(CASE WHEN _sla_status IN ('Early','On Time','Late')
                        THEN 1 ELSE 0 END)                               AS adj
        FROM shipments_latest
        WHERE _oda IN ('YES','NO')
        GROUP BY _oda
        """,
    )
    stat = {r["oda"]: r for r in rows}
    oda, non = stat.get("YES"), stat.get("NO")

    def pct(r) -> float:
        return round(100.0 * (r["late"] or 0) / r["adj"], 1) if r and r["adj"] else 0.0

    oda_pct, non_pct = pct(oda), pct(non)
    ratio = round(oda_pct / non_pct, 2) if non_pct else 0.0
    return {
        "fired": ratio > 1.5,
        "oda_late_pct": oda_pct,
        "non_oda_late_pct": non_pct,
        "ratio": ratio,
        "oda_count": int(oda["cnt"]) if oda else 0,
        "non_oda_count": int(non["cnt"]) if non else 0,
    }


def detect_seasonal_zone_anomaly(conn: sqlite3.Connection) -> dict:
    """Worst 3-month window of East/NE late% vs overall. Fires when >1.8x."""
    rows = _rows(
        conn,
        f"""
        SELECT strftime('%Y-%m', manifest_date) AS month,
               SUM(CASE WHEN _destination_zone IN {_EAST_NE}
                         AND _sla_status='Late' THEN 1 ELSE 0 END)       AS z_late,
               SUM(CASE WHEN _destination_zone IN {_EAST_NE}
                         AND _sla_status IN ('Early','On Time','Late')
                        THEN 1 ELSE 0 END)                               AS z_adj
        FROM shipments_latest
        WHERE manifest_date IS NOT NULL
        GROUP BY month
        ORDER BY month
        """,
    )
    overall = _rows(
        conn,
        """
        SELECT SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END)       AS late,
               SUM(CASE WHEN _sla_status IN ('Early','On Time','Late')
                        THEN 1 ELSE 0 END)                               AS adj
        FROM shipments_latest
        """,
    )[0]
    overall_pct = round(100.0 * (overall["late"] or 0) / overall["adj"], 1) if overall["adj"] else 0.0
    if len(rows) < 3 or overall_pct == 0:
        return {"fired": False, "worst_months": [], "zone_late_pct": 0.0,
                "overall_late_pct": overall_pct, "ratio": 0.0}

    best_window, best_pct = [], -1.0
    for i in range(len(rows) - 2):
        win = rows[i:i + 3]
        late = sum(w["z_late"] or 0 for w in win)
        adj = sum(w["z_adj"] or 0 for w in win)
        pct = 100.0 * late / adj if adj else 0.0
        if pct > best_pct:
            best_pct, best_window = pct, [w["month"] for w in win]
    ratio = round(best_pct / overall_pct, 2) if overall_pct else 0.0
    return {
        "fired": ratio > 1.8,
        "worst_months": best_window,
        "zone_late_pct": round(best_pct, 1),
        "overall_late_pct": overall_pct,
        "ratio": ratio,
    }


def detect_bad_lane(conn: sqlite3.Connection) -> dict:
    """Per-pincode late% with >=10 adjudicated orders. Fires when late% > 60%."""
    rows = _rows(
        conn,
        """
        SELECT pin_code                                                  AS pincode,
               MAX(destination_city)                                     AS city,
               MAX(state)                                                AS state,
               MAX(_destination_zone)                                    AS zone,
               SUM(CASE WHEN _sla_status IN ('Early','On Time','Late')
                        THEN 1 ELSE 0 END)                               AS adj,
               SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END)       AS late
        FROM shipments_latest
        WHERE pin_code IS NOT NULL
        GROUP BY pin_code
        HAVING adj >= 10 AND (late * 1.0 / adj) > 0.60
        ORDER BY (late * 1.0 / adj) DESC, adj DESC
        LIMIT 20
        """,
    )
    lanes = [{
        "pincode": str(r["pincode"]),
        "city": r["city"], "state": r["state"], "zone": r["zone"],
        "total_orders": int(r["adj"]),
        "late_pct": round(100.0 * r["late"] / r["adj"], 1) if r["adj"] else 0.0,
    } for r in rows]
    return {"fired": bool(lanes), "lanes": lanes}


def detect_new_client_ramp(conn: sqlite3.Connection) -> dict:
    """Zero orders in the first 2 months, then growing volume afterwards."""
    months, per_company = _load_company_months(conn)
    if len(months) < 4:
        return {"fired": False, "companies": []}
    early = months[:2]
    out = []
    for company, md in per_company.items():
        if _vol(md, early) > 0:
            continue
        active = [m for m in months if md.get(m, {}).get("vol", 0) > 0]
        recent = _vol(md, months[-2:])
        if active and recent >= 10:
            out.append({
                "company": company,
                "first_active_month": active[0],
                "recent_volume": recent,
                "late_pct": _late_pct(md, months[-2:]),
            })
    out.sort(key=lambda d: d["recent_volume"], reverse=True)
    return {"fired": bool(out), "companies": out}


def detect_overall_trend(conn: sqlite3.Connection) -> dict:
    """Month-over-month E+OT%. Always fires — it describes the headline arc."""
    rows = _rows(
        conn,
        """
        SELECT strftime('%Y-%m', manifest_date) AS month,
               SUM(CASE WHEN _sla_status IN ('Early','On Time')
                        THEN 1 ELSE 0 END)                               AS eot,
               SUM(CASE WHEN _sla_status IN ('Early','On Time','Late')
                        THEN 1 ELSE 0 END)                               AS adj
        FROM shipments_latest
        WHERE manifest_date IS NOT NULL
        GROUP BY month
        ORDER BY month
        """,
    )
    months = [r["month"] for r in rows]
    eot_by_month = [round(100.0 * (r["eot"] or 0) / r["adj"], 1) if r["adj"] else 0.0 for r in rows]
    tot_eot = sum(r["eot"] or 0 for r in rows)
    tot_adj = sum(r["adj"] or 0 for r in rows)
    overall_eot = round(100.0 * tot_eot / tot_adj, 1) if tot_adj else 0.0

    direction = "flat"
    if len(eot_by_month) >= 2:
        delta = eot_by_month[-1] - eot_by_month[0]
        direction = "improving" if delta > 2 else "declining" if delta < -2 else "flat"
    best_i = max(range(len(eot_by_month)), default=None, key=lambda i: eot_by_month[i]) if eot_by_month else None
    worst_i = min(range(len(eot_by_month)), default=None, key=lambda i: eot_by_month[i]) if eot_by_month else None
    return {
        "fired": True,
        "months": months,
        "eot_by_month": eot_by_month,
        "trend_direction": direction,
        "best_month": {"month": months[best_i], "eot_percent": eot_by_month[best_i]} if best_i is not None else None,
        "worst_month": {"month": months[worst_i], "eot_percent": eot_by_month[worst_i]} if worst_i is not None else None,
        "overall_eot": overall_eot,
    }


# ---------------------------------------------------------------------------
# orchestration + supporting helpers used by the narrator / router
# ---------------------------------------------------------------------------

_DETECTORS = {
    "volume_decline": detect_volume_decline_late_rise,
    "churned": detect_churned_clients,
    "growth": detect_growth_improvement,
    "oda_lateness": detect_oda_structural_lateness,
    "seasonal": detect_seasonal_zone_anomaly,
    "bad_lane": detect_bad_lane,
    "new_client": detect_new_client_ramp,
    "overall_trend": detect_overall_trend,
}


def run_all_detectors(conn: sqlite3.Connection) -> dict:
    """Run all 8 detectors; one failing never blocks the others."""
    results: dict[str, dict] = {}
    for name, fn in _DETECTORS.items():
        try:
            results[name] = fn(conn)
        except Exception as e:  # pragma: no cover - defensive
            results[name] = {"fired": False, "error": str(e)}
    return results


def get_company_stats(conn: sqlite3.Connection) -> list[dict]:
    """Per-company aggregate table fed to the narrator as context."""
    rows = _rows(
        conn,
        """
        SELECT order_id AS company,
               COUNT(*)                                                  AS total,
               SUM(CASE WHEN current_status='Delivered' THEN 1 ELSE 0 END) AS delivered,
               ROUND(100.0 * SUM(CASE WHEN _sla_status IN ('Early','On Time')
                                      THEN 1 ELSE 0 END)
                     / NULLIF(SUM(CASE WHEN current_status='Delivered'
                                       THEN 1 ELSE 0 END), 0), 1)        AS eot_percent,
               SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END)       AS late_count
        FROM shipments_latest
        WHERE order_id IS NOT NULL
        GROUP BY order_id
        ORDER BY total DESC
        """,
    )
    return [dict(r) for r in rows]


def _zone_label(zone: str | None) -> str | None:
    if not zone:
        return zone
    return "NE" if zone == "North-East" else zone


def compute_root_cause_facts(conn: sqlite3.Connection, companies: list[str]) -> dict:
    """Per-company structural facts (INSIGHTS_SPEC §3.3) — pure SQL, no LLM.

    These are the real numbers (ODA share, dominant zone, worst pincode) that the
    narrator is *given* so it never has to invent them.
    """
    facts: dict[str, dict] = {}
    for company in companies:
        share_row = _rows(
            conn,
            """
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN _oda='YES' THEN 1 ELSE 0 END) AS oda
            FROM shipments_latest WHERE order_id = ?
            """,
            (company,),
        )[0]
        total = int(share_row["total"] or 0)
        oda_share = round((share_row["oda"] or 0) / total, 2) if total else 0.0

        zone_rows = _rows(
            conn,
            """
            SELECT _destination_zone AS zone, COUNT(*) AS c
            FROM shipments_latest
            WHERE order_id = ? AND _destination_zone IS NOT NULL
            GROUP BY _destination_zone ORDER BY c DESC LIMIT 1
            """,
            (company,),
        )
        dominant_zone = _zone_label(zone_rows[0]["zone"]) if zone_rows else None

        worst = _rows(
            conn,
            """
            SELECT pin_code AS pincode,
                   MAX(destination_city) AS city,
                   SUM(CASE WHEN _sla_status IN ('Early','On Time','Late')
                            THEN 1 ELSE 0 END) AS adj,
                   SUM(CASE WHEN _sla_status='Late' THEN 1 ELSE 0 END) AS late
            FROM shipments_latest
            WHERE order_id = ? AND pin_code IS NOT NULL
            GROUP BY pin_code
            HAVING adj >= 3
            ORDER BY (late * 1.0 / adj) DESC, adj DESC
            LIMIT 1
            """,
            (company,),
        )
        if worst:
            w = worst[0]
            wp, wc = str(w["pincode"]), w["city"]
            wl = round(w["late"] / w["adj"], 2) if w["adj"] else 0.0
        else:
            wp = wc = None
            wl = 0.0

        facts[company] = {
            "oda_share": oda_share,
            "dominant_zone": dominant_zone,
            "worst_pincode": wp,
            "worst_pincode_city": wc,
            "worst_pincode_late_pct": wl,
        }
    return facts
