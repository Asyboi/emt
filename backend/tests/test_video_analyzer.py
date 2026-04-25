"""Tests for the video analyzer stage.

Graceful-degradation tests don't need API access. The end-to-end
Gemini test runs only when GOOGLE_API_KEY and a real case_01 video
file are present.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.config import settings
from app.pipeline.video_analyzer import (
    MAX_VIDEO_BYTES,
    _fallback_events,
    analyze_video,
)
from app.schemas import Case, EventSource


def _case(video_path: str) -> Case:
    return Case(
        case_id="case_test",
        incident_type="Cardiac arrest",
        incident_date=datetime.now(timezone.utc),
        pcr_path="cases/case_test/pcr.md",
        video_path=video_path,
        audio_path="cases/case_test/audio.mp3",
    )


async def test_analyze_video_returns_empty_when_file_missing() -> None:
    events = await analyze_video(_case("cases/__nope__/video.mp4"))
    assert events == []


def test_fallback_events_are_well_formed() -> None:
    events = _fallback_events()
    assert events, "fallback must return at least one event"
    assert all(e.source == EventSource.VIDEO for e in events)
    assert all(0.0 <= e.confidence <= 1.0 for e in events)


async def test_analyze_video_uses_fallback_when_too_large(tmp_path: Path) -> None:
    big = tmp_path / "huge.mp4"
    # Sparse-write a file just over the 50MB cap.
    with big.open("wb") as fh:
        fh.seek(MAX_VIDEO_BYTES + 1)
        fh.write(b"\0")

    events = await analyze_video(_case(str(big)))
    assert events, "expected fallback events when video exceeds size cap"
    assert all(e.source == EventSource.VIDEO for e in events)
    assert any("fallback" in e.raw_evidence for e in events)


@pytest.mark.skipif(
    not settings.GOOGLE_API_KEY,
    reason="GOOGLE_API_KEY not set",
)
async def test_analyze_video_end_to_end() -> None:
    video = Path("cases/case_01/video.mp4")
    if not video.exists():
        pytest.skip("cases/case_01/video.mp4 not present")
    events = await analyze_video(_case(str(video)))
    assert all(e.source == EventSource.VIDEO for e in events)
