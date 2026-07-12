"""Generate 8 demo Delhivery-format .xlsx files with planted analytics patterns.

Dev/demo tool only — does NOT touch app/ backend/ frontend/ tests/.
Every destination pincode is a REAL pincode pulled from
pincode_master_live in logisense.db (no invented pincodes).

Output: tools/sample_data/LogiSense_demo_0N_*.xlsx (8 files)

Planted signals (see README of this task):
- Per-company monthly volume + late% trends (growing / falling / churn / stable)
- ODA orders ~22%, worse SLA; East/NE monsoon dip (Jul-Sep 2025); one NE
  pincode chronically +3..+7 days late
- ~5,000 unique LRNs, ~450 appearing in two consecutive files (dedup exercise)
"""
from __future__ import annotations

import os
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

random.seed(42)  # reproducible

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "logisense.db"
OUT = ROOT / "tools" / "sample_data"

# ---- Exact 41 Delhivery columns (from app/store/schema.RAW_COLUMNS) ----------
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

# Origin is always Aurangabad (West). Zone matrix (origin West) — matches the
# live sla_matrix + ODA +1 rule, so planted Early/On Time/Late survive ingest.
MATRIX = {"West": 4, "South": 6, "North": 6, "East": 7, "North-East": 10}
ZONE_KEYS = ["West", "South", "North", "East", "North-East"]
ZONE_WEIGHTS = [35, 25, 20, 15, 5]           # destination mix
MONSOON_MONTHS = {0, 1, 2}                    # Jul, Aug, Sep 2025

FILE_NAMES = [
    "LogiSense_demo_01_Jul-Aug2025.xlsx",
    "LogiSense_demo_02_Aug-Sep2025.xlsx",
    "LogiSense_demo_03_Sep-Oct2025.xlsx",
    "LogiSense_demo_04_Oct-Nov2025.xlsx",
    "LogiSense_demo_05_Nov-Dec2025.xlsx",
    "LogiSense_demo_06_Dec2025-Jan2026.xlsx",
    "LogiSense_demo_07_Jan-Feb2026.xlsx",
    "LogiSense_demo_08_Feb-Jun2026.xlsx",
]
# Manifest-date window per file (one distinct month each; file 8 spans Feb-Jun).
MONTH_WINDOWS = [
    (date(2025, 7, 1), date(2025, 7, 31)),
    (date(2025, 8, 1), date(2025, 8, 31)),
    (date(2025, 9, 1), date(2025, 9, 30)),
    (date(2025, 10, 1), date(2025, 10, 31)),
    (date(2025, 11, 1), date(2025, 11, 30)),
    (date(2025, 12, 1), date(2025, 12, 31)),
    (date(2026, 1, 1), date(2026, 1, 31)),
    # File 8 is labelled Feb-Jun 2026, but manifests are concentrated in Feb so
    # the 8th monthly bar stays clean (deliveries/scans extend through Jun via
    # TAT). This preserves the intended per-company monthly growth/decline story.
    (date(2026, 2, 1), date(2026, 2, 28)),
]


def rand_date(month_idx: int) -> date:
    lo, hi = MONTH_WINDOWS[month_idx]
    return lo + timedelta(days=random.randint(0, (hi - lo).days))


# ---- Real pincode pools from the live master (oda flag in one pass) ----------
def load_pools():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    oda = {z: [] for z in ZONE_KEYS}
    normal = {z: [] for z in ZONE_KEYS}
    for pin, state, zone, flag in cur.execute(
        "SELECT pincode, state, zone, oda FROM pincode_master_live"
    ):
        if zone not in ZONE_KEYS:
            continue
        (oda if flag == "YES" else normal)[zone].append((int(pin), state))
    conn.close()
    return oda, normal


ODA_POOL, NORMAL_POOL = load_pools()
# First NE ODA pincode (deterministic) — the chronically-late destination.
NE_SPECIAL_PIN, NE_SPECIAL_STATE = sorted(ODA_POOL["North-East"])[0]

