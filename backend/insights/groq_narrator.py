"""Single-call Groq narrator for the AI Insights tab (INSIGHTS_SPEC §4).

The statistical detectors (detectors.py) find the patterns; this module turns
their structured output into plain-English narration for non-technical founders
in ONE Groq call (llama-3.3-70b-versatile), returning the exact JSON contract
the frontend consumes: ``{digest, patterns, root_causes}``.

Offline / no-key behaviour
--------------------------
The spec's primary path is Groq. But ``generate_insights`` never raises: if
``GROQ_API_KEY`` is unset or the call fails, it falls back to a *deterministic*
narrator (``build_fallback_insights``) that produces the same JSON shape directly
from the detector output. This keeps the Insights tab functional offline, in CI,
and during Groq outages — the spec's "show raw findings" fallback, but narrated.
Set ``GROQ_API_KEY`` to get the LLM path.
"""
from __future__ import annotations

import json
import os

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

_SEVERITY_RANK = {"red": 0, "yellow": 1, "green": 2, "grey": 3}


# ---------------------------------------------------------------------------
# public entry point
# ---------------------------------------------------------------------------

def generate_insights(
    detector_results: dict,
    current_snapshot: dict,
    previous_snapshot: dict | None,
    company_stats: list,
    root_cause_facts: dict | None = None,
) -> dict:
    """Narrate the detector findings. Groq if available, deterministic otherwise.

    ``root_cause_facts`` (per-company ODA share / dominant zone / worst pincode,
    precomputed by detectors.compute_root_cause_facts) is passed so the narrator
    never invents structural numbers — a backward-compatible extension of the
    spec's 4-argument signature.
    """
    root_cause_facts = root_cause_facts or {}
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return build_fallback_insights(
            detector_results, current_snapshot, previous_snapshot, root_cause_facts
        )
    try:
        return _call_groq(
            api_key, detector_results, current_snapshot,
            previous_snapshot, company_stats, root_cause_facts,
        )
    except Exception as e:  # network / parse / rate-limit — degrade, never crash
        print(f"[insights] Groq narration failed, using deterministic fallback: {e}")
        return build_fallback_insights(
            detector_results, current_snapshot, previous_snapshot, root_cause_facts
        )


# ---------------------------------------------------------------------------
# Groq path
# ---------------------------------------------------------------------------

def _build_system_prompt(
    detector_results: dict,
    current_snapshot: dict,
    previous_snapshot: dict | None,
    company_stats: list,
    root_cause_facts: dict,
) -> str:
    prev = json.dumps(previous_snapshot, indent=2) if previous_snapshot else "None — this is the first upload"
    return f"""You are a logistics analyst AI for LogiSense.
You have been given structured findings from 8 statistical detectors run against
real shipment data. Your job is to write plain-English narration for
non-technical founders.

CURRENT DATA SUMMARY:
{json.dumps(current_snapshot, indent=2)}

PREVIOUS SNAPSHOT (for comparison):
{prev}

PER-COMPANY STATS:
{json.dumps(company_stats, indent=2)}

DETECTOR FINDINGS:
{json.dumps(detector_results, indent=2)}

STRUCTURAL FACTS PER FLAGGED COMPANY (use these exact numbers for root_causes):
{json.dumps(root_cause_facts, indent=2)}

WRITING QUALITY — study these examples before you write anything:

BAD headline:  "Volume decline"
GOOD headline: "PRISM INDUSTRIES: volume fell 57.9% while late rate tripled over 8 months — churn imminent"

BAD bullet:  "Severity level: red"
GOOD bullet: "Orders fell from 133/month to 56 (first vs last window)"

BAD digest:  "Delivered shipments increased by 345"
GOOD digest: "▲ E+OT improved 2.5 points (70.8% → 73.3%) — operations improving across most clients"

Return ONLY valid JSON with this exact structure:
{{
  "digest": [
    "▲ E+OT improved 2.5 points (70.8% → 73.3%) — operations improving across most clients",
    "▼ PRISM INDUSTRIES volume fell 57.9% as late deliveries climbed 27 points",
    "● NEXUS FABRICATION shipped 0 orders this period after months of steady volume",
    "bullet 4 (must start with ▲, ▼, or ●)",
    "bullet 5 (must start with ▲, ▼, or ●)"
  ],
  "patterns": [
    {{
      "id": "volume_decline_COMPANY",
      "company": "COMPANY NAME or null if not company-specific",
      "severity": "red|yellow|green|grey",
      "headline": "Names the company + specific numbers, e.g. 'PRISM INDUSTRIES: volume down 57.9% as late rate climbed 27 pts'",
      "bullets": ["human-readable stat with context", "another concrete stat", "a third concrete stat"],
      "has_root_cause": true
    }}
  ],
  "root_causes": {{
    "COMPANY NAME": {{
      "oda_share": 0.0,
      "dominant_zone": "West|South|North|East|NE",
      "worst_pincode": "000000",
      "worst_pincode_city": "City",
      "worst_pincode_late_pct": 0.0,
      "narrative": "2-3 sentences explaining WHY this company struggles"
    }}
  }}
}}

Rules:
- Headlines MUST name the company and include specific numbers from the data
  (e.g. "57.9% volume drop", never a vague "volume drop"). Non-company patterns
  (ODA, seasonal, bad lane, overall trend) still lead with the key number.
- Bullets MUST be human-readable insights a founder understands. NEVER output
  raw field names like "severity", "severity_level", "oda_share", or
  "vol_change_pct" — translate every number into plain language.
- Digest bullets MUST each start with ▲ (improvement), ▼ (worsening), or
  ● (neutral / notable).
- Every number MUST carry context — write "57.9% volume drop over 8 months",
  never a bare "57.9%".
- Write as if explaining to a non-technical founder, not a developer.
- digest: exactly 5 bullets, ordered by importance. Compare to the previous
  snapshot when one exists; otherwise describe the current state as a baseline.
- patterns: output ONE card per fired finding and DO NOT omit or merge any —
  include EVERY volume-decline company, EVERY churned company, EVERY growth
  company, plus the ODA-lateness, seasonal-anomaly, bad-lane, and overall-trend
  findings whenever they appear in DETECTOR FINDINGS (usually 8-12 cards total).
- Assign severity EXACTLY like this (do not improvise): churned → red;
  growth and new-client → green; ODA-lateness and seasonal-anomaly → yellow;
  bad-lane and overall-trend → grey; for a volume-decline company use the
  "severity" value given in that finding. (red=churn/critical, yellow=watch,
  green=growth, grey=informational.)
- root_causes: only for companies flagged in patterns with has_root_cause=true.
  Use ONLY the numbers in STRUCTURAL FACTS above.
- Never invent numbers. Only use what is in the data above.
- Keep the total response under 2000 tokens."""


