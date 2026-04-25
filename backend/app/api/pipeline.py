"""Pipeline trigger + SSE streaming endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from app.case_loader import load_case, load_cached_review, save_cached_review
from app.pipeline.orchestrator import process_case
from app.schemas import PipelineProgress, PipelineStage, QICaseReview

logger = logging.getLogger(__name__)

router = APIRouter(tags=["pipeline"])

_jobs: dict[str, asyncio.Task[QICaseReview]] = {}

_DONE = object()

_DEMO_STAGE_DELAY_S = 0.4
_DEMO_STAGES: tuple[PipelineStage, ...] = (
    PipelineStage.PCR_PARSING,
    PipelineStage.VIDEO_ANALYSIS,
    PipelineStage.AUDIO_ANALYSIS,
    PipelineStage.RECONCILIATION,
    PipelineStage.PROTOCOL_CHECK,
    PipelineStage.FINDINGS,
    PipelineStage.DRAFTING,
)


@router.post("/cases/{case_id}/process")
async def trigger_process(case_id: str) -> dict[str, str]:
    try:
        case = load_case(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    job_id = str(uuid.uuid4())

    async def _noop_progress(_: PipelineProgress) -> None:
        return None

    task = asyncio.create_task(process_case(case, _noop_progress))
    _jobs[job_id] = task
    return {"job_id": job_id, "case_id": case_id}


async def _demo_stream(case_id: str) -> AsyncIterator[dict]:
    """Replay a synthetic pipeline using the cached QI Case Review.

    Demo-mode short-circuit: emit running/complete progress events for each
    stage with small delays for visual effect, then deliver the cached
    review. Used when the backend can't run the live pipeline (no API keys,
    flaky network) but we still want the streaming UI to look real.
    """

    cached = load_cached_review(case_id)
    if cached is None:
        yield {
            "event": "error",
            "data": json.dumps(
                {
                    "type": "error",
                    "message": f"No cached review available for {case_id}",
                }
            ),
        }
        return

    for stage in _DEMO_STAGES:
        started = datetime.now(timezone.utc)
        yield {
            "event": "progress",
            "data": PipelineProgress(
                stage=stage,
                status="running",
                started_at=started,
            ).model_dump_json(),
        }
        await asyncio.sleep(_DEMO_STAGE_DELAY_S)
        yield {
            "event": "progress",
            "data": PipelineProgress(
                stage=stage,
                status="complete",
                started_at=started,
                completed_at=datetime.now(timezone.utc),
            ).model_dump_json(),
        }

    yield {
        "event": "complete",
        "data": json.dumps(
            {"type": "complete", "review": cached.model_dump(mode="json")}
        ),
    }


@router.get("/cases/{case_id}/stream")
async def stream_pipeline(
    case_id: str,
    demo: bool = Query(False, description="Replay the cached AAR instead of running the live pipeline."),
) -> EventSourceResponse:
    try:
        case = load_case(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    if demo:
        return EventSourceResponse(_demo_stream(case_id))

    queue: asyncio.Queue = asyncio.Queue()

    async def push_progress(update: PipelineProgress) -> None:
        await queue.put(update)

    async def runner() -> None:
        try:
            review = await process_case(case, push_progress)
            try:
                save_cached_review(case_id, review)
            except Exception as cache_exc:  # noqa: BLE001
                logger.warning("Failed to cache review for %s: %s", case_id, cache_exc)
            await queue.put({"type": "complete", "review": review.model_dump(mode="json")})
        except Exception as exc:  # noqa: BLE001
            await queue.put({"type": "error", "message": str(exc)})
        finally:
            await queue.put(_DONE)

    async def event_source() -> AsyncIterator[dict]:
        task = asyncio.create_task(runner())
        try:
            while True:
                item = await queue.get()
                if item is _DONE:
                    break
                if isinstance(item, PipelineProgress):
                    yield {
                        "event": "progress",
                        "data": item.model_dump_json(),
                    }
                else:
                    yield {
                        "event": item.get("type", "message"),
                        "data": json.dumps(item),
                    }
        finally:
            if not task.done():
                task.cancel()

    return EventSourceResponse(event_source())
