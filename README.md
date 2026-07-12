LogiSense — Logistics Intelligence Platform


A production FastAPI + React logistics analytics dashboard for parcel
distribution companies — built and deployed for a real logistics aggregator
(Delhivery + Blue Dart channel partner), with an integrated AI assistant
(Groq / Llama 3.3 70B).

This README is the single source of truth for the entire project: architecture,
business logic, data pipeline, API surface, frontend components, and operational
commands. Self-sufficient — an engineer reading this straight through has the
complete picture without needing any prior conversation.




Table of Contents


What This Project Does
Tech Stack
Project Structure
Core Business Logic (LOCKED)
The Data Pipeline (app/)
The Database
Backend API (backend/)
Frontend (frontend/)
The AI Assistant
Design System
Performance Optimizations
Running the Project
Testing
Known Quirks & Gotchas
Pending / Future Work
Migration History
Glossary



1. What This Project Does

A logistics company uploads its raw Delhivery export file (a 41-column .xlsx).
LogiSense then:


Ingests the file — parses, cleans, deduplicates shipment records
Enriches each shipment — resolves origin/destination zones, ODA status, expected TAT
Classifies delivery performance — Early / On Time / Late per order
Visualizes everything — KPI cards, charts, drill-down tables across 7 sections
Answers questions — an AI assistant queries live data in natural language


The platform is used to monitor SLA compliance, catch at-risk orders before breach,
and evaluate per-client performance.

Hard constraints (from the original design — still binding)

#ConstraintWhy1No cloud dependency — nothing on AWS/GCP/AzureData is operational + commercially sensitive2No internet needed during operation (AI assistant is the sole optional exception)Must work with unreliable connectivity3Files uploaded manually through the UI — no email fetch, no scheduled syncSimpler ops; founders export weekly4Minimal install friction — target: double-click to run (drives Phase 4 Electron .exe)Founders are non-technical5Runs comfortably on 8 GB RAM Windows laptopsFounder hardware varies6Reference-data edits must NOT rewrite history — matrix/ODA edits affect only future uploads; past shipments keep their stored SLA valuesAudit trust


2. Tech Stack

LayerTechnologyNotesData pipelinePython 3.x (pandas, openpyxl)Core pipeline — battle-tested, 28 unit testsDatabaseSQLite (WAL mode)Single file logisense.db, gitignoredBackend APIFastAPI + uvicornAsync, auto-docs at /docsFrontendReact 18 + ViteSPA, lazy-loaded routesStylingTailwind CSS + custom tokensNo component librariesChartsRechartsDonut, composed line, grouped/stacked barsData fetchingTanStack React Query5-min stale time, cache invalidation on uploadAIGroq API (Llama 3.3 70B)Free tier, ~sub-second responsesTestspytest (28 tests)Cover the app/ pipeline only


3. Project Structure

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

Golden rule: everything in app/pipeline/ and app/store/ is LOCKED.
The FastAPI backend imports from it; it never modifies it. All 28 tests target this layer.


4. Core Business Logic (LOCKED)

These rules are the heart of the product. They were refined against real production
data and must never change without sign-off.

4.1 TAT (Turn-Around Time)

actual_tat = (Delivered Date − Manifest Date) in calendar days


Start = Manifest Date (NOT Pickup Date). Delhivery takes custody at manifest.
Manifest is always ≤ Pickup; ~49% of orders manifest 1 day before pickup.
Date-only subtraction — time components stripped to avoid fractional days.
Calendar days, not business days.
The DB column is still named pickup_date for the pickup value; only the display
label changed to "Manifest Date" in tables where manifest drives the calculation.


4.2 Zone Matrix (5×5, days)

WestSouthNorthEastNEWest466710South646710North66478East77746NE1010864


Row = origin zone, column = destination zone, value = expected TAT days.
Stored in sla_matrix_live table; seeded from app/reference/matrix.csv.
Editable via the Edit section (edits affect FUTURE uploads only — past shipments
keep their stored _expected_tat_days).