def _call_groq(
    api_key: str,
    detector_results: dict,
    current_snapshot: dict,
    previous_snapshot: dict | None,
    company_stats: list,
    root_cause_facts: dict,
) -> dict:
    system = _build_system_prompt(
        detector_results, current_snapshot, previous_snapshot, company_stats, root_cause_facts
    )
    response = httpx.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": "Generate the insights JSON now."},
            ],
            "max_tokens": 2000,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        },
        timeout=30.0,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


# ---------------------------------------------------------------------------
# deterministic fallback (no Groq)
# ---------------------------------------------------------------------------

def _pct(n: float) -> str:
    return f"{round(n)}%"


def build_fallback_insights(
    detector_results: dict,
    current_snapshot: dict,
    previous_snapshot: dict | None,
    root_cause_facts: dict | None = None,
) -> dict:
    """Narrate detector output without an LLM. Same JSON shape as the Groq path."""
    root_cause_facts = root_cause_facts or {}
    d = detector_results
    patterns: list[dict] = []
    root_causes: dict[str, dict] = {}
    rc_companies: list[str] = []

    # 1 — volume decline + late rise (red/yellow, has root cause)
    for c in d.get("volume_decline", {}).get("companies", []):
        patterns.append({
            "id": f"volume_decline_{c['company']}",
            "company": c["company"],
            "severity": c.get("severity", "yellow"),
            "headline": f"{c['company']}: volume down {abs(c['vol_change_pct'])}% as late rate climbed {c['late_rise_points']} pts.",
            "bullets": [
                f"Orders fell {c['vol_start']} → {c['vol_end']} (first vs last window).",
                f"Late rate rose {c['late_start']}% → {c['late_end']}%.",
                f"Now missing SLA on {c['late_end']}% of adjudicated orders.",
            ],
            "has_root_cause": True,
        })
        rc_companies.append(c["company"])

    # 2 — churned clients (red, has root cause)
    for c in d.get("churned", {}).get("companies", []):
        patterns.append({
            "id": f"churn_{c['company']}",
            "company": c["company"],
            "severity": "red",
            "headline": f"{c['company']} went silent — likely churned.",
            "bullets": [
                f"Peaked at {c['peak_volume']} orders/month, now zero.",
                f"Last active {c['last_active_month']}.",
                f"Lifetime late rate {c['avg_late_pct']}%.",
            ],
            "has_root_cause": True,
        })
        rc_companies.append(c["company"])

    # 3 — growth + improvement (green)
    for c in d.get("growth", {}).get("companies", []):
        patterns.append({
            "id": f"growth_{c['company']}",
            "company": c["company"],
            "severity": "green",
            "headline": f"{c['company']}: volume up {c['vol_change_pct']}% with late rate down {c['late_drop_points']} pts.",
            "bullets": [
                f"Orders grew {c['vol_start']} → {c['vol_end']}.",
                f"Late rate improved {c['late_start']}% → {c['late_end']}%.",
                "Both volume and delivery quality trending up.",
            ],
            "has_root_cause": False,
        })

    # 4 — ODA structural lateness (yellow, not company-specific)
    oda = d.get("oda_lateness", {})
    if oda.get("fired"):
        patterns.append({
            "id": "oda_structural_lateness",
            "company": None,
            "severity": "yellow",
            "headline": f"ODA destinations run {oda['ratio']}x the late rate of standard pincodes.",
            "bullets": [
                f"ODA late rate {oda['oda_late_pct']}% vs {oda['non_oda_late_pct']}% non-ODA.",
                f"{oda['oda_count']} ODA shipments across all clients.",
                "Structural geography penalty, not an operational failure.",
            ],
            "has_root_cause": False,
        })

    # 5 — seasonal zone anomaly (yellow)
    seas = d.get("seasonal", {})
    if seas.get("fired"):
        wm = seas.get("worst_months", [])
        patterns.append({
            "id": "seasonal_zone_anomaly",
            "company": None,
            "severity": "yellow",
            "headline": f"East/NE lateness spikes {seas['ratio']}x in {wm[0]}–{wm[-1]}." if wm else "Seasonal East/NE lateness spike detected.",
            "bullets": [
                f"East/NE late rate {seas['zone_late_pct']}% in the worst window.",
                f"Overall late rate {seas['overall_late_pct']}%.",
                f"Worst months: {', '.join(wm)}." if wm else "Concentrated in the monsoon window.",
            ],
            "has_root_cause": False,
        })

    # 6 — bad lanes (grey, informational) — cap at 2 to avoid clutter
    for lane in d.get("bad_lane", {}).get("lanes", [])[:2]:
        patterns.append({
            "id": f"bad_lane_{lane['pincode']}",
            "company": None,
            "severity": "grey",
            "headline": f"Pincode {lane['pincode']} ({lane['city']}) fails SLA on {lane['late_pct']}% of orders.",
            "bullets": [
                f"{lane['total_orders']} adjudicated orders, {lane['late_pct']}% late.",
                f"Zone: {lane['zone']} · {lane['state']}.",
                "Chronic lane — candidate for carrier review.",
            ],
            "has_root_cause": False,
        })

    # 7 — new client ramp (green)
    for c in d.get("new_client", {}).get("companies", []):
        patterns.append({
            "id": f"new_client_{c['company']}",
            "company": c["company"],
            "severity": "green",
            "headline": f"{c['company']} ramped from zero to {c['recent_volume']} recent orders.",
            "bullets": [
                f"First active {c['first_active_month']}.",
                f"{c['recent_volume']} orders in the last two months.",
                f"Recent late rate {c['late_pct']}%.",
            ],
            "has_root_cause": False,
        })

    # 8 — overall trend (grey, always fires)
    trend = d.get("overall_trend", {})
    if trend.get("fired"):
        eb = trend.get("eot_by_month", [])
        best, worst = trend.get("best_month"), trend.get("worst_month")
        direction = trend.get("trend_direction", "flat")
        verb = {"improving": "is improving", "declining": "is slipping", "flat": "is holding steady"}[direction]
        patterns.append({
            "id": "overall_trend",
            "company": None,
            "severity": "grey",
            "headline": f"Overall E+OT {verb} — {trend.get('overall_eot', 0)}% across the dataset.",
            "bullets": [
                f"E+OT ranges {min(eb)}%–{max(eb)}% over {len(eb)} months." if eb else "Month-over-month E+OT computed.",
                f"Best month {best['month']} ({best['eot_percent']}%)." if best else "",
                f"Worst month {worst['month']} ({worst['eot_percent']}%)." if worst else "",
            ],
            "has_root_cause": False,
        })

    patterns.sort(key=lambda p: _SEVERITY_RANK.get(p["severity"], 9))

    # root causes for company-flagged patterns
    for company in dict.fromkeys(rc_companies):  # de-dupe, keep order
        f = root_cause_facts.get(company, {})
        root_causes[company] = {
            "oda_share": f.get("oda_share", 0.0),
            "dominant_zone": f.get("dominant_zone"),
            "worst_pincode": f.get("worst_pincode"),
            "worst_pincode_city": f.get("worst_pincode_city"),
            "worst_pincode_late_pct": f.get("worst_pincode_late_pct", 0.0),
            "narrative": _root_cause_narrative(company, f),
        }

    digest = _fallback_digest(d, current_snapshot, previous_snapshot)
    return {"digest": digest, "patterns": patterns, "root_causes": root_causes}


