"""Pipeline trigger + SSE streaming endpoints."""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.case_loader import load_case
from app.pipeline.orchestrator import process_case
from app.schemas import AARDraft, PipelineProgress

router = APIRouter(tags=["pipeline"])

_jobs: dict[str, asyncio.Task[AARDraft]] = {}

_DONE = object()


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


@router.get("/cases/{case_id}/stream")
async def stream_pipeline(case_id: str) -> EventSourceResponse:
    try:
        case = load_case(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    queue: asyncio.Queue = asyncio.Queue()

    async def push_progress(update: PipelineProgress) -> None:
        await queue.put(update)

    async def runner() -> None:
        try:
            aar = await process_case(case, push_progress)
            await queue.put({"type": "complete", "aar": aar.model_dump(mode="json")})
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
