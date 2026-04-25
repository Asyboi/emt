"""Shared fixture loader for Phase 2 pipeline stubs.

Every stage in this phase returns a slice of the canonical sample AAR.
Loading the fixture once at module import keeps the stub work cheap and
guarantees that every stub returns schema-valid data the frontend can
render against.
"""

from __future__ import annotations

import json
from functools import lru_cache

from app.config import settings
from app.schemas import AARDraft, Event, EventSource


@lru_cache(maxsize=1)
def _aar() -> AARDraft:
    fixture = (settings.FIXTURES_DIR.resolve() / "sample_aar.json")
    data = json.loads(fixture.read_text(encoding="utf-8"))
    return AARDraft.model_validate(data)


def fixture_aar() -> AARDraft:
    return _aar().model_copy(deep=True)


def _events_by_source(source: EventSource) -> list[Event]:
    aar = _aar()
    seen: dict[str, Event] = {}
    for entry in aar.timeline:
        for event in entry.source_events:
            if event.source == source and event.event_id not in seen:
                seen[event.event_id] = event
    return [e.model_copy(deep=True) for e in seen.values()]


def pcr_events() -> list[Event]:
    return _events_by_source(EventSource.PCR)


def video_events() -> list[Event]:
    return _events_by_source(EventSource.VIDEO)


def audio_events() -> list[Event]:
    return _events_by_source(EventSource.AUDIO)