4.3 ODA (Out of Delivery Area)


If destination pincode is ODA: expected_tat += 1
Source values normalized at pincode import: "ODA" → YES, "Normal Service" → NO
(plus tolerant aliases: yes/y/1 → YES, no/n/0 → NO)
lookup_oda() returns YES / NO / UNKNOWN — UNKNOWN when pincode not in master
UNKNOWN is treated as NO for Expected TAT — no +1 penalty is applied when
the pincode can't be found in the master
ODA is data-dependent: if a dataset's destinations are all metro pincodes,
ODA counts are legitimately 0. This is correct behavior, not a bug.


4.4 SLA Classification (displayed as "E+OT" in UI)

actual_tat <  expected_tat  → Early
actual_tat == expected_tat  → On Time
actual_tat >  expected_tat  → Late

E+OT % = (Early + On Time) / (Early + On Time + Late) × 100


"SLA" is renamed to E+OT in ALL UI labels (founders found "SLA" confusing).
Internal names (_sla_status, function names, DB columns) are unchanged.
The per-order column "SLA Status" displays as "Delivery Status".


4.5 State → Zone Mapping (critical corrections)

StateZoneWhy this mattersChhattisgarhEast (NOT West)Routes via Kolkata/Raipur East hubSikkimEast (NOT NE)Serviced via Siliguri corridorOdisha/OrissaEastBoth spellings handledDaman & Diu / Daman and DiuWestAlias handlingPondicherry / PuducherrySouthAlias handlingJammu & Kashmir / Jammu and KashmirNorthAlias handling

4.6 Upload Behavior — ALWAYS REPLACE


Every upload deletes all existing data before inserting
(DELETE FROM shipments_latest + shipments_raw).
DELETE runs once per upload session (before the file loop), so multi-file
batches merge together, then jointly replace old data.
Rationale: founders upload complete Delhivery exports; accumulating periods
would produce misleading mixed charts.
After upload: recompute_all_sla() runs; frontend invalidates ALL React Query
caches; backend in-memory cache is cleared.


4.7 Transit Risk Classification

days_in_transit = (today − manifest_date).days     [fallback: pickup_date]
days_remaining  = expected_tat_days − days_in_transit

days_remaining < 0            → "At Risk (Xd overdue)"
days_remaining == 0           → "Due Today"
days_remaining > 0            → "" (on track, blank)
expected_tat_days IS NULL     → "Pending"
current_status = 'RTO'        → "RTO" (own bucket in /transit endpoints)


Shared classifier lives in backend/transit_risk.py — single source of truth
used by Transit, Aggregate Transit, and exports.
Exception: /api/aggregate-transit/company-detail uses the original 4-bucket
date-based classification (At Risk/Due Today/On Track/Pending) where RTO orders
are bucketed by date.


4.8 The client vs order_id Quirk (IMPORTANT)

In real Delhivery exports for aggregators:


client column = the Delhivery account name (constant per aggregator account) — useless for grouping
order_id column = the actual end-client company name (STELLARTECH SYSTEMS, MERIDIAN ELECTRICALS, …)


Every backend company filter/grouping uses order_id, aliased as company in
responses. client appears only as a display column.


5. The Data Pipeline (app/)

5.1 Ingest flow (ingest.py)

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


A file missing any REQUIRED_COLUMN is rejected with an error.
Derived columns are computed OUTSIDE the write transaction (nested cursors
deadlock SQLite under WAL).
Enriched columns are prefixed with _: _oda, _origin_zone,
_destination_zone, _expected_tat_days, _actual_tat_days,
_tat_variance_days, _sla_status.


The 41-column Delhivery export schema

These are the exact column names as they appear in the raw Delhivery .xlsx export,
stored snake_cased in the database. Know these — every pipeline function references them.

