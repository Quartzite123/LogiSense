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

# ---- Story arc: aggregate monthly targets ------------------------------------
# Natural time series = trend + seasonality + SMALL autocorrelated noise.
# The arc is the story; per-company trajectories get normalized onto it.
MONTHLY_ARC = [
    {"volume": 470, "eot": 0.72},   # 2025-07 baseline
    {"volume": 440, "eot": 0.68},   # 2025-08 monsoon trough
    {"volume": 480, "eot": 0.71},   # 2025-09 monsoon easing
    {"volume": 530, "eot": 0.74},   # 2025-10 festive ramp
    {"volume": 570, "eot": 0.70},   # 2025-11 Diwali peak strains quality
    {"volume": 500, "eot": 0.75},   # 2025-12 normalization
    {"volume": 540, "eot": 0.78},   # 2026-01 improvement kicks in
    {"volume": 490, "eot": 0.80},   # 2026-02 improvement holds
]


# ---- Smooth trajectories + AR(1) noise ---------------------------------------
def lerp(a: float, b: float, m: int) -> float:
    """Smooth linear trajectory from a (month 0) to b (month 7)."""
    return a + (b - a) * (m / 7.0)


def ar1(phi: float = 0.6, amp: float = 0.06) -> list[float]:
    """Small autocorrelated random walk — month N+1 resembles month N."""
    out, prev = [], 0.0
    for _ in range(8):
        prev = phi * prev + random.uniform(-amp, amp)
        out.append(prev)
    return out


def traj(v0: float, v1: float, l0: float, l1: float) -> dict:
    """Company spec: smooth volume + late% endpoints, each x (1 + AR(1) noise)."""
    vn, ln = ar1(), ar1()
    return {
        "vol": [max(1.0, lerp(v0, v1, m) * (1 + vn[m])) for m in range(8)],
        "late": [min(80.0, max(2.0, lerp(l0, l1, m) * (1 + ln[m]))) for m in range(8)],
    }


# Planted stories are sacred — never nudged to fit the arc.
PLANTED = {"STELLARTECH SYSTEMS", "MERIDIAN ELECTRICALS", "PRISM INDUSTRIES",
           "ATLAS FASTENERS", "NEXUS FABRICATION"}

COMPANIES: dict[str, dict] = {
    "STELLARTECH SYSTEMS":  traj(30, 80, 25, 7),    # growth + improving
    "MERIDIAN ELECTRICALS": traj(20, 45, 30, 6),    # growth + improving
    "PRISM INDUSTRIES":     traj(40, 5, 8, 60),     # decline + deteriorating
    "ATLAS FASTENERS":      traj(25, 3, 10, 65),    # decline + deteriorating
    "NEXUS FABRICATION":    traj(28, 28, 40, 40),   # flat, then churns (below)
    "CREST AUTOMATION":     traj(20, 20, 7, 7),     # consistently excellent
    "FALCON EQUIPMENT":     traj(17, 17, 9, 9),     # consistently excellent
}
COMPANIES["NEXUS FABRICATION"]["vol"][7] = 0.0      # churn: silent after Jan 2026

# Growth group — new clients ramping up and improving.
for _n in ["APEX COMPONENTS LTD", "SUMMIT PRECISION", "LYNX SWITCHGEAR"]:
    COMPANIES[_n] = traj(10, 38, 35, 7)
# Decline group — slow-burn deterioration.
for _n in ["ZENITH HARDWARE", "DELTA TOOLS", "TERRA PACKAGING", "COBALT LOGISTICS"]:
    COMPANIES[_n] = traj(25, 8, 15, 45)
# Flat group — boring but reliable.
for _n in ["ORION VALVES", "SOLARIS FITTINGS", "ECLIPSE MERCHANDISE"]:
    COMPANIES[_n] = traj(random.uniform(15, 20), random.uniform(15, 20),
                         random.uniform(8, 12), random.uniform(8, 12))

# Formerly-"volatile" group — NORMAL smooth behaviour plus exactly ONE shock
# month each (independently chosen, so shocks are never synchronised): that
# month volume -40% and late% +25 points. One bad month each, not alternation.
SHOCKS: dict[str, int] = {}
for _n in ["NOVA INSTRUMENTS", "VORTEX MACHINERY", "HERALD ELECTRONICS",
           "PEAK ENGINEERING", "RIVERSTONE CONTROLS"]:
    COMPANIES[_n] = traj(random.uniform(15, 30), random.uniform(15, 30),
                         random.uniform(12, 20), random.uniform(12, 20))
    _s = random.randint(1, 6)                        # avoid first/last month edges
    SHOCKS[_n] = _s
    COMPANIES[_n]["vol"][_s] *= 0.60                 # -40% volume
    COMPANIES[_n]["late"][_s] = min(80.0, COMPANIES[_n]["late"][_s] + 25)

# ---- Normalize volumes onto the arc (aggregate matches the story) -------------
for m in range(8):
    _raw = sum(c["vol"][m] for c in COMPANIES.values())
    _scale = MONTHLY_ARC[m]["volume"] / _raw if _raw else 0.0
    for c in COMPANIES.values():
        c["vol"][m] = max(0, round(c["vol"][m] * _scale))
COMPANIES["NEXUS FABRICATION"]["vol"][7] = 0         # keep the churn after scaling

# ---- Build the unique-LRN order list -----------------------------------------
orders: list[dict] = []
_lrn = 500_000_001
for name, spec in COMPANIES.items():
    for m in range(8):
        for _ in range(int(spec["vol"][m])):
            orders.append({"lrn": _lrn, "company": name, "month": m})
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