def _root_cause_narrative(company: str, f: dict) -> str:
    """Deterministic, zone-accurate root-cause prose. Makes no false geography claims.

    East/NE are the long-haul, high-variance corridors from the West-origin hub;
    West/South/North are mainland lanes. High ODA share (>~30% vs a ~22% book
    average) is the other structural driver. When neither holds, the lateness is
    called what it is — operational, not structural.
    """
    share = f.get("oda_share", 0.0) or 0.0
    zone = f.get("dominant_zone")
    wp, wc = f.get("worst_pincode"), f.get("worst_pincode_city")
    wl = f.get("worst_pincode_late_pct", 0.0) or 0.0
    hard_zone = zone in ("NE", "East")
    high_oda = share >= 0.30

    parts: list[str] = []
    if high_oda:
        parts.append(f"{_pct(share * 100)} of {company}'s orders route to ODA pincodes — "
                     f"well above the ~22% book average — and those lanes carry roughly "
                     f"double the base late rate.")
    else:
        parts.append(f"{_pct(share * 100)} of {company}'s orders route to ODA pincodes, "
                     f"near the book average.")
    if zone and hard_zone:
        parts.append(f"Its dominant lane is the {zone} zone — the longest-TAT, "
                     f"highest-variance corridor from the West-origin hub.")
    elif zone:
        parts.append(f"Its volume concentrates in the {zone} zone, a mainland lane with "
                     f"comparatively low structural TAT.")
    if wp and wl >= 0.5:
        parts.append(f"Its worst destination is {wp}"
                     + (f" ({wc})" if wc else "")
                     + f", late on {_pct(wl * 100)} of orders.")
    if hard_zone or high_oda:
        parts.append("Even with operational fixes this geography stays structurally hard, "
                     "adding expected TAT and baseline lateness.")
    else:
        parts.append("With a favourable lane mix, the rising lateness reads as operational "
                     "rather than structural — an execution problem, not a geography one.")
    return " ".join(parts)


