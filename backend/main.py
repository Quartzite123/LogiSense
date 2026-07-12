"""LogiSense FastAPI entry point (Phase 1).

Run from the backend/ directory:
    cd backend && uvicorn main:app --reload --port 8000

The existing Streamlit pipeline/store code in ../app is reused as-is. We only
add an HTTP layer on top. The repo root is put on sys.path so `app.*` imports
resolve regardless of the current working directory.
"""
from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

# --- make the existing `app` package importable (repo root on sys.path) ----
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.store.db import init_db
from app.store.seed import seed_all_if_empty
from app.store.queries import count_latest

from backend.routers import (
    upload, landing, transit, tat, aggregate, aggregate_transit, customize, exports, edit,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup: ensure schema exists, then seed reference data if the live
    # tables are empty (seed_all_if_empty is idempotent — see app/store/seed.py).
    init_db()
    try:
        seed_all_if_empty()
    except Exception as e:  # never block startup on optional reference seeding
        print(f"[startup] reference seeding skipped/failed: {e}")
    yield


app = FastAPI(title="LogiSense API", version="0.1.0", lifespan=lifespan)

# CORS for the Vite dev server (dev also uses a /api proxy, so this is a backstop).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "rows_in_latest": count_latest()}


# --- Production: serve the built React app if it exists ---------------------
# (In dev you run Vite separately on :5173; this only kicks in after a build.)
_DIST = ROOT / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="static")