# Lifecycle closure: a shipment can't still be "in transit" months later. Any
# order manifested before the last ~45 days of the dataset (< 15 Jan 2026) must
# be terminal (Delivered 97% / RTO 3%). Only recent orders stay non-delivered.
CLOSURE_CUTOFF = date(2026, 1, 15)
_NON_TERMINAL = {"In Transit", "Pending", "Dispatched"}
for o in orders:
    if o["manifest"] < CLOSURE_CUTOFF and o["status"] in _NON_TERMINAL:
        o["status"] = "RTO" if random.random() < 0.03 else "Delivered"

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


# ---- Late model: base late% x ODA x monsoon ----------------------------------
ODA_MULT = 2.0        # ODA orders ~2x the late rate of non-ODA
MONSOON_MULT = 1.8    # extra penalty for East/NE in Jul-Sep
NUDGE_MAX = 5.0       # background late% may be nudged at most +/-5 points
NUDGE = [0.0] * 8     # per-month nudge, background companies only


def base_late(o: dict, nudge: float | None = None) -> float:
    lp = COMPANIES[o["company"]]["late"][o["month"]]
    if o["company"] not in PLANTED:            # planted stories are sacred
        lp += NUDGE[o["month"]] if nudge is None else nudge
    return min(85.0, max(1.0, lp))


def p_late(o: dict, nudge: float | None = None) -> float:
    lp = base_late(o, nudge) / 100.0
    if o["oda"]:
        lp *= ODA_MULT
    if o["zone"] in ("East", "North-East") and o["month"] in MONSOON_MONTHS:
        lp *= MONSOON_MULT
    return min(0.95, max(0.02, lp))


def expected_eot(month: int, nudge: float) -> float | None:
    """Volume-weighted expected E+OT for a month at a given background nudge."""
    dels = [o for o in orders if o["month"] == month and o["status"] == "Delivered"]
    if not dels:
        return None
    tot = sum(1.0 if o.get("ne_special") else p_late(o, nudge) for o in dels)
    return 1.0 - tot / len(dels)


# Bisect the nudge so expected aggregate E+OT lands on the arc target.
for _m in range(8):
    _target = MONTHLY_ARC[_m]["eot"]
    _lo, _hi = -NUDGE_MAX, NUDGE_MAX
    for _ in range(40):
        _mid = (_lo + _hi) / 2
        _e = expected_eot(_m, _mid)
        if _e is None:
            break
        if _e > _target:      # too good -> need more late -> raise nudge
            _lo = _mid
        else:
            _hi = _mid
    NUDGE[_m] = round((_lo + _hi) / 2, 3)


def decide_sla(o) -> str:
    if random.random() < p_late(o):
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
_nd = [o for o in orders if o["status"] in ("In Transit", "Pending", "Dispatched")]
if _nd:
    _dts = [o["manifest"] for o in _nd]
    print(f"Non-delivered unique LRNs: {len(_nd)} | manifest {min(_dts)} .. {max(_dts)}"
          f" (all should be >= 2026-01-15)")
else:
    print("Non-delivered unique LRNs: 0")
for i, name in enumerate(FILE_NAMES):
    # Shuffle so overlap/carried rows aren't clustered.
    random.shuffle(files[i])
    df = pd.DataFrame(files[i], columns=COLUMNS)
    df.to_excel(OUT / name, index=False, engine="openpyxl")
    print(f"  {name}: {len(df)} rows")

# ---- Verification table ------------------------------------------------------
print("\nMonth   | Volume | target | Early | OnTime |  Late | E+OT% | target | nudge")
print("--------+--------+--------+-------+--------+-------+-------+--------+------")
_vols, _eots = [], []
for m in range(8):
    _mo = [o for o in orders if o["month"] == m]
    _de = [o for o in _mo if o["status"] == "Delivered"]
    e = sum(1 for o in _de if o["sla"] == "Early")
    ot = sum(1 for o in _de if o["sla"] == "On Time")
    la = sum(1 for o in _de if o["sla"] == "Late")
    eot = (e + ot) / max(1, e + ot + la) * 100
    _vols.append(len(_mo))
    _eots.append(eot)
    print(f"{MONTH_WINDOWS[m][0]:%Y-%m} | {len(_mo):6d} | {MONTHLY_ARC[m]['volume']:6d} |"
          f" {e:5d} | {ot:6d} | {la:5d} | {eot:5.1f} | {MONTHLY_ARC[m]['eot'] * 100:6.1f} |"
          f" {NUDGE[m]:+5.2f}")

_vd = max(abs(_vols[i + 1] - _vols[i]) / _vols[i] * 100 for i in range(7))
_ed = max(abs(_eots[i + 1] - _eots[i]) / _eots[i] * 100 for i in range(7))
print(f"\nMax MoM change: volume {_vd:.1f}% | E+OT {_ed:.1f}%   (must stay under 20%)")
print(f"E+OT range: {min(_eots):.1f}% .. {max(_eots):.1f}%")

print("\nSmooth trajectories (monthly unique LRNs):")
for _n in ["STELLARTECH SYSTEMS", "PRISM INDUSTRIES", "NOVA INSTRUMENTS"]:
    _mv = [sum(1 for o in orders if o["company"] == _n and o["month"] == m) for m in range(8)]
    _sh = f"   shock month: {MONTH_WINDOWS[SHOCKS[_n]][0]:%Y-%m}" if _n in SHOCKS else ""
    print(f"  {_n:22s} {_mv}{_sh}")
print("Done.")
