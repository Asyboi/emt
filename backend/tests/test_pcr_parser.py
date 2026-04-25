"""Integration test for the real Claude Haiku PCR parser.

Skipped when ANTHROPIC_API_KEY is not configured so the suite stays green
in environments without API credentials.
"""

from __future__ import annotations

import pytest

from app.case_loader import load_case
from app.config import settings
from app.pipeline.pcr_parser import parse_pcr
from app.schemas import EventSource, EventType

pytestmark = pytest.mark.skipif(
    not settings.ANTHROPIC_API_KEY,
    reason="ANTHROPIC_API_KEY not set",
)


async def test_parse_pcr_extracts_events_from_case_01() -> None:
    case = load_case("case_01")
    events = await parse_pcr(case)

    assert len(events) >= 5, f"expected >=5 events, got {len(events)}"
    assert all(e.source == EventSource.PCR for e in events), "all events must be PCR-sourced"
    assert any(e.event_type == EventType.MEDICATION for e in events), (
        "expected at least one medication event"
    )
