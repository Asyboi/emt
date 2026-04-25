"""Tests for the audio analyzer stage.

The graceful-degradation test runs always (no API needed). The
end-to-end transcription test is skipped unless both ElevenLabs and
Anthropic credentials AND a real audio file are available.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.config import settings
from app.pipeline.audio_analyzer import _segment_words, analyze_audio
from app.schemas import Case, EventSource


def _case(audio_path: str = "cases/case_does_not_exist/audio.mp3") -> Case:
    return Case(
        case_id="case_test",
        incident_type="Cardiac arrest",
        incident_date=datetime.now(timezone.utc),
        pcr_path="cases/case_test/pcr.md",
        video_path="cases/case_test/video.mp4",
        audio_path=audio_path,
    )


async def test_analyze_audio_returns_empty_when_file_missing() -> None:
    events = await analyze_audio(_case("cases/__nope__/audio.mp3"))
    assert events == []


def test_segment_words_breaks_on_long_pause_and_max_duration() -> None:
    words = [
        {"type": "word", "text": "Pushing", "start": 0.0, "end": 0.5},
        {"type": "word", "text": " one", "start": 0.55, "end": 0.8},
        {"type": "word", "text": " milligram", "start": 0.85, "end": 1.4},
        {"type": "word", "text": " epi.", "start": 1.45, "end": 1.9},
        # 5s pause — should start a new segment
        {"type": "word", "text": "Resuming", "start": 7.0, "end": 7.6},
        {"type": "word", "text": " compressions.", "start": 7.65, "end": 8.4},
    ]
    segs = _segment_words(words)
    assert len(segs) == 2
    assert segs[0]["text"].strip().startswith("Pushing")
    assert segs[1]["text"].strip().startswith("Resuming")
    assert segs[1]["start_seconds"] == pytest.approx(7.0)


@pytest.mark.skipif(
    not (settings.ELEVENLABS_API_KEY and settings.ANTHROPIC_API_KEY),
    reason="ELEVENLABS_API_KEY and/or ANTHROPIC_API_KEY not set",
)
async def test_analyze_audio_end_to_end() -> None:
    audio = Path("cases/case_01/audio.mp3")
    if not audio.exists():
        pytest.skip("cases/case_01/audio.mp3 not present")

    case = _case(str(audio))
    events = await analyze_audio(case)
    assert all(e.source == EventSource.AUDIO for e in events)
