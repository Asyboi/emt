"""Stage 2 — timeline reconciliation (Phase 2 stub).

Phase 5 replaces this with a Claude Sonnet call that matches events from
the three sources into reconciled TimelineEntry rows.
"""

from __future__ import annotations

import asyncio
import random

from app.pipeline._fixture import fixture_aar
from app.schemas import Event, TimelineEntry


async def reconcile(
    pcr: list[Event],
    video: list[Event],
    audio: list[Event],
) -> list[TimelineEntry]:
    await asyncio.sleep(1.0 + random.random())
    return list(fixture_aar().timeline)
