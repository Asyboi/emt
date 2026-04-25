"""Stage 4 — discrepancy finding generation (Phase 2 stub).

Phase 5 replaces this with a Claude Sonnet call that generates findings
from the reconciled timeline and protocol checks.
"""

from __future__ import annotations

import asyncio
import random

from app.pipeline._fixture import fixture_aar
from app.schemas import Finding, ProtocolCheck, TimelineEntry


async def generate_findings(
    timeline: list[TimelineEntry],
    checks: list[ProtocolCheck],
) -> list[Finding]:
    await asyncio.sleep(1.0 + random.random())
    return list(fixture_aar().findings)
