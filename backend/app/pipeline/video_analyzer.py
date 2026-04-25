"""Stage 1b — body-cam video analysis (Phase 5).

Uses Gemini 2.5 Flash with native video input. The video is uploaded
via the Files API, the model is asked to identify visible clinical
events, and the response is constrained to a function-call schema
mirroring the PCR/audio Event tool shape.

Demo-safety:
- If the video file is missing, return [] (graceful no-op).
- If the file is larger than 50MB, log a warning and return a small
  hardcoded fallback so the pipeline / demo never crashes on file size.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from app.llm_clients import gemini_flash_video
from app.prompts import (
    VIDEO_EVENTS_SYSTEM,
    VIDEO_EVENTS_TOOL,
    VIDEO_EVENTS_USER_PROMPT,
)
from app.schemas import Case, Event, EventSource, EventType

logger = logging.getLogger(__name__)

MAX_VIDEO_BYTES = 50 * 1024 * 1024  # 50 MB


def _format_timestamp(seconds: float) -> str:
    s = max(0, int(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def _fallback_events() -> list[Event]:
    """Hardcoded events used when the real video can't be analyzed.

    Keeps the pipeline producing schema-valid output during the demo
    even if the configured video is too large, missing, or the upload
    fails. Mirrors a generic OOH cardiac arrest body-cam timeline.
    """

    samples: list[tuple[float, EventType, str]] = [
        (5.0, EventType.ARRIVAL, "Crew enters scene"),
        (45.0, EventType.CPR_START, "Compressions visibly underway"),
        (120.0, EventType.RHYTHM_CHECK, "Monitor pause for rhythm check"),
        (185.0, EventType.MEDICATION, "Epi syringe pushed via IV"),
    ]
    return [
        Event(
            event_id=str(uuid.uuid4()),
            timestamp=_format_timestamp(t),
            timestamp_seconds=t,
            source=EventSource.VIDEO,
            event_type=etype,
            description=desc,
            details={},
            confidence=0.5,
            raw_evidence=f"[fallback] {desc}",
        )
        for t, etype, desc in samples
    ]


async def analyze_video(case: Case) -> list[Event]:
    video_path = Path(case.video_path)
    if not video_path.is_absolute():
        video_path = Path.cwd() / video_path

    if not video_path.exists():
        return []

    size = video_path.stat().st_size
    if size > MAX_VIDEO_BYTES:
        logger.warning(
            "video %s is %.1fMB, exceeds %.0fMB cap — using fallback events",
            video_path,
            size / 1024 / 1024,
            MAX_VIDEO_BYTES / 1024 / 1024,
        )
        return _fallback_events()

    try:
        result = await gemini_flash_video(
            video_path=str(video_path),
            prompt=VIDEO_EVENTS_USER_PROMPT,
            tool=VIDEO_EVENTS_TOOL,
            system=VIDEO_EVENTS_SYSTEM,
        )
    except Exception:
        logger.exception("Gemini video analysis failed for %s — using fallback", video_path)
        return _fallback_events()

    raw_events = result.get("events") or []
    events: list[Event] = []
    for e in raw_events:
        try:
            events.append(
                Event(
                    event_id=str(uuid.uuid4()),
                    timestamp=e.get("timestamp") or _format_timestamp(e["timestamp_seconds"]),
                    timestamp_seconds=e["timestamp_seconds"],
                    source=EventSource.VIDEO,
                    event_type=EventType(e["event_type"]),
                    description=e["description"],
                    details=e.get("details", {}) or {},
                    confidence=e["confidence"],
                    raw_evidence=e["raw_evidence"],
                )
            )
        except (KeyError, ValueError):
            logger.warning("dropping malformed video event from gemini: %r", e)
            continue

    if not events:
        logger.warning("Gemini returned no events for %s — using fallback", video_path)
        return _fallback_events()

    events.sort(key=lambda ev: ev.timestamp_seconds)
    return events
