"""Stage 3 — protocol adherence checks (still a fixture-derived stub).

The QI Case Review update keeps this as a stub for now. A real Sonnet
implementation lands in a later phase; today's behavior matches what
upstream stubs expect and exercises the orchestrator's stage timing.
"""

from __future__ import annotations

import asyncio
import random

from app.pipeline._fixture import fixture_qi_review
from app.schemas import ProtocolCheck, TimelineEntry


async def check_protocol(
    timeline: list[TimelineEntry],
    incident_type: str,
) -> list[ProtocolCheck]:
    await asyncio.sleep(1.0 + random.random())
    return list(fixture_qi_review().protocol_checks)
