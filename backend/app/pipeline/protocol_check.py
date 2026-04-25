"""Stage 3 — protocol adherence checks (Phase 2 stub).

Phase 5 replaces this with a Claude Sonnet call that grades the timeline
against the relevant ACLS protocol steps.
"""

from __future__ import annotations

import asyncio
import random

from app.pipeline._fixture import fixture_aar
from app.schemas import ProtocolCheck, TimelineEntry


async def check_protocol(
    timeline: list[TimelineEntry],
    incident_type: str,
) -> list[ProtocolCheck]:
    await asyncio.sleep(1.0 + random.random())
    return list(fixture_aar().protocol_checks)
