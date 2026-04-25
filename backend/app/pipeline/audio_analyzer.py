"""Stage 1c — dispatch audio analysis (Phase 5).

Two-step:
  1. ElevenLabs Scribe v1 transcribes the audio with word-level
     timestamps. We coalesce words into utterance-style segments
     (~12s windows broken on long pauses) so Claude has digestible
     time-anchored chunks instead of a raw word stream.
  2. Claude Haiku 4.5 extracts clinically significant Events from the
     segmented transcript using the same tool-shape as the PCR parser.

Graceful degradation: if the audio file doesn't exist we return [].
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.llm_clients import claude_haiku, elevenlabs_transcribe
from app.prompts import (
    AUDIO_EVENTS_SYSTEM,
    AUDIO_EVENTS_TOOL,
    AUDIO_EVENTS_USER_TEMPLATE,
)
from app.schemas import Case, Event, EventSource, EventType


def _segment_words(words: list[dict], max_segment_seconds: float = 12.0, pause_seconds: float = 1.5) -> list[dict]:
    """Group ElevenLabs word tokens into utterance segments.

    Breaks on either a long inter-word pause OR a max-segment-duration
    rollover. We only group ``word``-typed tokens (filter out
    ``audio_event`` / ``spacing`` markers).
    """

    segments: list[dict] = []
    current_words: list[dict] = []
    current_start: float | None = None
    last_end: float | None = None

    def flush() -> None:
        if not current_words:
            return
        text = "".join(w.get("text", "") for w in current_words).strip()
        segments.append(
            {
                "start_seconds": current_words[0]["start"],
                "end_seconds": current_words[-1]["end"],
                "text": text,
            }
        )

    for w in words:
        if w.get("type") not in (None, "word"):
            continue
        start = w.get("start")
        end = w.get("end")
        if start is None or end is None:
            continue

        if current_start is None:
            current_start = start
            current_words = [w]
            last_end = end
            continue

        gap = start - (last_end or start)
        span = end - current_start
        if gap >= pause_seconds or span >= max_segment_seconds:
            flush()
            current_words = [w]
            current_start = start
        else:
            current_words.append(w)
        last_end = end

    flush()
    return segments


def _format_timestamp(seconds: float) -> str:
    s = max(0, int(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


async def analyze_audio(case: Case) -> list[Event]:
    audio_path = Path(case.audio_path)
    if not audio_path.is_absolute():
        # case.audio_path is repo-relative ("cases/case_NN/audio.mp3"); resolve from CWD.
        audio_path = Path.cwd() / audio_path

    if not audio_path.exists():
        return []

    transcript = await elevenlabs_transcribe(str(audio_path))
    words = transcript.get("words") or []
    segments = _segment_words(words)

    if not segments:
        return []

    response = await claude_haiku(
        system=AUDIO_EVENTS_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": AUDIO_EVENTS_USER_TEMPLATE.format(
                    segments_json=json.dumps(segments, indent=2)
                ),
            }
        ],
        tools=[AUDIO_EVENTS_TOOL],
        max_tokens=4096,
    )

    tool_use = next(
        (b for b in response["content"] if b["type"] == "tool_use"), None
    )
    if tool_use is None:
        raise RuntimeError("Claude did not return a tool_use block for extract_audio_events")

    raw_events = tool_use["input"].get("events", [])
    events: list[Event] = []
    for e in raw_events:
        events.append(
            Event(
                event_id=str(uuid.uuid4()),
                timestamp=e.get("timestamp") or _format_timestamp(e["timestamp_seconds"]),
                timestamp_seconds=e["timestamp_seconds"],
                source=EventSource.AUDIO,
                event_type=EventType(e["event_type"]),
                description=e["description"],
                details=e.get("details", {}),
                confidence=e["confidence"],
                raw_evidence=e["raw_evidence"],
            )
        )
    events.sort(key=lambda ev: ev.timestamp_seconds)
    return events
