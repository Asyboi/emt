"""Persistent store for confirmed PCR drafts.

Each confirmed PCR is written to ``{CASES_DIR}/../pcr_store/{case_id}.json``
containing the full ``PCRDraft`` model. The store is independent of the case
directory so confirmed PCRs can be browsed and reused across cases.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from pydantic import ValidationError

from app.config import settings
from app.schemas import PCRDraft

logger = logging.getLogger(__name__)


def _store_dir() -> Path:
    return settings.CASES_DIR.parent / "pcr_store"


def _path_for(case_id: str) -> Path:
    return _store_dir() / f"{case_id}.json"


def save_pcr(draft: PCRDraft) -> None:
    """Persist a confirmed PCR draft to the store, creating the directory if needed."""
    store = _store_dir()
    store.mkdir(parents=True, exist_ok=True)
    _path_for(draft.case_id).write_text(draft.model_dump_json(indent=2))


def load_pcr(case_id: str) -> Optional[PCRDraft]:
    """Read a saved PCR draft. Returns None if missing or invalid."""
    path = _path_for(case_id)
    if not path.exists():
        return None
    try:
        return PCRDraft.model_validate_json(path.read_text())
    except ValidationError as exc:
        logger.warning("Invalid PCR draft at %s: %s", path, exc)
        return None


def list_saved_pcrs() -> list[PCRDraft]:
    """Return all saved PCR drafts, sorted by ``confirmed_at`` descending.

    Drafts that fail validation are skipped with a warning.
    """
    store = _store_dir()
    if not store.exists():
        return []

    drafts: list[PCRDraft] = []
    for path in store.glob("*.json"):
        try:
            drafts.append(PCRDraft.model_validate_json(path.read_text()))
        except ValidationError as exc:
            logger.warning("Skipping invalid PCR draft %s: %s", path, exc)

    drafts.sort(
        key=lambda d: d.confirmed_at.timestamp() if d.confirmed_at else 0.0,
        reverse=True,
    )
    return drafts


def delete_pcr(case_id: str) -> bool:
    """Remove a saved PCR. Returns True if it existed, False otherwise."""
    path = _path_for(case_id)
    if not path.exists():
        return False
    path.unlink()
    return True