#Column name (raw)DB column (snake_case)Notes1LRNlrnPrimary key. Unique shipment ID.2Order idorder_idReal company name for aggregators (not client — see §4.8)3No of boxesno_of_boxesInteger4ClientclientDelhivery account name — constant per aggregator account, useless for grouping5Manifest Datemanifest_dateTAT clock start. Always ≤ Pickup Date.6Pickup Datepickup_datePhysical pickup from origin7Expected Dateexpected_dateDelhivery's own promise date8Invoice Numberinvoice_numberClient invoice ref9Consignee nameconsignee_nameRecipient name + phone10Origin Cityorigin_cityAlmost always "Aurangabad" for this deployment11Destination Citydestination_city12Client Location/warehouseclient_location_warehouse13Pick up Addresspick_up_addressOften null14Pin codepin_codeDestination pincode → zone + ODA lookup15Dispatch Countdispatch_countNumber of dispatch events16First dispatch datefirst_dispatch_date17Last dispatch datelast_dispatch_date18Last Scan Locationlast_scan_locationHub/city name19Last Scan Datelast_scan_dateUsed as timestamp tie-break in dedup20Current Statuscurrent_statusManifested / Dispatched / In Transit / Pending / Delivered / RTO21Status Typestatus_typeDelivered / Undelivered / Returned22RemarksremarksFree-text status detail — dedup tie-break source23Promise Datepromise_dateSame as Expected Date in most rows24Delivered Datedelivered_dateTAT clock end. Null if not delivered.25Payment Typepayment_typePre-paid / COD26Master Waybillmaster_waybillDelhivery waybill number27Additional Remarksadditional_remarksPOD audit notes28Return Promise Datereturn_promise_dateRTO rows only29Transaction Typetransaction_typeUsually null30Transaction Modetransaction_modeUsually null31First Pending Datefirst_pending_date32Package Amountpackage_amountDeclared value33Weightweightkg34First attempt datefirst_attempt_date35Last Attempt datelast_attempt_date36Attempt Countattempt_countDelivery attempts37First Return Datefirst_return_date38Invoice Zoneinvoice_zoneDelhivery billing zone (B/D1/D2/E)39RVP/ Forward identifierrvp_forward_identifier"Forward Shipment" or "Return"40PUR IDpur_idDelhivery internal ID41StatestateDestination state

Derived columns (computed at ingest, stored alongside source columns):

ColumnComputed fromValues_origin_zoneorigin_city → origin_lookup chainWest / South / North / East / NE / null_destination_zonepin_code → pincode master → state fallbackWest / South / North / East / NE / null_odapin_code → pincode_master_liveYES / NO / UNKNOWN_expected_tat_daysmatrix[origin][dest] + ODA adjInteger days / null_actual_tat_daysdelivered_date − manifest_date (date only)Integer days / null_tat_variance_daysactual − expectedSigned integer / null_sla_statussign of varianceEarly / On Time / Late / null

5.2 Deduplication engine (dedup.py)

A Delhivery export can contain multiple snapshots of the same LRN (the shipment
at different lifecycle stages). Dedup picks ONE winner per LRN using a
tie-break ladder, evaluated in order:

1. Status rank      — lifecycle position wins:
                      Manifested(1) < Dispatched(2) < In Transit(3)
                      < Pending(4) < Delivered(5) = RTO(5)
2. Remarks rank     — regex keywords on the Remarks column break status ties
                      (e.g. "Out for Delivery" beats "Reached Hub")
3. Operational time — newest of: Last Scan Date > Delivered Date > Pickup Date
4. Batch order      — later upload batch wins as final tie-break

Regression blocking: a terminal status can never be downgraded. If the DB
has LRN 123 = Delivered and a new file contains LRN 123 = In Transit, the
incoming row is skipped (skipped_regressions). pick_winner() and
merge_into_latest() are pure functions — testable without a DB.

