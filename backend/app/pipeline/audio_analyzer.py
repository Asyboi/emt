"""Stage 1c — dispatch audio analysis (Phase 2 stub).

Phase 5 replaces this with Whisper transcription + Claude event extraction.
"""

from __future__ import annotations

import asyncio
import random

from app.pipeline._fixture import audio_events
from app.schemas import Case, Event


async def analyze_audio(case: Case) -> list[Event]:
    await asyncio.sleep(1.0 + random.random())
    return audio_events()
