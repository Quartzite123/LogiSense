# LogiSense — Logistics Intelligence Platform

> A production **FastAPI + React** logistics analytics dashboard for parcel
> distribution companies — built and deployed for a real logistics aggregator
> (Delhivery + Blue Dart channel partner), with an integrated **AI assistant**
> (Groq / Llama 3.3 70B).
>
> This README is the single source of truth for the entire project: architecture,
> business logic, data pipeline, API surface, frontend components, and operational
> commands. Self-sufficient — an engineer reading this straight through has the
> complete picture without needing any prior conversation.

---

## Live Demo

- **Dashboard:** https://logi-sense-one.vercel.app
- **Login:** demo@logisense.app / demo1234
- **API docs:** https://logisense-1dvc.onrender.com/docs
- Demo data: 4,017 shipments across 22 companies (Jul 2025 – Feb 2026)
- Upload `tools/demo_upload.xlsx` to see the What-Changed digest in action

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Core Business Logic (LOCKED)](#4-core-business-logic-locked)
5. [The Data Pipeline (`app/`)](#5-the-data-pipeline-app)
6. [The Database](#6-the-database)
7. [Backend API (`backend/`)](#7-backend-api-backend)
8. [Frontend (`frontend/`)](#8-frontend-frontend)
9. [The AI Assistant](#9-the-ai-assistant)
10. [Design System](#10-design-system)
11. [Performance Optimizations](#11-performance-optimizations)
12. [Running the Project](#12-running-the-project)
13. [Testing](#13-testing)
14. [Known Quirks & Gotchas](#14-known-quirks--gotchas)
15. [Pending / Future Work](#15-pending--future-work)
16. [Migration History](#16-migration-history)
17. [Glossary](#17-glossary)

---

## 1. What This Project Does

A logistics company uploads its raw **Delhivery export file** (a 41-column `.xlsx`).
LogiSense then:

1. **Ingests** the file — parses, cleans, deduplicates shipment records
2. **Enriches** each shipment — resolves origin/destination zones, ODA status, expected TAT
3. **Classifies** delivery performance — Early / On Time / Late per order
4. **Visualizes** everything — KPI cards, charts, drill-down tables across 7 sections
5. **Answers questions** — an AI assistant queries live data in natural language

The platform is used to monitor SLA compliance, catch at-risk orders before breach,
and evaluate per-client performance.

### Hard constraints (from the original design — still binding)

| # | Constraint | Why |
|---|---|---|
| 1 | **No cloud dependency** — nothing on AWS/GCP/Azure | Data is operational + commercially sensitive |
| 2 | **No internet needed during operation** (AI assistant is the sole optional exception) | Must work with unreliable connectivity |
| 3 | **Files uploaded manually** through the UI — no email fetch, no scheduled sync | Simpler ops; founders export weekly |
| 4 | **Minimal install friction** — target: double-click to run (drives Phase 4 Electron .exe) | Founders are non-technical |
| 5 | **Runs comfortably on 8 GB RAM Windows laptops** | Founder hardware varies |
| 6 | **Reference-data edits must NOT rewrite history** — matrix/ODA edits affect only future uploads; past shipments keep their stored SLA values | Audit trust |

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Data pipeline | Python 3.x (pandas, openpyxl) | Core pipeline — battle-tested, 28 unit tests |
| Database | SQLite (WAL mode) | Single file `logisense.db`, gitignored |
| Backend API | FastAPI + uvicorn | Async, auto-docs at `/docs` |
| Frontend | React 18 + Vite | SPA, lazy-loaded routes |
| Styling | Tailwind CSS + custom tokens | No component libraries |
| Charts | Recharts | Donut, composed line, grouped/stacked bars |
| Data fetching | TanStack React Query | 5-min stale time, cache invalidation on upload |
| AI | Groq API (Llama 3.3 70B) | Free tier, ~sub-second responses |
| Tests | pytest (28 tests) | Cover the `app/` pipeline only |

---

## 3. Project Structure

```
LogiSense/
├── app/                          # ⚠ LOCKED — original data pipeline (do not modify)
│   ├── pipeline/
│   │   ├── ingest.py             # Upload processing: DELETE-then-INSERT, dedup, enrich
│   │   ├── dedup.py              # Keeps latest snapshot per LRN
│   │   ├── sla.py                # compute_row(): TAT + Early/OnTime/Late classification
│   │   ├── zones.py              # Destination pincode → zone lookup
│   │   ├── oda.py                # lookup_oda(): YES/NO/UNKNOWN per pincode
│   │   └── origin_lookup.py      # 3-tier origin city → zone chain
│   ├── store/
│   │   ├── db.py                 # SQLite connection factory, WAL PRAGMA, get_db_path()
│   │   ├── seed.py               # First-run seeding: matrix, pincode master, STATE_ZONE
│   │   ├── schema.py             # CREATE TABLE definitions
│   │   └── queries.py            # Original query functions (load_latest, trends…)
│   ├── reference/
│   │   ├── pincode_master.xlsx   # 21,847 Indian pincodes with ODA flags (public data)
│   │   └── matrix.csv            # 5×5 zone TAT matrix
│   └── data/
│       └── origin_city_master.csv  # 135 Indian cities with state/zone
│
├── backend/                      # FastAPI application
│   ├── main.py                   # App entry: CORS, routers, startup seeding, indexes,
│   │                             #   static serving of frontend/dist, load_dotenv()
│   ├── schemas.py                # All Pydantic response models + COLUMN_DISPLAY_NAMES
│   ├── db_utils.py               # get_conn() with perf PRAGMAs + in-memory cache
│   ├── transit_risk.py           # Shared risk classifier (single source of truth)
│   ├── .env                      # GROQ_API_KEY (gitignored — never commit)
│   └── routers/
│       ├── upload.py             # POST /api/upload + GET /api/export
│       ├── landing.py            # /api/landing/kpis /donut /trend (cached)
│       ├── tat.py                # /api/tat/orders /summary /oda-chart
│       ├── transit.py            # /api/transit/orders /summary
│       ├── aggregate.py          # /api/aggregate/companies /monthly
│       ├── aggregate_transit.py  # /api/aggregate-transit/companies /company-detail
│       ├── customize.py          # /api/customize/orders (filtered)
│       ├── exports.py            # /api/export/{tat,transit,aggregate,…} → xlsx
│       ├── edit.py               # /api/edit/matrix /pincodes
│       └── assistant.py          # POST /api/assistant/chat (Groq) — Phase 3
│
├── frontend/                     # React SPA
│   ├── index.html                # Entry, favicon, PWA manifest link
│   ├── vite.config.js            # /api → 127.0.0.1:8000 proxy (IPv4, not localhost)
│   ├── tailwind.config.js
│   ├── public/
│   │   ├── favicon.svg           # Yellow circle + "L"
│   │   └── manifest.json         # PWA manifest
│   └── src/
│       ├── main.jsx              # QueryClient (staleTime 5m, no window-focus refetch)
│       ├── App.jsx               # Router, lazy pages, Suspense, UIProvider
│       ├── index.css             # Global CSS: bg, scrollbars, selection
│       ├── lib/api.js            # fetch helpers
│       ├── context/ui.jsx        # Global upload-modal + toast state
│       ├── styles/tokens.js      # Design tokens (colors, radii, spacing, fonts)
│       ├── components/
│       │   ├── Sidebar.jsx       # Nav: 8 items, yellow active border, collapse
│       │   ├── PageHeader.jsx    # Title + subtitle + Upload button (all pages)
│       │   ├── KPICard.jsx       # Label/value/subtext/progress-bar/isDateCard
│       │   ├── DataTable.jsx     # Zebra, sticky sortable header, toolbar, expand
│       │   ├── StatusPill.jsx    # Colored pills for every status type
│       │   ├── ColumnPicker.jsx  # Show/hide columns + Sort By/Direction
│       │   ├── UploadModal.jsx   # Global drag-drop modal (replaces all data)
│       │   ├── Toast.jsx         # Top-right success/error toasts
│       │   ├── Skeleton.jsx      # Shimmer loading placeholder
│       │   ├── EmptyState.jsx    # Zero-data state with upload CTA
│       │   ├── filters/
│       │   │   ├── FilterPanel.jsx     # Collapsible filter container
│       │   │   ├── FilterSelect.jsx    # Multiselect with chips + All/Clear
│       │   │   └── SegmentedToggle.jsx # Detail/Aggregate, ODA 3-way, Asc/Desc
│       │   └── charts/
│       │       ├── chartTheme.js  # Shared grid/axis/tooltip/legend styling
│       │       ├── Donut.jsx      # innerR 70/outerR 110, center total
│       │       ├── TrendChart.jsx # ComposedChart, dual Y-axis, E+OT% line
│       │       ├── GroupedBar.jsx # 280px, barSize 28, truncated -40° labels
│       │       ├── StackedBar.jsx # Monthly Early/OnTime/Late/NotDelivered
│       │       └── ChartPair.jsx  # Fixed donut + type/dimension-selectable chart
│       └── pages/
│           ├── Landing.jsx        # 12 KPI cards + donut + trend + month table
│           ├── TAT.jsx            # Chips + ODA chart + column picker + table
│           ├── Transit.jsx        # Risk chips + donut + ChartPair + risk table
│           ├── Aggregate.jsx      # Company table + perf bar + monthly stacked
│           ├── AggregateTransit.jsx # Company dropdown + risk summary + overdue
│           ├── Customize.jsx      # Filters + toggle + result count + export
│           ├── Assistant.jsx      # AI chat: bubbles, suggestions, history
│           └── Edit.jsx           # Region matrix + pincode master tabs
│
├── tools/
│   ├── generate_sample_data.py   # Synthetic data generator (reads real ODA pincodes from DB)
│   └── sample_data/              # 8 generated demo files (Jul 2025 – Jun 2026)
│
├── tests/                        # 28 pytest tests (app/ pipeline coverage)
├── logisense.db                  # SQLite database (gitignored)
└── requirements.txt              # Python deps
```

**Golden rule:** everything in `app/pipeline/` and `app/store/` is LOCKED.
The FastAPI backend imports from it; it never modifies it. All 28 tests target this layer.

---

## 4. Core Business Logic (LOCKED)

These rules are the heart of the product. They were refined against real production
data and must never change without sign-off.

### 4.1 TAT (Turn-Around Time)

```
actual_tat = (Delivered Date − Manifest Date) in calendar days
```

- **Start = Manifest Date** (NOT Pickup Date). Delhivery takes custody at manifest.
  Manifest is always ≤ Pickup; ~49% of orders manifest 1 day before pickup.
- Date-only subtraction — time components stripped to avoid fractional days.
- Calendar days, not business days.
- The DB column is still named `pickup_date` for the pickup value; only the display
  label changed to "Manifest Date" in tables where manifest drives the calculation.

### 4.2 Zone Matrix (5×5, days)

|            | West | South | North | East | NE |
|------------|------|-------|-------|------|----|
| **West**   | 4    | 6     | 6     | 7    | 10 |
| **South**  | 6    | 4     | 6     | 7    | 10 |
| **North**  | 6    | 6     | 4     | 7    | 8  |
| **East**   | 7    | 7     | 7     | 4    | 6  |
| **NE**     | 10   | 10    | 8     | 6    | 4  |

- Row = origin zone, column = destination zone, value = expected TAT days.
- Stored in `sla_matrix_live` table; seeded from `app/reference/matrix.csv`.
- Editable via the Edit section (edits affect FUTURE uploads only — past shipments
  keep their stored `_expected_tat_days`).

### 4.3 ODA (Out of Delivery Area)

- If destination pincode is ODA: `expected_tat += 1`
- Source values normalized at pincode import: `"ODA"` → `YES`, `"Normal Service"` → `NO`
  (plus tolerant aliases: yes/y/1 → YES, no/n/0 → NO)
- `lookup_oda()` returns `YES` / `NO` / `UNKNOWN` — UNKNOWN when pincode not in master
- **UNKNOWN is treated as NO** for Expected TAT — no +1 penalty is applied when
  the pincode can't be found in the master
- **ODA is data-dependent**: if a dataset's destinations are all metro pincodes,
  ODA counts are legitimately 0. This is correct behavior, not a bug.

### 4.4 SLA Classification (displayed as "E+OT" in UI)

```
actual_tat <  expected_tat  → Early
actual_tat == expected_tat  → On Time
actual_tat >  expected_tat  → Late

E+OT % = (Early + On Time) / (Early + On Time + Late) × 100
```

- "SLA" is renamed to **E+OT** in ALL UI labels (founders found "SLA" confusing).
- Internal names (`_sla_status`, function names, DB columns) are unchanged.
- The per-order column "SLA Status" displays as "**Delivery Status**".

### 4.5 State → Zone Mapping (critical corrections)

| State | Zone | Why this matters |
|---|---|---|
| Chhattisgarh | **East** (NOT West) | Routes via Kolkata/Raipur East hub |
| Sikkim | **East** (NOT NE) | Serviced via Siliguri corridor |
| Odisha/Orissa | East | Both spellings handled |
| Daman & Diu / Daman and Diu | West | Alias handling |
| Pondicherry / Puducherry | South | Alias handling |
| Jammu & Kashmir / Jammu and Kashmir | North | Alias handling |

### 4.6 Upload Behavior — ALWAYS REPLACE

- Every upload **deletes all existing data** before inserting
  (`DELETE FROM shipments_latest` + `shipments_raw`).
- DELETE runs **once per upload session** (before the file loop), so multi-file
  batches merge together, then jointly replace old data.
- Rationale: founders upload complete Delhivery exports; accumulating periods
  would produce misleading mixed charts.
- After upload: `recompute_all_sla()` runs; frontend invalidates ALL React Query
  caches; backend in-memory cache is cleared.

### 4.7 Transit Risk Classification

```
days_in_transit = (today − manifest_date).days     [fallback: pickup_date]
days_remaining  = expected_tat_days − days_in_transit

days_remaining < 0            → "At Risk (Xd overdue)"
days_remaining == 0           → "Due Today"
days_remaining > 0            → "" (on track, blank)
expected_tat_days IS NULL     → "Pending"
current_status = 'RTO'        → "RTO" (own bucket in /transit endpoints)
```

- Shared classifier lives in `backend/transit_risk.py` — single source of truth
  used by Transit, Aggregate Transit, and exports.
- **Exception:** `/api/aggregate-transit/company-detail` uses the original 4-bucket
  date-based classification (At Risk/Due Today/On Track/Pending) where RTO orders
  are bucketed by date.

### 4.8 The `client` vs `order_id` Quirk (IMPORTANT)

In real Delhivery exports for aggregators:
- `client` column = the Delhivery account name (constant per aggregator account) — useless for grouping
- `order_id` column = the actual **end-client company name** (STELLARTECH SYSTEMS, MERIDIAN ELECTRICALS, …)

**Every backend company filter/grouping uses `order_id`, aliased as `company` in
responses.** `client` appears only as a display column.

---

## 5. The Data Pipeline (`app/`)

### 5.1 Ingest flow (`ingest.py`)

```
Upload .xlsx → validate REQUIRED_COLUMNS {LRN, Current Status, Pickup Date, Remarks}
→ parse 41 columns → normalize → dedup (winner per LRN — see 5.2)
→ per-row enrichment via compute_row():
    origin city → origin zone      (origin_lookup.py, 3-tier chain)
    dest pincode → dest zone       (zones.py, pincode master → state fallback)
    dest pincode → ODA YES/NO      (oda.py, UNKNOWN = no penalty)
    matrix[origin][dest] + ODA adj → _expected_tat_days
    delivered − manifest           → _actual_tat_days
    classification                 → _sla_status
→ INSERT into shipments_latest (winners) + shipments_raw (all rows, with
  uuid batch_id + uploaded_at stamped on every row)
```

- A file missing any REQUIRED_COLUMN is rejected with an error.
- Derived columns are computed OUTSIDE the write transaction (nested cursors
  deadlock SQLite under WAL).
- Enriched columns are prefixed with `_`: `_oda`, `_origin_zone`,
  `_destination_zone`, `_expected_tat_days`, `_actual_tat_days`,
  `_tat_variance_days`, `_sla_status`.

### The 41-column Delhivery export schema

These are the exact column names as they appear in the raw Delhivery `.xlsx` export,
stored snake_cased in the database. Know these — every pipeline function references them.

| # | Column name (raw) | DB column (snake_case) | Notes |
|---|---|---|---|
| 1 | LRN | lrn | Primary key. Unique shipment ID. |
| 2 | Order id | order_id | **Real company name** for aggregators (not `client` — see §4.8) |
| 3 | No of boxes | no_of_boxes | Integer |
| 4 | Client | client | Delhivery account name — constant per aggregator account, useless for grouping |
| 5 | Manifest Date | manifest_date | TAT clock start. Always ≤ Pickup Date. |
| 6 | Pickup Date | pickup_date | Physical pickup from origin |
| 7 | Expected Date | expected_date | Delhivery's own promise date |
| 8 | Invoice Number | invoice_number | Client invoice ref |
| 9 | Consignee name | consignee_name | Recipient name + phone |
| 10 | Origin City | origin_city | Almost always "Aurangabad" for this deployment |
| 11 | Destination City | destination_city | |
| 12 | Client Location/warehouse | client_location_warehouse | |
| 13 | Pick up Address | pick_up_address | Often null |
| 14 | Pin code | pin_code | Destination pincode → zone + ODA lookup |
| 15 | Dispatch Count | dispatch_count | Number of dispatch events |
| 16 | First dispatch date | first_dispatch_date | |
| 17 | Last dispatch date | last_dispatch_date | |
| 18 | Last Scan Location | last_scan_location | Hub/city name |
| 19 | Last Scan Date | last_scan_date | Used as timestamp tie-break in dedup |
| 20 | Current Status | current_status | Manifested / Dispatched / In Transit / Pending / Delivered / RTO |
| 21 | Status Type | status_type | Delivered / Undelivered / Returned |
| 22 | Remarks | remarks | Free-text status detail — dedup tie-break source |
| 23 | Promise Date | promise_date | Same as Expected Date in most rows |
| 24 | Delivered Date | delivered_date | TAT clock end. Null if not delivered. |
| 25 | Payment Type | payment_type | Pre-paid / COD |
| 26 | Master Waybill | master_waybill | Delhivery waybill number |
| 27 | Additional Remarks | additional_remarks | POD audit notes |
| 28 | Return Promise Date | return_promise_date | RTO rows only |
| 29 | Transaction Type | transaction_type | Usually null |
| 30 | Transaction Mode | transaction_mode | Usually null |
| 31 | First Pending Date | first_pending_date | |
| 32 | Package Amount | package_amount | Declared value |
| 33 | Weight | weight | kg |
| 34 | First attempt date | first_attempt_date | |
| 35 | Last Attempt date | last_attempt_date | |
| 36 | Attempt Count | attempt_count | Delivery attempts |
| 37 | First Return Date | first_return_date | |
| 38 | Invoice Zone | invoice_zone | Delhivery billing zone (B/D1/D2/E) |
| 39 | RVP/ Forward identifier | rvp_forward_identifier | "Forward Shipment" or "Return" |
| 40 | PUR ID | pur_id | Delhivery internal ID |
| 41 | State | state | Destination state |

**Derived columns** (computed at ingest, stored alongside source columns):

| Column | Computed from | Values |
|---|---|---|
| `_origin_zone` | origin_city → origin_lookup chain | West / South / North / East / NE / null |
| `_destination_zone` | pin_code → pincode master → state fallback | West / South / North / East / NE / null |
| `_oda` | pin_code → pincode_master_live | YES / NO / UNKNOWN |
| `_expected_tat_days` | matrix[origin][dest] + ODA adj | Integer days / null |
| `_actual_tat_days` | delivered_date − manifest_date (date only) | Integer days / null |
| `_tat_variance_days` | actual − expected | Signed integer / null |
| `_sla_status` | sign of variance | Early / On Time / Late / null |

### 5.2 Deduplication engine (`dedup.py`)

A Delhivery export can contain multiple snapshots of the same LRN (the shipment
at different lifecycle stages). Dedup picks ONE winner per LRN using a
**tie-break ladder**, evaluated in order:

```
1. Status rank      — lifecycle position wins:
                      Manifested(1) < Dispatched(2) < In Transit(3)
                      < Pending(4) < Delivered(5) = RTO(5)
2. Remarks rank     — regex keywords on the Remarks column break status ties
                      (e.g. "Out for Delivery" beats "Reached Hub")
3. Operational time — newest of: Last Scan Date > Delivered Date > Pickup Date
4. Batch order      — later upload batch wins as final tie-break
```

**Regression blocking:** a terminal status can never be downgraded. If the DB
has LRN 123 = Delivered and a new file contains LRN 123 = In Transit, the
incoming row is skipped (`skipped_regressions`). `pick_winner()` and
`merge_into_latest()` are pure functions — testable without a DB.

### 5.3 Architectural invariant — derived columns are STORED

`_expected_tat_days`, `_sla_status`, etc. are computed **once at ingest** and
stored in the row — never recomputed at read time. Consequence: editing the
matrix or pincode master affects **only future uploads**; historical shipments
keep the values they were classified with (hard constraint #6, audit trust).
The one deliberate exception: the first-ever pincode-master load triggers
`recompute_all_sla()` because rows ingested before the master existed have
NULL zone/ODA data that can now be resolved.

### 5.4 Origin lookup chain (`origin_lookup.py`)

1. `origin_recents` SQLite table (fast path, auto-populated)
2. `origin_city_master.csv` exact match (case-insensitive, 135 cities)
3. `origin_city_master.csv` fuzzy match (difflib, cutoff 0.80)
4. Unknown → returns `None`, flagged for warning

Successful lookups (steps 2–3) upsert into `origin_recents` for future speed.

### 5.5 Seeding (`seed.py`)

On first launch, `seed_all_if_empty()`:
- Seeds the 5×5 matrix from `matrix.csv` → `sla_matrix_live`
- Seeds the state→zone fallback map from `seed.py::STATE_ZONE` → `state_zone_fallback`
- Seeds 21,847 pincodes from `pincode_master.xlsx` → `pincode_master_live`
  (with ODA normalization) and triggers `recompute_all_sla()` if newly seeded
- No manual setup needed on a fresh machine.

---

## 6. The Database

**File:** `logisense.db` (SQLite, WAL mode, gitignored)

### Tables

| Table | Purpose |
|---|---|
| `shipments_latest` | One row per LRN — the deduplicated "current truth". All dashboards read this. |
| `shipments_raw` | Every uploaded row (pre-dedup) with `batch_id` + `uploaded_at`. Note: cleared on every upload along with `shipments_latest` (replace semantics, §4.6) — it archives the current upload session only, not all history. |
| `pincode_master_live` | 21,847 pincodes: pincode, city, state, zone, oda (YES/NO) |
| `sla_matrix_live` | The editable 5×5 TAT matrix |
| `state_zone_fallback` | State → zone map (seeded from `seed.py::STATE_ZONE`); used when a destination pincode isn't in the master |
| `origin_recents` | Origin city cache: city_name PK, state, zone, last_seen, seen_count |

### Key `shipments_latest` columns

Source columns (from Delhivery export, snake_cased): `lrn`, `order_id`, `no_of_boxes`,
`client`, `manifest_date`, `pickup_date`, `expected_date`, `invoice_number`,
`consignee_name`, `origin_city`, `destination_city`, `pin_code`, `current_status`,
`status_type`, `remarks`, `promise_date`, `delivered_date`, `payment_type`,
`master_waybill`, `weight`, `package_amount`, `state`, … (41 total)

Derived columns: `_oda`, `_origin_zone`, `_destination_zone`, `_expected_tat_days`,
`_actual_tat_days`, `_tat_variance_days`, `_sla_status`

### PRAGMAs & indexes (performance layer)

Applied in `backend/db_utils.py` on every connection:
```sql
PRAGMA journal_mode=WAL;       -- concurrent read/write
PRAGMA busy_timeout=5000;      -- wait instead of "database is locked"
PRAGMA cache_size=-64000;      -- 64MB page cache
PRAGMA temp_store=MEMORY;
PRAGMA mmap_size=268435456;    -- 256MB memory map
PRAGMA synchronous=NORMAL;     -- faster than FULL, still safe under WAL
```

Indexes created at startup (`backend/main.py`):
`idx_status`, `idx_order_id`, `idx_sla_status`, `idx_oda`, `idx_manifest_date`,
`idx_composite(current_status, order_id, _sla_status)`

---

## 7. Backend API (`backend/`)

Base URL (dev): `http://127.0.0.1:8000` — interactive docs at `/docs`

### Endpoint reference

| Method | Path | Returns |
|---|---|---|
| POST | `/api/upload` | Multipart xlsx upload → `{success, rows_inserted}`. Clears all data first, invalidates caches. |
| GET | `/api/landing/kpis` | 17 fields: total, delivered, in_transit, pending, rto, early, on_time, late, eot_count, eot_percent, oda_count, non_oda_count, date_min/max ("DD Mon YYYY", manifest-based), cod_count, late_count, rto_count. **Cached 5 min.** |
| GET | `/api/landing/donut` | `{labels, values, colors}` — Early/OnTime/Late/NotYetDelivered |
| GET | `/api/landing/trend` | Per-month: `{month, total_orders, early, on_time, late, eot_percent}` |
| GET | `/api/tat/orders` | Delivered orders with all `_` derived columns |
| GET | `/api/tat/summary` | total_delivered, early/on_time/late, eot%, oda_eot%, non_oda_eot%, avg TATs |
| GET | `/api/tat/oda-chart` | `{oda?: {...}, non_oda?: {...}}` — **empty group OMITTED** (phantom-bar fix) |
| GET | `/api/transit/orders` | Non-delivered orders + days_in_transit, days_remaining, risk_status. RTO = own bucket, sorted 3rd. |
| GET | `/api/transit/summary` | total_in_flight, at_risk, due_today, on_track, rto_count, pending_count |
| GET | `/api/aggregate/companies` | Per-company (by `order_id`): totals, statuses, eot_percent, avg TAT. Sorted by total desc. **Cached.** |
| GET | `/api/aggregate/monthly?company=X` | `[{month, early, on_time, late, not_delivered}]` for stacked chart |
| GET | `/api/aggregate-transit/companies` | Per-company in-flight counts, sorted at_risk desc |
| GET | `/api/aggregate-transit/company-detail?company=X` | `{company, risk_summary[4], days_overdue_breakdown, orders}` |
| GET | `/api/customize/orders` | Filtered rows. Params: company, status, sla_status, oda, date_from, date_to, zone (all optional AND filters, multi-value via comma, dates filter Manifest Date, zone = destination zone) |
| GET | `/api/export/{tat\|transit\|aggregate\|aggregate-transit\|customize}` | Streaming .xlsx (openpyxl), friendly headers via COLUMN_DISPLAY_NAMES |
| GET | `/api/edit/matrix` | `{zones[5], values[5][5]}` |
| GET | `/api/edit/pincodes?page&per_page&search` | Paginated pincode master |
| POST | `/api/assistant/chat` | `{message, history[]}` → `{reply, context_rows}` (Phase 3) |

### Caching layer (`db_utils.py`)

- In-memory dict cache, 5-minute TTL
- Cached keys: `landing_kpis`, `landing_trend`, `landing_donut`, `aggregate_companies`
- `cache_invalidate_all()` called after every successful upload

### Column display names (`schemas.py`)

```python
COLUMN_DISPLAY_NAMES = {
  "_oda": "ODA",
  "_expected_tat_days": "Expected TAT",
  "_actual_tat_days": "Actual TAT",
  "_tat_variance_days": "TAT Variance",
  "_sla_status": "Delivery Status",
  "_origin_zone": "Origin Zone",
  "_destination_zone": "Destination Zone",
}
```
Used by exports and the frontend column picker.

---

## 8. Frontend (`frontend/`)

### Routing (all lazy-loaded via React.lazy + Suspense)

| Route | Page | Nav label / sublabel |
|---|---|---|
| `/` | Landing | Landing · Overview |
| `/tat` | TAT | TAT Analysis · Delivered E+OT |
| `/transit` | Transit | Transit · In-flight |
| `/aggregate` | Aggregate | Aggregate · Company breakdown |
| `/aggregate-transit` | AggregateTransit | Aggregate Transit · Per-company in-flight |
| `/customize` | Customize | Customize · Ad-hoc query |
| `/assistant` | Assistant | AI Assistant · Ask anything |
| `/edit` | Edit | Edit · Reference data |

Sidebar active state: 3px yellow left border + `rgba(255,214,10,0.06)` background.

### Page anatomy (every page)

```
<PageHeader title subtitle />   ← includes "↑ Upload new file(s)" button
   ↓ 32px gap
[KPI/summary block]
   ↓ 32px gap
[charts block]
   ↓ 32px gap
[table block]
```
Consistent `flex flex-col gap-8` (32px) rhythm on every page container.
Padding: `32px 40px`, max-width 1600px centered.

### Data fetching pattern

```jsx
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ['landing-kpis'],
  queryFn: () => fetch('/api/landing/kpis').then(r => r.json()),
})
// isError   → error message + Retry button (never stuck skeletons)
// isLoading → <Skeleton /> shimmer
// success && total === 0 → <EmptyState /> (only on confirmed zero rows)
// success && total > 0   → render content
```
QueryClient defaults: `staleTime: 5min`, `gcTime: 10min`, `retry: 1`,
`refetchOnWindowFocus: false`. Upload success → `queryClient.invalidateQueries()`.

### Landing page KPI layout (12 cards, 4 rows)

```
Row 1 (3 cols): TOTAL ORDERS · DELIVERED(green+bar) · IN TRANSIT(blue+bar)
Row 2 (3 cols): PENDING(yellow+bar) · RTO(red+bar) · DATE RANGE(15px white, manifest-based)
Row 3 (4 cols): EARLY(green+bar) · ON TIME(blue+bar) · E+OT(yellow, hero) · LATE(red+bar)
Row 4 (2 cols): ODA · OUT OF DELIVERY AREA(yellow) · NON-ODA(white)
```
- IN TRANSIT = In Transit + Dispatched + Manifested combined
- Progress bar width = the percentage value; 4px height, colored to match value
- All cards: yellow border + glow + translateY(-2px) on **hover only**

### Key component contracts

**KPICard** — `label, value, valueColor, subtext, showBar, barPercent, isDateCard`

**DataTable** — `columns[{key,label,render?}], data, defaultSort, onExport,
sortKey/sortDir (controlled), renderExpanded`. Zebra `#0F0F11/#131316`, sticky
`#15151A` header, yellow ▲▼ sort indicator, numeric right-align + JetBrains Mono,
toolbar (search/download/expand icons).

**StatusPill** — value-driven color mapping (see §10 table). At Risk pills match
even with "(Xd overdue)" suffixes.

**ChartPair** — `topChart, dimension payloads {data, bars}` where each series
carries its own color. Chart type (Line/Bar/Pie) × Dimension dropdowns +
fullscreen expand modal (90vw × 80vh).

**UploadModal** — global singleton via `context/ui.jsx`. Drag-drop, file chips,
"Each upload replaces all existing data" warning, Process & Update → toast +
invalidate all queries.

**ColumnPicker** — yellow-tint pills (`rgba(255,214,10,0.12)` bg) with × to hide,
dropdown to re-add, Show all / Reset to defaults, plus Sort By + Asc/Desc controls.
Used on TAT, Transit, Customize.

---

## 9. The AI Assistant

**Route:** `/assistant` · **Endpoint:** `POST /api/assistant/chat`

### Architecture

```
User question
  → backend pulls fresh DB snapshot (3 queries):
      overall stats · top-20 company summary · top-50 at-risk orders
  → builds a system prompt embedding that data as text
  → POST https://api.groq.com/openai/v1/chat/completions
      model: llama-3.3-70b-versatile
      temperature: 0.3 · max_tokens: 512
      messages: [system, …last-10 history, user]
  → returns {reply, context_rows}
```

This is **context-stuffing**, not function-calling: every request embeds a fresh
data snapshot, so answers always reflect the current upload. The system prompt
instructs: use only provided numbers, never invent data, ≤150 words unless asked.

### Configuration

```
backend/.env            ← gitignored, NEVER commit
GROQ_API_KEY=gsk_xxxx   ← free key from console.groq.com
```
`main.py` calls `load_dotenv()` before app creation.
Missing key → graceful "not configured" reply (never a 500).
Groq errors → clean error message in the chat bubble.

### Frontend behavior

- Welcome card + 4 suggestion chips (2×2) when conversation is empty
- User bubbles right (yellow-tint), AI bubbles left (surface + "✦ LogiSense AI" label)
- Loading: three pulsing yellow dots
- History: last 10 message pairs sent with each request
- Enter sends · Shift+Enter newline · auto-scroll to bottom

---

## 10. Design System

### Colors (from `tokens.js`)

| Token | Hex | Usage |
|---|---|---|
| bg | `#0B0C0D` | Page background |
| surface | `#0F0F11` | Cards, panels |
| surface2 | `#15151A` | Table headers, dropdowns, AI bubbles |
| surface3 | `#1A1A1F` | Hover states |
| border | `#27272A` | All 1px borders |
| borderSoft | `#1F1F23` | Internal dividers, chart gridlines |
| text | `#F8F8F8` | Primary text |
| textDim | `#A1A1AA` | Secondary |
| muted | `#71717A` | Labels, captions, axes |
| primary | `#FFD60A` | Yellow — brand, values, active nav, E+OT |
| early | `#4ADE80` | Green |
| onTime | `#60A5FA` | Blue |
| late | `#F87171` | Red |
| rto | `#94A3B8` | Grey |
| pending | `#FBBF24` | Amber (distinct from brand yellow) |

Pill backgrounds = status color at 15% opacity.
**Status colors are semantic and identical across every chart, pill, and cell.**

### Typography

| Role | Spec |
|---|---|
| Page title | 26px / 700 / Inter |
| Card label | 11px / 600 / uppercase / +0.08em / muted |
| Card value | 32px / 700 / JetBrains Mono |
| Table header | 11px / 600 / uppercase / muted |
| Table cell | 13px / Inter (numbers → JetBrains Mono) |

### Chart theme (all Recharts)

Horizontal-only gridlines `#1F1F23` · axis text `#71717A` 12px · dark tooltip
(`#15151A` bg, `#27272A` border, radius 8) · 300ms mount animation ·
no toolbars/zoom · company labels truncate at 14 chars + "…", rotate -40°,
120px reserved height, full name in tooltip.

### E+OT % color coding (Aggregate table)

`>= 85%` green · `>= 70%` yellow · `< 70%` red

---

## 11. Performance Optimizations

| Optimization | Where | Effect |
|---|---|---|
| React Query staleTime 5min | `main.jsx` | No refetch on every navigation |
| refetchOnWindowFocus: false | `main.jsx` | No refetch on tab switch |
| Backend response cache (5min TTL) | `db_utils.py` | KPI/company queries served from memory |
| Cache invalidation on upload | upload router + UploadModal | Fresh data after upload |
| SQLite perf PRAGMAs | `db_utils.py` | 64MB cache, mmap, NORMAL sync |
| 7 indexes on hot columns | `main.py` startup | Fast GROUP BY / WHERE |
| Lazy-loaded routes | `App.jsx` | Smaller initial bundle |
| Parallel queries on Landing | `Landing.jsx` | KPI + donut + trend fetch simultaneously |

---

## 12. Running the Project

### Prerequisites
- Python 3.x with deps: `pip install -r requirements.txt`
  (PowerShell may need `python -m pip …`)
- Node.js: `cd frontend && npm install`
- Groq key in `backend/.env` (for AI assistant only)

### Development (two PowerShell windows)

```powershell
# Window 1 — backend  (PowerShell: run cd and the command SEPARATELY, no &&)
cd LogiSense/backend
python -m uvicorn main:app --reload --port 8000

# Window 2 — frontend
cd LogiSense/frontend
npm run dev
```
Open **http://localhost:5173**

### Production build
```powershell
cd frontend
npm run build        # → frontend/dist, served by FastAPI at :8000
```

### Useful commands
```powershell
# Kill a stale backend holding port 8000 (VERY common issue — see §14)
Get-Process -Name python | Stop-Process -Force

# Run tests
python -m pytest tests/ -q          # expect: 28 passed

# Check nothing sensitive is tracked
git ls-files | Select-String -Pattern "\.xlsx$|\.db$|\.env$"

# Inspect the DB quickly
python -c "import sqlite3; c=sqlite3.connect('logisense.db'); print(c.execute('SELECT current_status, COUNT(*) FROM shipments_latest GROUP BY current_status').fetchall())"

# Generate synthetic demo data (reads real ODA pincodes from logisense.db)
python tools/generate_sample_data.py
```

---

## 13. Testing

- **28 pytest tests** in `tests/`, covering the `app/` pipeline: TAT math, SLA
  classification, zone lookups, ODA normalization, dedup, ingest behavior.
- They do NOT cover the FastAPI routers or React frontend (manual/browser-verified).
- **Every change must end with `python -m pytest tests/ -q` → 28 passed.**
  If a backend change breaks a test, the backend change is wrong — `app/` is truth.

---

## 14. Known Quirks & Gotchas

1. **Stale uvicorn on port 8000** — the #1 recurring issue. If new endpoints 404
   or old data appears, an old python process owns :8000.
   Fix: `Get-Process -Name python | Stop-Process -Force`, restart uvicorn.

2. **PowerShell has no `&&`** — run `cd` and the command as separate lines.

3. **`uvicorn` not on PATH** — user-installed scripts aren't on PATH; always use
   `python -m uvicorn …`.

4. **Vite proxy targets `127.0.0.1`, not `localhost`** — Windows resolves
   localhost to IPv6 `::1` while uvicorn binds IPv4, causing ECONNREFUSED.
   Don't "simplify" this back to localhost.

5. **`client` column is useless for grouping** — real company names live in
   `order_id` (§4.8). Any new company feature must use `order_id`.

6. **ODA = 0 can be correct** — if the uploaded dataset only reaches Normal
   Service pincodes, zero ODA is the truth, not a bug. Verify with:
   `SELECT _oda, COUNT(*) FROM shipments_latest GROUP BY _oda`

7. **Sample data** — use the files in `tools/sample_data/` generated by
   `tools/generate_sample_data.py`. These use real ODA pincodes from the master,
   fixing the earlier bug where invented pincodes resolved to NO/UNKNOWN.

8. **The empty-ODA chart fix** — `/api/tat/oda-chart` omits a group with zero rows
   entirely, so the frontend never renders a phantom empty ODA slot.

9. **Every upload wipes previous data** — by design (§4.6). There is no merge mode.

10. **Two risk classifiers exist deliberately** — the shared `transit_risk.py`
    (RTO = own bucket) for Transit/exports, and the original 4-bucket date-based
    classification inside aggregate-transit's company-detail.

11. **`.env` must never be committed** — contains the Groq API key. Verify
    `.gitignore` covers `.env` before any push.

---

## 15. Pending / Future Work

| Item | Priority | Notes |
|---|---|---|
| Streaming AI responses | Nice-to-have | Token-by-token typing effect via SSE |
| Real server-side auth | Nice-to-have | The live demo uses a client-side gate (localStorage), not a security boundary — a production build would add real auth + API-level protection |

> Shipped since the original roadmap: AI Insights tab (Phase B), Vercel + Render
> deployment with a pre-built demo DB (Phase C), the Groq AI assistant, mobile-responsive
> layout, and editable reference data (matrix + pincode ODA, reset, custom upload).
> The Electron desktop `.exe` (Phase D) was dropped in favour of the hosted web demo.

---

## 16. Migration History

```
v1  Streamlit prototype — original internal build
v2  FastAPI + React migration
     Phase 1: scaffold + Landing (12 KPI cards)
     Phase 2: all sections + shared components + exports
     UI parity pass: charts, tables, filters, modals
     Perf pass: caching, indexes, lazy loading
     Phase 3: AI Assistant (Groq / Llama 3.3 70B)
v3  (CURRENT) AI Insights + deployment — shipped
     8 SQL detectors + a single Groq narration, cached per snapshot
     What-Changed digest + inline root-cause panels, mobile responsive
     Vercel (frontend) + Render (API) with a pre-built demo DB
     Per-session DB isolation, demo login gate, editable reference data
```

**Why the migration happened:** The prototype used a Python-only framework that
re-ran the entire script on every interaction — fragile UI, slow loads, session
state lost on reload, poor mobile support. FastAPI + React gives instant
navigation, persistent views, a real API layer for the AI assistant, and a
clean path to desktop packaging. All business logic survived the migration
untouched — the 28 tests that passed on day one still pass today.

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **LRN** | Unique shipment identifier in Delhivery's data. Primary key across the system. |
| **TAT** | Turn-Around Time in calendar days. |
| **Actual TAT** | `Delivered Date − Manifest Date` (date-only). |
| **Expected TAT** | `matrix[origin_zone][dest_zone] + (1 if ODA)`. |
| **TAT Variance** | `Actual − Expected` (signed days). Negative = early. |
| **Delivery Status** | Per-order Early / On Time / Late (internal: `_sla_status`). |
| **E+OT %** | `(Early + On Time) / Delivered × 100` — the headline metric. UI never says "SLA". |
| **ODA** | Out of Delivery Area — remote pincode flag; adds +1 day to Expected TAT. |
| **5×5 matrix** | Zone-to-zone expected-TAT table. Zones: West, South, North, East, NE. |
| **Dedup** | Per-LRN merge of multiple snapshots into one winner via the lifecycle-rank ladder. |
| **Regression block** | A terminal status (Delivered/RTO) can never be downgraded by a later upload. |
| **Risk Status** | Transit classification: At Risk / Due Today / On Track / Pending (+ RTO bucket). |
| **Manifest Date** | When Delhivery takes custody — the TAT clock start. |
| **RTO** | Return To Origin — a terminal outcome, excluded from in-flight counts. |
| **LogiSense AI** | The Groq-powered AI assistant with live DB context-stuffing. |

---

*This README is the single source of truth for the current architecture.*
