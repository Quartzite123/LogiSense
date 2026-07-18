"""Generate a realistic ~120-row Delhivery-format .xlsx a visitor can upload on
the live demo to see the What-Changed digest + all sections react.

Dated Feb–Apr 2026 (overlapping the tail of the bundled demo.db and extending
past it), with a realistic status mix (mostly Delivered, some in-flight, a few
RTO) and ~20% ODA orders to REAL pincodes from pincode_master_live. Origin is
always Aurangabad (West).

Output: tools/demo_upload.xlsx
"""
from __future__ import annotations

import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

random.seed(42)  # reproducible

ROOT = Path(__file__).resolve().parent.parent
DB = next((p for p in (ROOT / "demo" / "demo.db", ROOT / "logisense.db") if p.exists()), None)
OUT = ROOT / "tools" / "demo_upload.xlsx"

# Exact 41 Delhivery columns (from app/store/schema.RAW_COLUMNS).
COLUMNS = [
    "LRN", "Order id", "No of boxes", "Client", "Manifest Date", "Pickup Date",
    "Expected Date", "Invoice Number", "Consignee name", "Origin City",
    "Destination City", "Client Location/warehouse", "Pick up Address", "Pin code",
    "Dispatch Count", "First dispatch date", "Last dispatch date",
    "Last Scan Location", "Last Scan Date", "Current Status", "Status Type",
    "Remarks", "Promise Date", "Delivered Date", "Payment Type", "Master Waybill",
    "Additional Remarks", "Return Promise Date", "Transaction Type",
    "Transaction Mode", "First Pending Date", "Package Amount", "Weight",
    "First attempt date", "Last Attempt date", "Attempt Count", "First Return Date",
    "Invoice Zone", "RVP/ Forward identifier", "PUR ID", "State",
]

# Origin West → destination TAT matrix (matches the live SLA matrix; ODA adds +1).
MATRIX = {"West": 4, "South": 6, "North": 6, "East": 7, "North-East": 10}
ZONE_KEYS = ["West", "South", "North", "East", "North-East"]
ZONE_WEIGHTS = [35, 25, 20, 15, 5]

# company -> (order count, target E+OT fraction among its delivered orders).
COMPANIES = {
    "STELLARTECH SYSTEMS": (40, 0.88),
    "MERIDIAN ELECTRICALS": (28, 0.82),
    "PRISM INDUSTRIES": (22, 0.38),   # still struggling
    "CREST AUTOMATION": (18, 0.94),
    "LYNX SWITCHGEAR": (12, 0.86),
}  # total = 120

# Overall status mix (~75% Delivered / 12% In Transit / 8% Pending / 5% RTO).
STATUSES = ["Delivered", "In Transit", "Pending", "RTO"]
STATUS_WEIGHTS = [75, 12, 8, 5]

WINDOW = (date(2026, 2, 1), date(2026, 4, 30))
ODA_SHARE = 0.20


def load_pools():
    """Real (pincode, state) lists per zone, split by ODA flag, from the master."""
    if DB is None:
        raise SystemExit("No logisense.db / demo/demo.db found to source pincodes from.")
    conn = sqlite3.connect(str(DB))
    oda = {z: [] for z in ZONE_KEYS}
    normal = {z: [] for z in ZONE_KEYS}
    for pin, state, zone, flag in conn.execute(
        "SELECT pincode, state, zone, oda FROM pincode_master_live"
    ):
        if zone in ZONE_KEYS:
            (oda if flag == "YES" else normal)[zone].append((int(pin), state))
    conn.close()
    return oda, normal


ODA_POOL, NORMAL_POOL = load_pools()


def rand_date() -> date:
    lo, hi = WINDOW
    return lo + timedelta(days=random.randint(0, (hi - lo).days))


