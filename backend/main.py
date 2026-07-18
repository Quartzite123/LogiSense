"""LogiSense FastAPI entry point (Phase 1).

Run from the backend/ directory:
    cd backend && uvicorn main:app --reload --port 8000

The existing Streamlit pipeline/store code in ../app is reused as-is. We only
add an HTTP layer on top. The repo root is put on sys.path so `app.*` imports
resolve regardless of the current working directory.
"""
from __future__ import annotations

import glob
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# --- make the existing `app` package importable (repo root on sys.path) ----
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load backend/.env (GROQ_API_KEY, etc.) from an absolute path so it's found
# regardless of where uvicorn is started — `python -m uvicorn backend.main:app`
# from the repo root and `uvicorn main:app` from backend/ both pick it up.
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.store.db import get_conn, init_db
from app.store.seed import seed_all_if_empty
from app.store.queries import count_latest

from backend.routers import (
    upload, landing, transit, tat, aggregate, aggregate_transit, customize, exports, edit,
)
from backend.routers.insights import router as insights_router
from backend.routers.assistant import router as assistant_router

DEMO_DIR = ROOT / "tools" / "sample_data"


def _auto_seed_demo_data() -> None:
    """Batch-ingest the bundled demo files when shipments_latest is empty.

    Fresh DB (zero shipment rows) -> loads every tools/sample_data/*.xlsx through
    the existing pipeline (dedup-merged across files, so overlap LRNs collapse).
    DB that already has data -> no-op. Works locally and on Render. app/ untouched.
    """
    if count_latest() > 0:
        return  # already has shipment data — never overwrite

    demo_files = sorted(glob.glob(str(DEMO_DIR / "*.xlsx")))
    if not demo_files:
        return  # no bundled demo files — skip silently

    # ingest_file() appends+dedup-merges; clear once before the batch (same as the
    # Streamlit upload dialog's per-batch behaviour). ingest_file returns a summary
    # dict, so the row count comes from rows_new + rows_updated.
    from app.pipeline.ingest import clear_all_shipments, ingest_file

    print(f"[startup] Auto-seeding demo data from {len(demo_files)} files...")
    clear_all_shipments()
    for path in demo_files:
        with open(path, "rb") as fh:
            summary = ingest_file(fh, os.path.basename(path))
        winners = int(summary["rows_new"]) + int(summary["rows_updated"])
        print(f"  {os.path.basename(path)}: {winners} rows")
    print(f"[startup] Demo seed complete: {count_latest()} unique LRNs in shipments_latest")

    # Insights on the demo data (INSIGHTS_SPEC §3.1): seed a synthetic "previous
    # state" first so the very first What-Changed digest has something to compare
    # against. Non-fatal — a failure here must never block startup.
    try:
        from backend.insights.snapshot import (
            generate_and_cache_insights,
            get_previous_snapshot,
            seed_snapshot_zero,
            write_upload_snapshot,
        )
        conn = get_conn()
        try:
            seed_snapshot_zero(conn)                       # synthetic previous state
            snapshot_id = write_upload_snapshot(conn, file_count=len(demo_files))
            prev = get_previous_snapshot(conn, snapshot_id)
            generate_and_cache_insights(conn, snapshot_id, prev)
            print("[startup] Insights generated from demo data")
        finally:
            conn.close()
    except Exception as e:
        print(f"[startup] Insights generation failed (non-fatal): {e}")


def _init_demo_db() -> None:
    """Instant demo/cloud startup: drop the pre-built demo.db into place instead
    of re-seeding from the 8 xlsx files (~2 min).

    - DB already populated  -> skip (a Render persistent disk survives redeploys).
    - fresh DB + demo/demo.db present -> copy it (instant, <1s).
    - fresh DB + no demo.db          -> fall back to the file seeder.

    demo/demo.db is a checkpointed snapshot of a fully seeded DB (reference
    pincodes + 4017 synthetic shipments + cached Groq insights), so no further
    seeding is needed after the copy.
    """
    import shutil
    import sqlite3

    from app.store.db import DB_PATH

    demo_path = ROOT / "demo" / "demo.db"

    if DB_PATH.exists():
        try:
            conn = sqlite3.connect(str(DB_PATH))
            count = conn.execute("SELECT COUNT(*) FROM shipments_latest").fetchone()[0]
            conn.close()
        except Exception:
            count = 0
        if count > 0:
            print(f"[startup] DB has {count} rows — skipping demo init")
            return

    if demo_path.exists():
        print("[startup] Copying pre-built demo.db — instant startup")
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Drop stale WAL sidecars left by init_db()/seed on the empty DB so the
        # freshly copied database isn't clobbered by a leftover write-ahead log.
        for suffix in ("-wal", "-shm"):
            side = Path(f"{DB_PATH}{suffix}")
            if side.exists():
                side.unlink()
        shutil.copy(str(demo_path), str(DB_PATH))
        print("[startup] Demo DB ready — 4017 rows, insights pre-cached")
    else:
        print("[startup] demo/demo.db not found — falling back to seeder")
        # The file seeder ingests through the pipeline, which needs the reference
        # pincode master present first.
        try:
            seed_all_if_empty()
        except Exception as e:
            print(f"[startup] reference seeding skipped/failed: {e}")
        _auto_seed_demo_data()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup: ensure schema exists, then seed reference data if the live
    # tables are empty (seed_all_if_empty is idempotent — see app/store/seed.py).
    init_db()
    # Demo init first: on a fresh disk this copies the pre-built demo.db (which
    # already contains the reference pincode master), so the expensive xlsx seed
    # below short-circuits to a no-op — keeping cloud cold-starts near-instant.
    try:
        _init_demo_db()
    except Exception as e:  # never block startup on optional demo init
        print(f"[startup] demo init skipped/failed: {e}")
    try:
        seed_all_if_empty()  # backstop; no-op once demo.db (with pincodes) is in place
    except Exception as e:  # never block startup on optional reference seeding
        print(f"[startup] reference seeding skipped/failed: {e}")
    yield


app = FastAPI(title="LogiSense API", version="0.1.0", lifespan=lifespan)

# CORS: Vite dev server (dev also uses a /api proxy, so this is a backstop) plus
# the production Vercel domain. Vercel preview deploys get hashed subdomains, so
# they're matched with allow_origin_regex — CORSMiddleware.allow_origins does
# exact matches only, so a glob string like "https://logisense-*.vercel.app"
# would never match a real origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://logi-sense-one.vercel.app",
        "https://logisense-1dvc.onrender.com",
    ],
    allow_origin_regex=r"https://logi-sense-[a-z0-9-]+\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(landing.router, prefix="/api/landing", tags=["landing"])
app.include_router(tat.router, prefix="/api/tat", tags=["tat"])
app.include_router(transit.router, prefix="/api/transit", tags=["transit"])
app.include_router(aggregate.router, prefix="/api/aggregate", tags=["aggregate"])
app.include_router(aggregate_transit.router, prefix="/api/aggregate-transit", tags=["aggregate-transit"])
app.include_router(customize.router, prefix="/api/customize", tags=["customize"])
app.include_router(exports.router, prefix="/api/export", tags=["exports"])
app.include_router(edit.router, prefix="/api/edit", tags=["edit"])
app.include_router(insights_router)  # already prefixed /api/insights
app.include_router(assistant_router)  # already prefixed /api/assistant


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "rows_in_latest": count_latest()}


# --- Production: serve the built React app if it exists ---------------------
# (In dev you run Vite separately on :5173; this only kicks in after a build.)
_DIST = ROOT / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="static")
