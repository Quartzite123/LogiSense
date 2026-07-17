# LogiSense — AI Insights Tab Specification

> This document is the single source of truth for building the AI Insights tab.
> It is the result of a design conversation and covers every decision made,
> every feature included, every feature deliberately excluded, and the exact
> implementation contract for Claude Code.

---

## 1. What This Tab Is

A single page that **tells the story of the data in plain English** — with charts
and bullets as supporting evidence. It is not another dashboard with more tables.
It answers the question a founder actually asks when they open the app:
**"What do I need to know right now, and what should I do about it?"**

It replaces the standalone AI Assistant nav tab entirely. One AI home.

---

## 2. What Is In (and What Is Out)

### IN

| Feature | What it does |
|---|---|
| **What-Changed Digest** | After each upload, compares current metrics to the previous snapshot — 5 plain-English bullets telling the founder what is different |
| **Pattern Detection cards** | Fixed detector library (SQL-driven) finds real patterns; one Groq call narrates all of them; displayed as severity-coded cards |
| **Root-cause panel** | Click any flagged company in a pattern card → inline expansion showing WHY (ODA share, zone mix, specific bad pincodes) — precomputed in the same Groq call, zero extra API cost |
| **AI Chat** | The existing assistant chat, moved to the bottom of this page — sticky input, full conversation history, same Groq backend |

### OUT (deliberately excluded)

| Feature | Why excluded | Where it belongs instead |
|---|---|---|
| Problem Lanes sortable table | Descriptive BI, not insight — it's a TAT Analysis feature | TAT Analysis page (future) |
| Per-page client health scorecard | Already covered by color-coded Aggregate table | Aggregate tab (color regression fix) |
| Open-ended AI mining | Flaky, hallucinates, unreliable — deterministic detectors are better | Never |
| Volume/revenue charts | Dropped earlier — Package Amount ≠ revenue | Nowhere |
| Weather integration | No weather data, offline constraint, circular with synthetic data | Never |

---

## 3. The Four Features In Detail

### 3.1 What-Changed Digest

**Position:** Top of page. First thing seen on every visit.

**Mechanics:**
- A new DB table `upload_snapshots` stores a lightweight metrics snapshot after every upload:
  - Overall: total, delivered, eot_percent, late_count, rto_count, oda_count, date_min, date_max
  - Per company: company, total, delivered, eot_percent, late_count (one row per company per snapshot)
  - Snapshot metadata: snapshot_id (autoincrement), uploaded_at, file_count
- On every upload, after ingest completes, a new snapshot row is written
- **Snapshot 0 (seeded automatically):** When the demo data auto-seeds on first launch, a synthetic "previous state" snapshot is also seeded — E+OT 2.5 points lower, volume 8% lower, PRISM slightly healthier, NEXUS still active — so the very first digest has something meaningful to say
- Digest = compare snapshot N (current) vs snapshot N−1 (previous)
- If only one snapshot exists (first upload ever): show "First upload — establishing baseline" message, no comparison

**Groq call:** One call. System prompt includes snapshot N and N−1 aggregates. Returns exactly 5 bullets, ordered by importance. Cached per snapshot pair.

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│  📊 What Changed — Upload #2 vs Upload #1               │
│  Comparing Jan 2026 data vs Dec 2025 data               │
├─────────────────────────────────────────────────────────┤
│  ▲ E+OT improved 3.1 points (72.4% → 75.5%)            │
│  ▼ PRISM INDUSTRIES late% rose from 35% to 52%         │
│  ● NEXUS FABRICATION shipped 0 orders this period       │
│  ▲ Total volume up 12% (481 → 540 orders)               │
│  ● 3 new clients appeared: APEX, SUMMIT, LYNX           │
└─────────────────────────────────────────────────────────┘
```
- Card: surface `#0F0F11`, border `#27272A`, radius 12px
- Each bullet prefixed with colored indicator: ▲ green (improvement), ▼ red (worsening), ● grey (neutral/notable)
- Timestamp: "Compared to upload from [date]" in muted text
- Collapsed by default on mobile (tap to expand), always visible on desktop

---

### 3.2 Pattern Detection Cards

**Position:** Below digest. The main content of the page.