def pick_destination():
    zone = random.choices(ZONE_KEYS, weights=ZONE_WEIGHTS)[0]
    is_oda = random.random() < ODA_SHARE
    pool = (ODA_POOL if is_oda else NORMAL_POOL)[zone]
    if not pool:
        is_oda, pool = False, NORMAL_POOL[zone] or NORMAL_POOL["West"]
    pin, state = random.choice(pool)
    return zone, is_oda, pin, state


def actual_tat(sla: str, expected: int) -> int:
    if sla == "Late":
        return expected + random.randint(1, 4)
    if sla == "On Time":
        return expected
    return max(1, expected - random.randint(1, max(1, min(3, expected - 1))))


def build_row(lrn: int, company: str, status: str, sla: str | None) -> dict:
    zone, is_oda, pin, state = pick_destination()
    expected = MATRIX[zone] + (1 if is_oda else 0)
    manifest = rand_date()
    pickup = manifest + timedelta(days=random.randint(0, 1))

    row = {c: None for c in COLUMNS}
    row.update({
        "LRN": lrn, "Order id": company, "Client": "logisense demo",
        "No of boxes": random.randint(1, 5), "Origin City": "Aurangabad",
        "Client Location/warehouse": "Aurangabad", "Destination City": state,
        "State": state, "Pin code": pin, "Invoice Number": f"INV{lrn}",
        "Consignee name": f"{company} - {state}",
        "Payment Type": "COD" if random.random() < 0.05 else "Pre-paid",
        "Master Waybill": 700_000_000 + lrn % 1_000_000,
        "Package Amount": round(random.uniform(100, 5000), 2),
        "Weight": round(random.uniform(0.5, 25), 2), "Attempt Count": 1.0,
        "Dispatch Count": random.randint(1, 3), "Manifest Date": manifest,
        "Pickup Date": pickup, "Expected Date": manifest + timedelta(days=expected),
        "Invoice Zone": zone, "Current Status": status, "Status Type": status,
    })

    if status == "Delivered":
        delivered = manifest + timedelta(days=actual_tat(sla, expected))
        row["Delivered Date"] = delivered
        row["Last Scan Date"] = delivered
        row["Remarks"] = "Delivered to Consignee"
    elif status == "RTO":
        row["Remarks"] = "RTO - Return to Origin"
        row["Last Scan Date"] = pickup + timedelta(days=random.randint(2, 6))
    elif status == "In Transit":
        row["Remarks"] = "In Transit to next hub"
        row["Last Scan Date"] = pickup + timedelta(days=1)
    elif status == "Pending":
        row["Remarks"] = "Undelivered - Consignee unavailable"
    return row


def main() -> None:
    rows: list[dict] = []
    lrn = 900_000_001
    for company, (n, eot) in COMPANIES.items():
        for _ in range(n):
            status = random.choices(STATUSES, weights=STATUS_WEIGHTS)[0]
            if status == "Delivered":
                if random.random() < (1 - eot):
                    sla = "Late"
                else:
                    sla = "Early" if random.random() < 0.70 else "On Time"
            else:
                sla = None
            rows.append(build_row(lrn, company, status, sla))
            lrn += 1

    random.shuffle(rows)
    df = pd.DataFrame(rows, columns=COLUMNS)
    df.to_excel(OUT, index=False, engine="openpyxl")

    print(f"Sourced pincodes from: {DB}")
    print(f"Wrote {OUT}  ({len(df)} rows, {len(COLUMNS)} columns)")
    print("Status mix:", df["Current Status"].value_counts().to_dict())
    print("Per-company counts:", df["Order id"].value_counts().to_dict())
    oda_ct = sum(
        1 for _, r in df.iterrows()
        if (r["Invoice Zone"], int(r["Pin code"]))
        and any(int(r["Pin code"]) == p for p, _ in ODA_POOL.get(r["Invoice Zone"], []))
    )
    print(f"ODA orders (approx): {oda_ct} / {len(df)}")


if __name__ == "__main__":
    main()
