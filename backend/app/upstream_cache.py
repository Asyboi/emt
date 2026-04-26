"""Cache for the slow upstream pipeline stages (CAD/PCR/video/audio).

Demo support: pre-warm `cases/<id>/upstream_cache.json` so the orchestrator
can skip Gemini video analysis, ElevenLabs Scribe transcription, Claude
PCR parsing, and CAD JSON parsing — and run only the fast downstream
agentic stages (reconciliation → protocol_check → findings → drafting)
live during a demo.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field

from app.config import settings
from app.schemas import CADRecord, Event


class UpstreamCache(BaseModel):
    pcr_events: list[Event] = Field(default_factory=list)
    video_events: list[Event] = Field(default_factory=list)
    audio_events: list[Event] = Field(default_factory=list)
    cad_record: Optional[CADRecord] = None


def _case_dir(case_id: str) -> Path:
    return settings.CASES_DIR.resolve() / case_id


def _cache_path(case_id: str) -> Path:
    return _case_dir(case_id) / "upstream_cache.json"


def load_upstream_cache(case_id: str) -> UpstreamCache | None:
    path = _cache_path(case_id)
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return UpstreamCache.model_validate(data)


def save_upstream_cache(case_id: str, cache: UpstreamCache) -> Path:
    case_dir = _case_dir(case_id)
    if not case_dir.is_dir():
        raise FileNotFoundError(f"Case not found: {case_id}")
    path = _cache_path(case_id)
    path.write_text(cache.model_dump_json(indent=2), encoding="utf-8")
    return path


def clear_upstream_cache(case_id: str) -> bool:
    path = _cache_path(case_id)
    if not path.exists():
        return False
    path.unlink()
    return True