# ---- Company patterns --------------------------------------------------------
COMPANIES: dict[str, dict] = {
    "STELLARTECH SYSTEMS": {"vol": [30, 35, 42, 50, 58, 65, 72, 80],
                            "late": [25, 22, 18, 15, 12, 10, 8, 7]},
    "MERIDIAN ELECTRICALS": {"vol": [20, 22, 25, 28, 32, 36, 40, 45],
                             "late": [30, 25, 20, 16, 12, 10, 8, 6]},
    "PRISM INDUSTRIES": {"vol": [40, 38, 35, 30, 22, 15, 10, 5],
                         "late": [8, 12, 18, 25, 35, 45, 55, 60]},
    "ATLAS FASTENERS": {"vol": [25, 24, 22, 20, 15, 10, 6, 3],
                        "late": [10, 15, 22, 30, 40, 50, 60, 65]},
    # Active months 1-7 only, then churns to zero.
    "NEXUS FABRICATION": {"vol": [30, 28, 32, 26, 30, 24, 20, 0],
                          "late": [40, 38, 42, 36, 44, 40, 38, 0]},
    # Consistently excellent.
    "CREST AUTOMATION": {"vol": [random.randint(18, 22) for _ in range(8)],
                         "late": [random.uniform(5, 8) for _ in range(8)]},
    "FALCON EQUIPMENT": {"vol": [random.randint(15, 20) for _ in range(8)],
                         "late": [random.uniform(8, 12) for _ in range(8)]},
}

RANDOM_NAMES = [
    "NOVA INSTRUMENTS", "APEX COMPONENTS LTD", "VORTEX MACHINERY", "ZENITH HARDWARE",
    "DELTA TOOLS", "HERALD ELECTRONICS", "SUMMIT PRECISION", "TERRA PACKAGING",
    "LYNX SWITCHGEAR", "ORION VALVES", "SOLARIS FITTINGS", "PEAK ENGINEERING",
    "RIVERSTONE CONTROLS", "COBALT LOGISTICS", "ECLIPSE MERCHANDISE",
]

# Size the 15 unpatterned companies so the grand total lands near 5,000 LRNs.
_fixed_total = sum(sum(c["vol"]) for c in COMPANIES.values())
_per_cm = max(8.0, (5000 - _fixed_total) / (len(RANDOM_NAMES) * 8))
for name in RANDOM_NAMES:
    COMPANIES[name] = {
        "vol": [max(8, int(random.gauss(_per_cm, _per_cm * 0.3))) for _ in range(8)],
        "late": [random.uniform(10, 25) for _ in range(8)],
    }

# ---- Build the unique-LRN order list -----------------------------------------
orders: list[dict] = []
_lrn = 500_000_001
for name, spec in COMPANIES.items():
    for m in range(8):
        for _ in range(spec["vol"][m]):
            orders.append({"lrn": _lrn, "company": name, "month": m,
                           "late_pct": spec["late"][m]})
            _lrn += 1


def pick_destination():
    zone = random.choices(ZONE_KEYS, weights=ZONE_WEIGHTS)[0]
    is_oda = random.random() < 0.22
    pool = ODA_POOL[zone] if is_oda else NORMAL_POOL[zone]
    if not pool:                       # fallback if a zone/oda pool is empty
        is_oda = False
        pool = NORMAL_POOL[zone] or NORMAL_POOL["West"]
    pin, state = random.choice(pool)
    return zone, is_oda, pin, state


def sample_status() -> str:
    r = random.random()
    if r < 0.85:
        return "Delivered"
    if r < 0.93:
        return "In Transit"
    if r < 0.97:
        return "Pending"
    if r < 0.99:
        return "Dispatched"
    return "RTO"


for o in orders:
    zone, is_oda, pin, state = pick_destination()
    o.update(zone=zone, oda=is_oda, pin=pin, state=state,
             expected=MATRIX[zone] + (1 if is_oda else 0),
             manifest=rand_date(o["month"]), status=sample_status())

# ~450 overlap LRNs: appear in two consecutive files (dedup exercise).
_cands = [o for o in orders if o["month"] <= 6 and o["status"] == "Delivered"]
random.shuffle(_cands)
for o in _cands[:450]:
    o["overlap"] = True
    o["status"] = "RTO" if random.random() < 0.03 else "Delivered"  # later-file state

# ~15 orders to the one chronically-late NE pincode (any company).
_ne = [o for o in orders if o["status"] == "Delivered" and not o.get("overlap")]
random.shuffle(_ne)
for o in _ne[:15]:
    o.update(zone="North-East", oda=True, pin=NE_SPECIAL_PIN, state=NE_SPECIAL_STATE,
             expected=MATRIX["North-East"] + 1, ne_special=True)


