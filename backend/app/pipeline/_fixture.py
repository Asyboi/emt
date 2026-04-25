"""Shared fixture loader for pipeline stubs and drafting fallbacks.

Loads the canonical QI Case Review sample once at import (lru_cache), and
exposes per-source event slicers (still used by the protocol_check stub)
plus QI-specific accessors that the new drafting stage uses as a
fallback when an LLM sub-call fails.
"""

from __future__ import annotations

import json
from functools import lru_cache

from app.config import settings
from app.schemas import (
    ClinicalAssessmentItem,
    DocumentationQualityAssessment,
    Event,
    EventSource,
    QICaseReview,
    Recommendation,
    UtsteinData,
)


@lru_cache(maxsize=1)
def _review() -> QICaseReview:
    fixture = settings.FIXTURES_DIR.resolve() / "sample_qi_review.json"
    data = json.loads(fixture.read_text(encoding="utf-8"))
    return QICaseReview.model_validate(data)


def fixture_qi_review() -> QICaseReview:
    return _review().model_copy(deep=True)


def fixture_clinical_assessment() -> list[ClinicalAssessmentItem]:
    return [item.model_copy(deep=True) for item in _review().clinical_assessment]


def fixture_documentation_quality() -> DocumentationQualityAssessment:
    return _review().documentation_quality.model_copy(deep=True)


def fixture_utstein_data() -> UtsteinData | None:
    utstein = _review().utstein_data
    return utstein.model_copy(deep=True) if utstein is not None else None


def fixture_recommendations() -> list[Recommendation]:
    return [rec.model_copy(deep=True) for rec in _review().recommendations]


def _events_by_source(source: EventSource) -> list[Event]:
    review = _review()
    seen: dict[str, Event] = {}
    for entry in review.timeline:
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
