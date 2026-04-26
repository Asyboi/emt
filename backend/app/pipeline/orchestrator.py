"""Top-level pipeline orchestrator.

Runs the seven pipeline stages — 1a/1b/1c (PCR / video / audio) in
parallel via asyncio.gather, then 2-5 sequentially — emitting a
PipelineProgress event for each `running` and `complete` transition so
the SSE stream and CLI can render live progress. The drafting stage
now produces a `QICaseReview` (per Step 2 of the QI Case Review
update); the previous `AARDraft` shape is retired.

Demo mode: if `cases/<id>/upstream_cache.json` is present and
`use_upstream_cache=True`, the four upstream stages (CAD/PCR/video/audio)
are replayed from cache with a small visual delay so the SSE UI still
renders progress, while the four downstream agentic stages run live.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from app.case_loader import load_pcr_content
from app.pipeline import (
    audio_analyzer,
    drafting,
    findings as findings_stage,
    pcr_parser,
    protocol_check,
    reconciliation,
    video_analyzer,
)
from app.pipeline.cad_parser import safe_cad_parse
from app.schemas import (
    Case,
    PipelineProgress,
    PipelineStage,
    QICaseReview,
)
from app.upstream_cache import UpstreamCache, load_upstream_cache

ProgressCallback = Callable[[PipelineProgress], Awaitable[None]]

# Visual delay when replaying a cached upstream stage so the UI still
# shows the running → complete transition for a moment.
_CACHE_REPLAY_DELAY_S = 0.3


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


async def _replay_cached_stage(stage: PipelineStage, value, progress: ProgressCallback):
    async def factory():
        await asyncio.sleep(_CACHE_REPLAY_DELAY_S)
        return value

    return await _run_stage(stage, factory, progress)


async def process_case(
    case: Case,
    progress_callback: ProgressCallback,
    *,
    use_upstream_cache: bool = True,
) -> QICaseReview:
    cache: UpstreamCache | None = (
        load_upstream_cache(case.case_id) if use_upstream_cache else None
    )

    if cache is not None:
        cad_task = _replay_cached_stage(
            PipelineStage.CAD_PARSING, cache.cad_record, progress_callback
        )
        pcr_task = _replay_cached_stage(
            PipelineStage.PCR_PARSING, cache.pcr_events, progress_callback
        )
        video_task = _replay_cached_stage(
            PipelineStage.VIDEO_ANALYSIS, cache.video_events, progress_callback
        )
        audio_task = _replay_cached_stage(
            PipelineStage.AUDIO_ANALYSIS, cache.audio_events, progress_callback
        )
    else:
        cad_task = _run_stage(
            PipelineStage.CAD_PARSING,
            lambda: safe_cad_parse(case.cad_path),
            progress_callback,
        )
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

    cad_record, pcr, video, audio = await asyncio.gather(
        cad_task, pcr_task, video_task, audio_task
    )

    # Select protocol families from CAD — fall back to cardiac_arrest for demo
    protocol_families = (
        cad_record.protocol_families
        if cad_record and cad_record.protocol_families
        else ["cardiac_arrest"]
    )

    timeline = await _run_stage(
        PipelineStage.RECONCILIATION,
        lambda: reconciliation.reconcile(pcr, video, audio, cad_record=cad_record),
        progress_callback,
    )
    checks = await _run_stage(
        PipelineStage.PROTOCOL_CHECK,
        lambda: protocol_check.check_protocol(timeline, protocol_families[0]),
        progress_callback,
    )
    found = await _run_stage(
        PipelineStage.FINDINGS,
        lambda: findings_stage.generate_findings(timeline, checks),
        progress_callback,
    )

    pcr_content = load_pcr_content(case.case_id)
    review = await _run_stage(
        PipelineStage.DRAFTING,
        lambda: drafting.draft_qi_review(case, timeline, found, checks, pcr_content),
        progress_callback,
    )
    review.cad_record = cad_record
    return review