5.3 Architectural invariant — derived columns are STORED

_expected_tat_days, _sla_status, etc. are computed once at ingest and
stored in the row — never recomputed at read time. Consequence: editing the
matrix or pincode master affects only future uploads; historical shipments
keep the values they were classified with (hard constraint #6, audit trust).
The one deliberate exception: the first-ever pincode-master load triggers
recompute_all_sla() because rows ingested before the master existed have
NULL zone/ODA data that can now be resolved.

5.4 Origin lookup chain (origin_lookup.py)


origin_recents SQLite table (fast path, auto-populated)
origin_city_master.csv exact match (case-insensitive, 135 cities)
origin_city_master.csv fuzzy match (difflib, cutoff 0.80)
Unknown → returns None, flagged for warning


Successful lookups (steps 2–3) upsert into origin_recents for future speed.

5.5 Seeding (seed.py)

On first launch, seed_all_if_empty():


Seeds the 5×5 matrix from matrix.csv → sla_matrix_live
Seeds the state→zone fallback map from seed.py::STATE_ZONE → state_zone_fallback
Seeds 21,847 pincodes from pincode_master.xlsx → pincode_master_live
(with ODA normalization) and triggers recompute_all_sla() if newly seeded
No manual setup needed on a fresh machine.



6. The Database

File: logisense.db (SQLite, WAL mode, gitignored)

Tables

TablePurposeshipments_latestOne row per LRN — the deduplicated "current truth". All dashboards read this.shipments_rawEvery uploaded row (pre-dedup) with batch_id + uploaded_at. Note: cleared on every upload along with shipments_latest (replace semantics, §4.6) — it archives the current upload session only, not all history.pincode_master_live21,847 pincodes: pincode, city, state, zone, oda (YES/NO)sla_matrix_liveThe editable 5×5 TAT matrixstate_zone_fallbackState → zone map (seeded from seed.py::STATE_ZONE); used when a destination pincode isn't in the masterorigin_recentsOrigin city cache: city_name PK, state, zone, last_seen, seen_count

Key shipments_latest columns

Source columns (from Delhivery export, snake_cased): lrn, order_id, no_of_boxes,
client, manifest_date, pickup_date, expected_date, invoice_number,
consignee_name, origin_city, destination_city, pin_code, current_status,
status_type, remarks, promise_date, delivered_date, payment_type,
master_waybill, weight, package_amount, state, … (41 total)

Derived columns: _oda, _origin_zone, _destination_zone, _expected_tat_days,
_actual_tat_days, _tat_variance_days, _sla_status

PRAGMAs & indexes (performance layer)

Applied in backend/db_utils.py on every connection:

sqlPRAGMA journal_mode=WAL;       -- concurrent read/write
PRAGMA busy_timeout=5000;      -- wait instead of "database is locked"
PRAGMA cache_size=-64000;      -- 64MB page cache
PRAGMA temp_store=MEMORY;
PRAGMA mmap_size=268435456;    -- 256MB memory map
PRAGMA synchronous=NORMAL;     -- faster than FULL, still safe under WAL

Indexes created at startup (backend/main.py):
idx_status, idx_order_id, idx_sla_status, idx_oda, idx_manifest_date,
idx_composite(current_status, order_id, _sla_status)


7. Backend API (backend/)

Base URL (dev): http://127.0.0.1:8000 — interactive docs at /docs

Endpoint reference

MethodPathReturnsPOST/api/uploadMultipart xlsx upload → {success, rows_inserted}. Clears all data first, invalidates caches.GET/api/landing/kpis17 fields: total, delivered, in_transit, pending, rto, early, on_time, late, eot_count, eot_percent, oda_count, non_oda_count, date_min/max ("DD Mon YYYY", manifest-based), cod_count, late_count, rto_count. Cached 5 min.GET/api/landing/donut{labels, values, colors} — Early/OnTime/Late/NotYetDeliveredGET/api/landing/trendPer-month: {month, total_orders, early, on_time, late, eot_percent}GET/api/tat/ordersDelivered orders with all _ derived columnsGET/api/tat/summarytotal_delivered, early/on_time/late, eot%, oda_eot%, non_oda_eot%, avg TATsGET/api/tat/oda-chart{oda?: {...}, non_oda?: {...}} — empty group OMITTED (phantom-bar fix)GET/api/transit/ordersNon-delivered orders + days_in_transit, days_remaining, risk_status. RTO = own bucket, sorted 3rd.GET/api/transit/summarytotal_in_flight, at_risk, due_today, on_track, rto_count, pending_countGET/api/aggregate/companiesPer-company (by order_id): totals, statuses, eot_percent, avg TAT. Sorted by total desc. Cached.GET/api/aggregate/monthly?company=X[{month, early, on_time, late, not_delivered}] for stacked chartGET/api/aggregate-transit/companiesPer-company in-flight counts, sorted at_risk descGET/api/aggregate-transit/company-detail?company=X{company, risk_summary[4], days_overdue_breakdown, orders}GET/api/customize/ordersFiltered rows. Params: company, status, sla_status, oda, date_from, date_to, zone (all optional AND filters, multi-value via comma, dates filter Manifest Date, zone = destination zone)GET/api/export/{tat|transit|aggregate|aggregate-transit|customize}Streaming .xlsx (openpyxl), friendly headers via COLUMN_DISPLAY_NAMESGET/api/edit/matrix{zones[5], values[5][5]}GET/api/edit/pincodes?page&per_page&searchPaginated pincode masterPOST/api/assistant/chat{message, history[]} → {reply, context_rows} (Phase 3)

Caching layer (db_utils.py)


In-memory dict cache, 5-minute TTL
Cached keys: landing_kpis, landing_trend, landing_donut, aggregate_companies
cache_invalidate_all() called after every successful upload


Column display names (schemas.py)

pythonCOLUMN_DISPLAY_NAMES = {
  "_oda": "ODA",
  "_expected_tat_days": "Expected TAT",
  "_actual_tat_days": "Actual TAT",
  "_tat_variance_days": "TAT Variance",
  "_sla_status": "Delivery Status",
  "_origin_zone": "Origin Zone",
  "_destination_zone": "Destination Zone",
}

Used by exports and the frontend column picker.


8. Frontend (frontend/)

Routing (all lazy-loaded via React.lazy + Suspense)

RoutePageNav label / sublabel/LandingLanding · Overview/tatTATTAT Analysis · Delivered E+OT/transitTransitTransit · In-flight/aggregateAggregateAggregate · Company breakdown/aggregate-transitAggregateTransitAggregate Transit · Per-company in-flight/customizeCustomizeCustomize · Ad-hoc query/assistantAssistantAI Assistant · Ask anything/editEditEdit · Reference data

Sidebar active state: 3px yellow left border + rgba(255,214,10,0.06) background.

Page anatomy (every page)

<PageHeader title subtitle />   ← includes "↑ Upload new file(s)" button
   ↓ 32px gap
[KPI/summary block]
   ↓ 32px gap
[charts block]
   ↓ 32px gap
[table block]

Consistent flex flex-col gap-8 (32px) rhythm on every page container.
Padding: 32px 40px, max-width 1600px centered.

Data fetching pattern

jsxconst { data, isLoading, isError, refetch } = useQuery({
  queryKey: ['landing-kpis'],
  queryFn: () => fetch('/api/landing/kpis').then(r => r.json()),
})
// isError   → error message + Retry button (never stuck skeletons)
// isLoading → <Skeleton /> shimmer
// success && total === 0 → <EmptyState /> (only on confirmed zero rows)
// success && total > 0   → render content

QueryClient defaults: staleTime: 5min, gcTime: 10min, retry: 1,
refetchOnWindowFocus: false. Upload success → queryClient.invalidateQueries().

Landing page KPI layout (12 cards, 4 rows)

Row 1 (3 cols): TOTAL ORDERS · DELIVERED(green+bar) · IN TRANSIT(blue+bar)
Row 2 (3 cols): PENDING(yellow+bar) · RTO(red+bar) · DATE RANGE(15px white, manifest-based)
Row 3 (4 cols): EARLY(green+bar) · ON TIME(blue+bar) · E+OT(yellow, hero) · LATE(red+bar)
Row 4 (2 cols): ODA · OUT OF DELIVERY AREA(yellow) · NON-ODA(white)


IN TRANSIT = In Transit + Dispatched + Manifested combined
Progress bar width = the percentage value; 4px height, colored to match value
All cards: yellow border + glow + translateY(-2px) on hover only


Key component contracts

KPICard — label, value, valueColor, subtext, showBar, barPercent, isDateCard

DataTable — columns[{key,label,render?}], data, defaultSort, onExport, sortKey/sortDir (controlled), renderExpanded. Zebra #0F0F11/#131316, sticky
#15151A header, yellow ▲▼ sort indicator, numeric right-align + JetBrains Mono,
toolbar (search/download/expand icons).

StatusPill — value-driven color mapping (see §10 table). At Risk pills match
even with "(Xd overdue)" suffixes.

ChartPair — topChart, dimension payloads {data, bars} where each series
carries its own color. Chart type (Line/Bar/Pie) × Dimension dropdowns +
fullscreen expand modal (90vw × 80vh).

UploadModal — global singleton via context/ui.jsx. Drag-drop, file chips,
"Each upload replaces all existing data" warning, Process & Update → toast +
invalidate all queries.

ColumnPicker — yellow-tint pills (rgba(255,214,10,0.12) bg) with × to hide,
dropdown to re-add, Show all / Reset to defaults, plus Sort By + Asc/Desc controls.
Used on TAT, Transit, Customize.


9. The AI Assistant

Route: /assistant · Endpoint: POST /api/assistant/chat

Architecture

User question
  → backend pulls fresh DB snapshot (3 queries):
      overall stats · top-20 company summary · top-50 at-risk orders
  → builds a system prompt embedding that data as text
  → POST https://api.groq.com/openai/v1/chat/completions
      model: llama-3.3-70b-versatile
      temperature: 0.3 · max_tokens: 512
      messages: [system, …last-10 history, user]
  → returns {reply, context_rows}

This is context-stuffing, not function-calling: every request embeds a fresh
data snapshot, so answers always reflect the current upload. The system prompt
instructs: use only provided numbers, never invent data, ≤150 words unless asked.

Configuration

backend/.env            ← gitignored, NEVER commit
GROQ_API_KEY=gsk_xxxx   ← free key from console.groq.com

main.py calls load_dotenv() before app creation.
Missing key → graceful "not configured" reply (never a 500).
Groq errors → clean error message in the chat bubble.

Frontend behavior


Welcome card + 4 suggestion chips (2×2) when conversation is empty
User bubbles right (yellow-tint), AI bubbles left (surface + "✦ LogiSense AI" label)
Loading: three pulsing yellow dots
History: last 10 message pairs sent with each request
Enter sends · Shift+Enter newline · auto-scroll to bottom



10. Design System

Colors (from tokens.js)

TokenHexUsagebg#0B0C0DPage backgroundsurface#0F0F11Cards, panelssurface2#15151ATable headers, dropdowns, AI bubblessurface3#1A1A1FHover statesborder#27272AAll 1px bordersborderSoft#1F1F23Internal dividers, chart gridlinestext#F8F8F8Primary texttextDim#A1A1AASecondarymuted#71717ALabels, captions, axesprimary#FFD60AYellow — brand, values, active nav, E+OTearly#4ADE80GreenonTime#60A5FABluelate#F87171Redrto#94A3B8Greypending#FBBF24Amber (distinct from brand yellow)

Pill backgrounds = status color at 15% opacity.
Status colors are semantic and identical across every chart, pill, and cell.

Typography

RoleSpecPage title26px / 700 / InterCard label11px / 600 / uppercase / +0.08em / mutedCard value32px / 700 / JetBrains MonoTable header11px / 600 / uppercase / mutedTable cell13px / Inter (numbers → JetBrains Mono)

Chart theme (all Recharts)

Horizontal-only gridlines #1F1F23 · axis text #71717A 12px · dark tooltip
(#15151A bg, #27272A border, radius 8) · 300ms mount animation ·
no toolbars/zoom · company labels truncate at 14 chars + "…", rotate -40°,
120px reserved height, full name in tooltip.

E+OT % color coding (Aggregate table)

>= 85% green · >= 70% yellow · < 70% red


11. Performance Optimizations

OptimizationWhereEffectReact Query staleTime 5minmain.jsxNo refetch on every navigationrefetchOnWindowFocus: falsemain.jsxNo refetch on tab switchBackend response cache (5min TTL)db_utils.pyKPI/company queries served from memoryCache invalidation on uploadupload router + UploadModalFresh data after uploadSQLite perf PRAGMAsdb_utils.py64MB cache, mmap, NORMAL sync7 indexes on hot columnsmain.py startupFast GROUP BY / WHERELazy-loaded routesApp.jsxSmaller initial bundleParallel queries on LandingLanding.jsxKPI + donut + trend fetch simultaneously


12. Running the Project

Prerequisites


Python 3.x with deps: pip install -r requirements.txt
(PowerShell may need python -m pip …)
Node.js: cd frontend && npm install
Groq key in backend/.env (for AI assistant only)


Development (two PowerShell windows)

powershell# Window 1 — backend  (PowerShell: run cd and the command SEPARATELY, no &&)
cd LogiSense/backend
python -m uvicorn main:app --reload --port 8000

# Window 2 — frontend
cd LogiSense/frontend
npm run dev

Open http://localhost:5173

Production build

powershellcd frontend
npm run build        # → frontend/dist, served by FastAPI at :8000

Useful commands

powershell# Kill a stale backend holding port 8000 (VERY common issue — see §14)
Get-Process -Name python | Stop-Process -Force

# Run tests
python -m pytest tests/ -q          # expect: 28 passed

# Check nothing sensitive is tracked
git ls-files | Select-String -Pattern "\.xlsx$|\.db$|\.env$"

# Inspect the DB quickly
python -c "import sqlite3; c=sqlite3.connect('logisense.db'); print(c.execute('SELECT current_status, COUNT(*) FROM shipments_latest GROUP BY current_status').fetchall())"

# Generate synthetic demo data (reads real ODA pincodes from logisense.db)
python tools/generate_sample_data.py


13. Testing


28 pytest tests in tests/, covering the app/ pipeline: TAT math, SLA
classification, zone lookups, ODA normalization, dedup, ingest behavior.
They do NOT cover the FastAPI routers or React frontend (manual/browser-verified).
Every change must end with python -m pytest tests/ -q → 28 passed.
If a backend change breaks a test, the backend change is wrong — app/ is truth.



14. Known Quirks & Gotchas


Stale uvicorn on port 8000 — the #1 recurring issue. If new endpoints 404
or old data appears, an old python process owns :8000.
Fix: Get-Process -Name python | Stop-Process -Force, restart uvicorn.
PowerShell has no && — run cd and the command as separate lines.
uvicorn not on PATH — user-installed scripts aren't on PATH; always use
python -m uvicorn ….
Vite proxy targets 127.0.0.1, not localhost — Windows resolves
localhost to IPv6 ::1 while uvicorn binds IPv4, causing ECONNREFUSED.
Don't "simplify" this back to localhost.
client column is useless for grouping — real company names live in
order_id (§4.8). Any new company feature must use order_id.
ODA = 0 can be correct — if the uploaded dataset only reaches Normal
Service pincodes, zero ODA is the truth, not a bug. Verify with:
SELECT _oda, COUNT(*) FROM shipments_latest GROUP BY _oda
Sample data — use the files in tools/sample_data/ generated by
tools/generate_sample_data.py. These use real ODA pincodes from the master,
fixing the earlier bug where invented pincodes resolved to NO/UNKNOWN.
The empty-ODA chart fix — /api/tat/oda-chart omits a group with zero rows
entirely, so the frontend never renders a phantom empty ODA slot.
Every upload wipes previous data — by design (§4.6). There is no merge mode.
Two risk classifiers exist deliberately — the shared transit_risk.py
(RTO = own bucket) for Transit/exports, and the original 4-bucket date-based
classification inside aggregate-transit's company-detail.
.env must never be committed — contains the Groq API key. Verify
.gitignore covers .env before any push.



15. Pending / Future Work

ItemPriorityNotesAI Insights tabHighClient classification, problem lanes, root-cause decomposition, What-Changed digest, AI-narrated summaries — Phase BVercel + Render deploymentHighFrontend on Vercel, FastAPI on Render, seeded demo DB — Phase CElectron desktop .exeMediumWrap FastAPI + React build into a native Windows app — Phase DGroq AI assistant (Phase 3)MediumComplete the assistant.py router and wire it to the frontendMobile responsive Insights tabMediumInsights tab designed mobile-first from day oneMatrix editing (write endpoint)LowEdit section is read-only; "Edit matrix" shows a coming-soon toastStreaming AI responsesNice-to-haveToken-by-token typing effect via SSE


16. Migration History

v1  Streamlit prototype — original internal build
v2  FastAPI + React migration — current architecture
     Phase 1: scaffold + Landing (12 KPI cards)
     Phase 2: all sections + shared components + exports
     UI parity pass: charts, tables, filters, modals
     Perf pass: caching, indexes, lazy loading
     Phase 3: AI Assistant (Groq / Llama 3.3 70B) — in progress
v3  (next) AI Insights tab + Vercel/Render deployment
v4  (next) Electron .exe

Why the migration happened: The prototype used a Python-only framework that
re-ran the entire script on every interaction — fragile UI, slow loads, session
state lost on reload, poor mobile support. FastAPI + React gives instant
navigation, persistent views, a real API layer for the AI assistant, and a
clean path to desktop packaging. All business logic survived the migration
untouched — the 28 tests that passed on day one still pass today.


17. Glossary

TermMeaningLRNUnique shipment identifier in Delhivery's data. Primary key across the system.TATTurn-Around Time in calendar days.Actual TATDelivered Date − Manifest Date (date-only).Expected TATmatrix[origin_zone][dest_zone] + (1 if ODA).TAT VarianceActual − Expected (signed days). Negative = early.Delivery StatusPer-order Early / On Time / Late (internal: _sla_status).E+OT %(Early + On Time) / Delivered × 100 — the headline metric. UI never says "SLA".ODAOut of Delivery Area — remote pincode flag; adds +1 day to Expected TAT.5×5 matrixZone-to-zone expected-TAT table. Zones: West, South, North, East, NE.DedupPer-LRN merge of multiple snapshots into one winner via the lifecycle-rank ladder.Regression blockA terminal status (Delivered/RTO) can never be downgraded by a later upload.Risk StatusTransit classification: At Risk / Due Today / On Track / Pending (+ RTO bucket).Manifest DateWhen Delhivery takes custody — the TAT clock start.RTOReturn To Origin — a terminal outcome, excluded from in-flight counts.LogiSense AIThe Groq-powered AI assistant with live DB context-stuffing.


This README is the single source of truth for the current architecture.