def _fallback_digest(d: dict, cur: dict, prev: dict | None) -> list[str]:
    bullets: list[str] = []
    cur = cur or {}

    if prev:
        ce, pe = cur.get("eot_percent"), prev.get("eot_percent")
        if ce is not None and pe is not None:
            delta = round(ce - pe, 1)
            verb = "improved" if delta >= 0 else "slipped"
            bullets.append(f"E+OT {verb} {abs(delta)} points ({pe}% → {ce}%) vs the previous snapshot.")
        ct, pt = cur.get("total"), prev.get("total")
        if ct and pt:
            vd = round(100.0 * (ct - pt) / pt, 1)
            updown = "up" if vd >= 0 else "down"
            bullets.append(f"Total volume {updown} {abs(vd)}% ({pt} → {ct} orders).")
    else:
        if cur.get("eot_percent") is not None:
            bullets.append(f"Baseline established: {cur.get('eot_percent')}% E+OT across {cur.get('total', 0)} shipments.")
        bullets.append(f"{cur.get('delivered', 0)} delivered, {cur.get('late_count', 0)} late, {cur.get('rto_count', 0)} returned.")

    decl = d.get("volume_decline", {}).get("companies", [])
    if decl:
        c = decl[0]
        bullets.append(f"{c['company']} is deteriorating — late rate at {c['late_end']}%, volume down {abs(c['vol_change_pct'])}%.")
    churn = d.get("churned", {}).get("companies", [])
    if churn:
        c = churn[0]
        bullets.append(f"{c['company']} shipped 0 orders in the latest month after peaking at {c['peak_volume']}/month.")
    grow = d.get("growth", {}).get("companies", [])
    if grow:
        c = grow[0]
        bullets.append(f"{c['company']} is the standout gainer — volume up {c['vol_change_pct']}%, late rate down {c['late_drop_points']} pts.")
    oda = d.get("oda_lateness", {})
    if oda.get("fired"):
        bullets.append(f"ODA lanes run {oda['ratio']}x later than standard pincodes — a structural drag on E+OT.")
    trend = d.get("overall_trend", {})
    if trend.get("fired") and len(bullets) < 5:
        bullets.append(f"Headline arc: E+OT {trend.get('trend_direction', 'flat')} at {trend.get('overall_eot', 0)}% overall.")

    # exactly 5 where possible
    if len(bullets) > 5:
        bullets = bullets[:5]
    while len(bullets) < 5:
        bullets.append("No further material changes detected this period.")
    return bullets
