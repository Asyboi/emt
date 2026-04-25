"""Top-level pipeline orchestrator.

Runs the seven Phase 2 stub stages in the correct order — Stage 1a/1b/1c
in parallel via asyncio.gather, then stages 2-5 sequentially — emitting
a PipelineProgress event for each `running` and `complete` transition so
the SSE stream and CLI can render live progress.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from app.pipeline import (
    audio_analyzer,
    drafting,
    findings as findings_stage,
    pcr_parser,
    protocol_check,
    reconciliation,
    video_analyzer,
)
from app.schemas import (
    AARDraft,
    Case,
    PipelineProgress,
    PipelineStage,
)

ProgressCallback = Callable[[PipelineProgress], Awaitable[None]]


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _run_stage(
    stage: PipelineStage,
    coro_factory: Callable[[], Awaitable],
    progress: ProgressCallback,
):
    started_at = _now()
    await progress(PipelineProgress(stage=stage, status="running", started_at=started_at))
    try:
        result = await coro_factory()
    except Exception as exc:
        await progress(
            PipelineProgress(
                stage=stage,
                status="error",
                started_at=started_at,
                completed_at=_now(),
                error_message=str(exc),
            )
        )
        raise
    await progress(
        PipelineProgress(
            stage=stage,
            status="complete",
            started_at=started_at,
            completed_at=_now(),
        )
    )
    return result


async def process_case(case: Case, progress_callback: ProgressCallback) -> AARDraft:
    pcr_task = _run_stage(
        PipelineStage.PCR_PARSING,
        lambda: pcr_parser.parse_pcr(case),
        progress_callback,
    )
    video_task = _run_stage(
        PipelineStage.VIDEO_ANALYSIS,
        lambda: video_analyzer.analyze_video(case),
        progress_callback,
    )
    audio_task = _run_stage(
        PipelineStage.AUDIO_ANALYSIS,
        lambda: audio_analyzer.analyze_audio(case),
        progress_callback,
    )
    pcr, video, audio = await asyncio.gather(pcr_task, video_task, audio_task)

    timeline = await _run_stage(
        PipelineStage.RECONCILIATION,
        lambda: reconciliation.reconcile(pcr, video, audio),
        progress_callback,
    )
    checks = await _run_stage(
        PipelineStage.PROTOCOL_CHECK,
        lambda: protocol_check.check_protocol(timeline, case.incident_type),
        progress_callback,
    )
    found = await _run_stage(
        PipelineStage.FINDINGS,
        lambda: findings_stage.generate_findings(timeline, checks),
        progress_callback,
    )
    aar = await _run_stage(
        PipelineStage.DRAFTING,
        lambda: drafting.draft_aar(case, timeline, found, checks),
        progress_callback,
    )
    return aar