**How it works:**
- 8 fixed SQL detectors run against `shipments_latest` after every upload
- Each detector returns structured data (numbers, company names, dates)
- One single Groq call receives ALL detector outputs and returns narration for each
- Results cached in a new DB table `insight_cache` keyed by snapshot_id
- Page load = read from cache, zero API calls

**The 8 detectors:**

| # | Detector name | SQL logic | Fires when |
|---|---|---|---|
| 1 | **Volume decline + late rise** | Per company: compare first 4 months vs last 4 months. Volume trend + late% trend | Volume down >30% AND late% up >15 points |
| 2 | **Client churned** | Companies with orders in months 1-6 but zero in last 2 months | Any company goes silent for 2+ months after being active |
| 3 | **Volume growth + improvement** | Per company: volume up >40% AND late% down >15 points over dataset | Positive story — both volume and quality improving |
| 4 | **ODA structural lateness** | ODA late% vs non-ODA late% across all companies | ODA late% > 1.5× non-ODA late% (almost always fires) |
| 5 | **Seasonal zone anomaly** | Late% for East/NE destinations by month | Any 3-month window where East/NE late% > 1.8× overall late% |
| 6 | **Bad lane** | Per-pincode late% with minimum 10 orders | Any pincode with late% > 60% and ≥10 orders |
| 7 | **New client ramp** | Companies with 0 orders in first 2 months but growing volume later | Volume trajectory starting from zero |
| 8 | **Overall trend** | Month-over-month E+OT% trend across all data | Always fires — describes the headline arc |

**Pattern card UI:**

```
┌─ severity strip (4px left border) ──────────────────────┐
│  🔴 CHURN RISK — PRISM INDUSTRIES                        │
│                                                          │
│  "Volume collapsed 87% while late deliveries tripled     │
│   over 8 months — this client is likely lost."          │
│                                                          │
│  • Orders fell from 40/month → 5/month (Jul→Feb)        │
│  • Late % rose from 8% → 60% over same period           │
│  • Last 2 months: only 8 orders total                   │
│                                                          │
│  [▸ Why is this happening?]   ← root-cause expander     │
└──────────────────────────────────────────────────────────┘
```

Severity color strips:
- 🔴 Red border `#F87171` — Churn Risk, Critical lateness
- 🟡 Yellow border `#FBBF24` — Watch, Seasonal anomaly, ODA issue
- 🟢 Green border `#4ADE80` — Growth story, Improvement arc
- ⚪ Grey border `#71717A` — Informational (overall trend, bad lane)

**Display limit:** Top 6 cards by severity, with "Show all N patterns" expander at the bottom. Severity order: red → yellow → green → grey.

**Mini sparkline:** Each card with a company trend shows a tiny 60×24px inline sparkline (volume or late% over months). Hidden on mobile.

---

### 3.3 Root-Cause Panel (inline expansion)

**Trigger:** "Why is this happening?" button on any pattern card that has a flagged company.

**Content:** Precomputed in the same single Groq call as pattern narration. Stored in `insight_cache`. Click = instant expand, zero API call.

**What it shows for a churn-risk company:**
```
▸ Why is this happening? — PRISM INDUSTRIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ODA exposure:    68% of their orders go to ODA pincodes
                 (vs 23% overall average)
Zone mix:        52% NE zone — highest TAT, highest variance
Worst pincode:   795001 (Imphal) — 78% late rate, 31 orders
Structural note: Even if ops improve, NE+ODA routes add
                 +1 day expected TAT and have 2x base lateness.
                 This client's geography is structurally hard.
```

Computed from:
- `SELECT _oda, COUNT(*) FROM shipments_latest WHERE order_id=?`
- `SELECT _destination_zone, COUNT(*) FROM shipments_latest WHERE order_id=?`
- `SELECT pin_code, destination_city, COUNT(*), SUM(CASE WHEN _sla_status='Late'...)`

All pure SQL, no extra Groq calls. The AI wrote the narrative at cache time.

---

### 3.4 AI Chat

**Position:** Bottom of Insights page. Sticky input bar at page bottom.

**This is the existing assistant** (`POST /api/assistant/chat`) — same backend, same Groq call, same context-stuffing. Just relocated.

**Changes vs current:**
- Remove "AI Assistant" from sidebar nav entirely
- Chat lives at bottom of Insights page
- On mobile: chat is a floating button (💬) that expands to full-screen overlay
- On desktop: chat panel below the pattern cards, full width, ~400px height
- The 4 suggestion chips from the current welcome card stay
- Conversation persists within the page session (React state), clears on navigation

