"""Stage 1a — PCR parsing (Phase 2 stub).

Phase 4 replaces this with a real Claude Haiku call.
"""

from __future__ import annotations

import asyncio
import random

from app.pipeline._fixture import pcr_events
from app.schemas import Case, Event


async def parse_pcr(case: Case) -> list[Event]:
    await asyncio.sleep(1.0 + random.random())
    return pcr_events()
