"""Shared transit risk classification.

Used by the transit + aggregate-transit routers and the export endpoints, so
the risk vocabulary is computed in exactly one place. Mirrors the logic in
app/sections/transit.py / aggregate_transit.py (read-only, unchanged), with the
Phase-2 refinement that RTO is its own terminal risk bucket.
"""
from __future__ import annotations

from datetime import date, datetime

# Sort order for the Risk Status column: At Risk → Due Today → RTO → on-track …
CATEGORY_PRIORITY = {
    "At Risk": 0,
    "Due Today": 1,
    "RTO": 2,
    "On Track": 3,
    "Pending": 4,
    "Unknown": 5,
}


def to_date(iso: str | None) -> date | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso).date()
    except (ValueError, TypeError):
        return None


def fmt_date(iso: str | None) -> str | None:
    d = to_date(iso)
    return d.strftime("%d %b %Y") if d else None


def classify(
    current_status: str | None,
    manifest_iso: str | None,
    pickup_iso: str | None,
    expected,
    today: date,
) -> tuple[str, int | None, int | None]:
    """Return (category, days_in_transit, days_remaining).

    Transit clock starts at Manifest Date, falling back to Pickup Date.
    category ∈ {At Risk, Due Today, On Track, RTO, Pending, Unknown}.
    """
    start = to_date(manifest_iso) or to_date(pickup_iso)
    dit = (today - start).days if start else None
    exp = int(expected) if expected is not None else None

    if current_status == "RTO":
        dr = (exp - dit) if (exp is not None and dit is not None) else None
        return "RTO", dit, dr
    if exp is None:
        return "Pending", dit, None
    if dit is None:
        return "Unknown", dit, None

    dr = exp - dit
    if dr < 0:
        return "At Risk", dit, dr
    if dr == 0:
        return "Due Today", dit, dr
    return "On Track", dit, dr


def risk_label(category: str, days_remaining: int | None) -> str:
    """Display string for the Risk Status column (blank for on-track/unknown)."""
    if category == "At Risk":
        return f"At Risk ({abs(days_remaining)} days overdue)"
    if category == "Due Today":
        return "Due Today"
    if category == "RTO":
        return "RTO"
    if category == "Pending":
        return "Pending"
    return ""