**The distinction:** Pattern cards = proactive AI (tells you what it found). Chat = reactive AI (answers what you ask). Together they cover both modes of AI interaction.

---

## 4. Backend Architecture

### New DB tables

```sql
CREATE TABLE IF NOT EXISTS upload_snapshots (
    snapshot_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    uploaded_at    TEXT NOT NULL,
    file_count     INTEGER DEFAULT 1,
    total          INTEGER,
    delivered      INTEGER,
    eot_percent    REAL,
    late_count     INTEGER,
    rto_count      INTEGER,
    oda_count      INTEGER,
    date_min       TEXT,
    date_max       TEXT
);

CREATE TABLE IF NOT EXISTS snapshot_companies (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id    INTEGER REFERENCES upload_snapshots(snapshot_id),
    company        TEXT,
    total          INTEGER,
    delivered      INTEGER,
    eot_percent    REAL,
    late_count     INTEGER,
    in_transit     INTEGER
);

CREATE TABLE IF NOT EXISTS insight_cache (
    snapshot_id    INTEGER PRIMARY KEY REFERENCES upload_snapshots(snapshot_id),
    generated_at   TEXT,
    digest_bullets TEXT,     -- JSON array of 5 strings
    patterns       TEXT,     -- JSON array of pattern objects
    root_causes    TEXT      -- JSON object keyed by company name
);
```

### New API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/insights/digest` | Returns What-Changed digest (latest vs previous snapshot). From cache. |
| GET | `/api/insights/patterns` | Returns all pattern cards with narration. From cache. |
| GET | `/api/insights/root-cause?company=X` | Returns precomputed root-cause for a company. From cache. |
| POST | `/api/insights/regenerate` | Force-regenerates insights (admin use, not in UI) |

### Trigger flow (on every upload)

```
POST /api/upload
  → ingest_file() [existing]
  → cache_invalidate_all() [existing]
  → write_upload_snapshot()    [NEW — saves metrics to upload_snapshots]
  → run_pattern_detectors()    [NEW — 8 SQL detectors, returns structured data]
  → call_groq_for_insights()   [NEW — one Groq call, narrates everything]
  → write_insight_cache()      [NEW — saves to insight_cache]
  → return {success, rows_inserted}
```

All four new steps run synchronously after ingest. With 4,000-5,000 rows and
pre-indexed columns, the SQL detectors run in <1 second. The Groq call adds
~2-4 seconds. Total upload time increase: ~5 seconds. Acceptable.

### The single Groq call

System prompt contains:
- Current snapshot aggregates
- Per-company stats table (22 rows)
- All 8 detector outputs (structured data)
- Previous snapshot for digest comparison

Returns JSON with this shape:
```json
{
  "digest": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "patterns": [
    {
      "id": "volume_decline_late_rise",
      "company": "PRISM INDUSTRIES",
      "severity": "red",
      "headline": "Volume collapsed 87% while late deliveries tripled...",
      "bullets": ["Orders fell from 40/month → 5/month", "..."],
      "has_root_cause": true
    }
  ],
  "root_causes": {
    "PRISM INDUSTRIES": {
      "oda_share": 0.68,
      "dominant_zone": "NE",
      "worst_pincode": "795001",
      "worst_pincode_city": "Imphal",
      "worst_pincode_late_pct": 0.78,
      "narrative": "Even if ops improve, NE+ODA routes..."
    }
  }
}
```

Temperature: 0.2 (very factual). Max tokens: 1500 (enough for all 8 patterns).
If Groq fails: cache stores null, page shows "Insights unavailable — upload a
new file to regenerate" with the raw detector data as a fallback table.

---

## 5. Frontend Architecture

### New file: `frontend/src/pages/Insights.jsx`

```
<InsightsPage>
  <PageHeader title="AI Insights" subtitle="Patterns · Changes · Chat" />

  <DigestCard />           ← What-Changed, top of page
  <PatternGrid />          ← 6 cards (+ expander for rest)
    <PatternCard>
      <RootCausePanel />   ← inline expansion per card
    </PatternCard>
  <ChatPanel />            ← bottom, full width
</InsightsPage>
```

### Sidebar changes

