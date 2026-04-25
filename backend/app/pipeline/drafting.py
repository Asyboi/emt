"""Stage 5 — AAR drafting (Phase 2 stub).

Phase 5 replaces this with a two-pass Claude Sonnet call (summary then
narrative). For now we return the canonical fixture with the case_id
swapped to the actual case under review.
"""

from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone

from app.pipeline._fixture import fixture_aar
from app.schemas import AARDraft, Case, Finding, ProtocolCheck, TimelineEntry


async def draft_aar(
    case: Case,
    timeline: list[TimelineEntry],
    findings: list[Finding],
    checks: list[ProtocolCheck],
) -> AARDraft:
    await asyncio.sleep(1.0 + random.random())
    aar = fixture_aar()
    aar.case_id = case.case_id
    aar.generated_at = datetime.now(timezone.utc)
    aar.timeline = list(timeline)
    aar.findings = list(findings)
    aar.protocol_checks = list(checks)
    return aar
