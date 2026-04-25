"""Stage 1b — body-cam video analysis (Phase 2 stub).

Phase 5 replaces this with a real Gemini Flash call against case.video_path.
"""

from __future__ import annotations

import asyncio
import random

from app.pipeline._fixture import video_events
from app.schemas import Case, Event


async def analyze_video(case: Case) -> list[Event]:
    await asyncio.sleep(1.0 + random.random())
    return video_events()