- Remove "AI Assistant" nav item entirely
- Add "AI Insights" nav item where Assistant currently sits
- Icon: sparkle/star (✦) — same as current AI label
- Sublabel: "Patterns · Chat"

### Mobile layout (`@media max-width: 768px`)

- Sidebar → bottom navigation bar: Landing | Insights | (Menu for rest)
- Upload button: sticky top-right header, always visible
- DigestCard: collapsed by default, tap "What changed?" to expand
- PatternGrid: single column, no sparklines, full-width cards
- ChatPanel: floating 💬 button bottom-right → tap → full-screen chat overlay
- RootCause panels: full-width modal on mobile instead of inline expansion

### Loading states

- Page loads → show skeletons for digest + 3 pattern card placeholders
- If `insight_cache` is empty (first load, no upload yet): EmptyState
  "Upload your first Delhivery file to generate insights"
- If cache exists but Groq failed: show raw detector data as plain table
  with note "AI narration unavailable — showing raw findings"

---

## 6. Navigation & Sidebar Final State

After building Insights, the sidebar has these items (in order):

```
Landing          Overview
AI Insights      Patterns · Chat      ← moved up, Assistant removed
TAT Analysis     Delivered E+OT
Transit          In-flight
Aggregate        Company breakdown
Aggregate Transit Per-company in-flight
Customize        Ad-hoc query
Edit             Reference data
```

8 items total. AI Assistant tab is gone. One AI home.

---

## 7. Resume / Interview Framing

What this enables you to say honestly:

```
"Built an AI insights engine over 12 months of logistics data —
8 statistical pattern detectors (volume trend, churn signal,
seasonal anomaly, ODA structural lateness, bad lane detection)
generate structured findings; a single Groq (Llama 3.3 70B) call
narrates all findings and precomputes root-causes per company;
results cached per upload so page loads are instant with zero
live API calls. Upload-over-upload digest shows what changed
between data snapshots in 5 plain-English bullets."
```

Every word survives a technical deep-dive.

What you do NOT claim:
- RAG (no vector store, no document retrieval)
- Real-time AI (it's cached, on-demand regeneration only)
- Autonomous agents (it's one structured call, not a chain)

---

## 8. Build Order for Claude Code

```
Phase B1 — Backend foundation
  - schema.py: add upload_snapshots, snapshot_companies, insight_cache tables
  - New file: backend/insights/detectors.py — 8 SQL detector functions
  - New file: backend/insights/groq_narrator.py — single Groq call, JSON parse
  - New file: backend/insights/snapshot.py — write/read snapshot functions
  - upload.py: wire trigger flow after ingest
  - New router: backend/routers/insights.py — 3 GET endpoints
  - main.py: include insights router, seed snapshot_0 in auto_seed

Phase B2 — Frontend foundation
  - New page: frontend/src/pages/Insights.jsx (skeleton + data fetching)
  - New components:
      frontend/src/components/insights/DigestCard.jsx
      frontend/src/components/insights/PatternCard.jsx
      frontend/src/components/insights/RootCausePanel.jsx
      frontend/src/components/insights/ChatPanel.jsx (wraps existing chat)
  - App.jsx: add /insights route, remove /assistant route
  - Sidebar.jsx: replace AI Assistant with AI Insights, add mobile bottom nav

Phase B3 — Mobile responsive
  - index.css: add mobile breakpoint styles
  - Bottom nav bar component for mobile
  - Chat floating button + overlay for mobile
  - DigestCard collapsed default on mobile

Phase B4 — Polish + integration test
  - Verify: upload file → insights auto-generate → page shows within 1s
  - Verify: second upload → digest shows diff vs first
  - Verify: mobile layout on narrow viewport
  - Verify: Groq failure → graceful fallback, no crash
  - 28 pytest still pass
```

---

## 9. What This Is NOT

To be clear in interviews and the README:

- **Not RAG** — no vector store, no document retrieval, no embeddings
- **Not an autonomous agent** — one structured Groq call per upload, deterministic
- **Not real-time** — cached per upload, instant page loads
- **Not a separate AI product** — it's an integrated insights layer on top of
  a logistics analytics dashboard that was already working

The honest framing: **"BI + AI narration"** — statistics find the patterns,
the LLM explains them in plain English for non-technical founders.
That framing is both accurate and impressive.

---

*This spec is final. Build against it exactly.*