def decide_sla(o) -> str:
    lp = o["late_pct"] / 100.0
    if o["oda"]:
        lp = max(lp, 0.35)                              # ODA worse (~35%)
    if o["zone"] in ("East", "North-East") and o["month"] in MONSOON_MONTHS:
        lp *= 2                                         # monsoon dip
    lp = min(0.95, max(0.02, lp))
    if random.random() < lp:
        return "Late"
    return "On Time" if random.random() < 0.22 else "Early"


def actual_tat(sla: str, expected: int) -> int:
    if sla == "Late":
        return expected + random.randint(1, 4)
    if sla == "On Time":
        return expected
    return max(1, expected - random.randint(1, max(1, min(3, expected - 1))))


for o in orders:
    if o["status"] == "Delivered":
        if o.get("ne_special"):
            o["sla"], o["actual"] = "Late", o["expected"] + random.randint(3, 7)
        else:
            o["sla"] = decide_sla(o)
            o["actual"] = actual_tat(o["sla"], o["expected"])
    else:
        o["sla"] = o["actual"] = None


# ---- Row builder -------------------------------------------------------------
def build_row(o: dict, role: str) -> dict:
    row = {c: None for c in COLUMNS}
    manifest = o["manifest"]
    pickup = manifest + timedelta(days=random.randint(0, 1))
    row.update({
        "LRN": o["lrn"], "Order id": o["company"], "Client": "logisense demo",
        "No of boxes": random.randint(1, 5), "Origin City": "Aurangabad",
        "Client Location/warehouse": "Aurangabad", "Destination City": o["state"],
        "State": o["state"], "Pin code": o["pin"], "Invoice Number": f"INV{o['lrn']}",
        "Consignee name": f"{o['company']} - {o['state']}",
        "Payment Type": "COD" if random.random() < 0.05 else "Pre-paid",
        "Master Waybill": 700_000_000 + o["lrn"] % 1_000_000,
        "Package Amount": round(random.uniform(100, 5000), 2),
        "Weight": round(random.uniform(0.5, 25), 2), "Attempt Count": 1.0,
        "Dispatch Count": random.randint(1, 3), "Manifest Date": manifest,
        "Pickup Date": pickup,
        "Expected Date": manifest + timedelta(days=o["expected"]),
        "Invoice Zone": o["zone"],
    })

    if role == "earlier":                              # in-flight state (file N)
        st = "In Transit" if random.random() < 0.6 else "Pending"
        row["Current Status"] = st
        row["Status Type"] = st
        row["Remarks"] = ("In Transit to next hub" if st == "In Transit"
                          else "Undelivered - Consignee unavailable")
        row["Last Scan Date"] = pickup + timedelta(days=1)
        return row

    st = o["status"]                                    # single / later state
    row["Current Status"] = st
    row["Status Type"] = st
    if st == "Delivered":
        deliv = manifest + timedelta(days=o["actual"])
        row["Delivered Date"] = deliv
        row["Last Scan Date"] = deliv
        row["Remarks"] = "Delivered to Consignee"
    elif st == "RTO":
        row["Remarks"] = "RTO - Return to Origin"
        row["Last Scan Date"] = pickup + timedelta(days=random.randint(2, 6))
    elif st == "In Transit":
        row["Remarks"] = "In Transit to next hub"
        row["Last Scan Date"] = pickup + timedelta(days=1)
    elif st == "Pending":
        row["Remarks"] = "Undelivered - Consignee unavailable"
    elif st == "Dispatched":
        row["Remarks"] = "Consignment Dispatched from Origin City"
    return row


# ---- Emit rows per file ------------------------------------------------------
files: list[list[dict]] = [[] for _ in range(8)]
for o in orders:
    m = o["month"]
    if o.get("overlap"):
        files[m].append(build_row(o, "earlier"))
        files[m + 1].append(build_row(o, "later"))
    else:
        files[m].append(build_row(o, "single"))

OUT.mkdir(parents=True, exist_ok=True)
print(f"NE chronically-late pincode: {NE_SPECIAL_PIN} ({NE_SPECIAL_STATE})")
print(f"Unique LRNs: {len(orders)} | overlap LRNs: {sum(1 for o in orders if o.get('overlap'))}")
for i, name in enumerate(FILE_NAMES):
    # Shuffle so overlap/carried rows aren't clustered.
    random.shuffle(files[i])
    df = pd.DataFrame(files[i], columns=COLUMNS)
    df.to_excel(OUT / name, index=False, engine="openpyxl")
    print(f"  {name}: {len(df)} rows")
print("Done.")
