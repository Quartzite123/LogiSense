"""Per-visitor session databases (public-demo isolation).

The deployed demo is multi-tenant: every browser session gets its own SQLite DB,
seeded from the bundled ``demo/demo.db``. Uploads only mutate that visitor's copy,
so one person's upload never overwrites what everyone else sees.

Session DBs live under ``/tmp/sessions`` (ephemeral — fine, they expire in 24h and
the template is committed to the repo). The SessionMiddleware in backend/main.py
maps the ``logi_session`` cookie to a DB file and points app.store.db.get_conn()
at it for the duration of each request.
"""
from __future__ import annotations

import shutil
import time
import uuid
from pathlib import Path

SESSIONS_DIR = Path("/tmp/sessions")
DEMO_DB = Path(__file__).resolve().parent.parent / "demo" / "demo.db"


def get_or_create_session(session_id: str | None) -> tuple[str, str]:
    """Return ``(session_id, db_path)`` for this visitor.

    A missing/invalid/expired id mints a fresh UUID; a new session's DB is copied
    from demo.db on first use.
    """
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

    if not session_id or not _is_valid(session_id):
        session_id = str(uuid.uuid4())

    db_path = SESSIONS_DIR / f"{session_id}.db"
    if not db_path.exists():
        shutil.copy(str(DEMO_DB), str(db_path))

    return session_id, str(db_path)


def _is_valid(sid: str) -> bool:
    """True only for a well-formed UUID whose DB file still exists."""
    try:
        uuid.UUID(sid)
    except (ValueError, AttributeError, TypeError):
        return False
    return (SESSIONS_DIR / f"{sid}.db").exists()


def cleanup_old_sessions(max_age_hours: int = 24) -> int:
    """Delete session DBs (and their WAL sidecars) idle for > max_age_hours."""
    if not SESSIONS_DIR.exists():
        return 0
    cutoff = time.time() - max_age_hours * 3600
    removed = 0
    for f in SESSIONS_DIR.glob("*.db"):
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink(missing_ok=True)
                for suffix in ("-wal", "-shm"):
                    Path(f"{f}{suffix}").unlink(missing_ok=True)
                removed += 1
        except OSError:
            pass
    return removed
