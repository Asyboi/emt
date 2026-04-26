"""PCR Auto-Draft API — three endpoints."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.case_loader import load_case
from app.config import settings
from app.pipeline import audio_analyzer, video_analyzer
from app.pipeline.cad_parser import safe_cad_parse
from app.pipeline.pcr_drafter import draft_pcr
from app.schemas import PCRDraft, PCRDraftStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cases/{case_id}", tags=["pcr-draft"])

DRAFT_FILENAME = "pcr_draft.json"
PCR_FILENAME = "pcr.md"


def _draft_path(case_id: str) -> Path:
    return settings.CASES_DIR / case_id / DRAFT_FILENAME


def _pcr_path(case_id: str) -> Path:
    return settings.CASES_DIR / case_id / PCR_FILENAME


def _load_draft(case_id: str) -> PCRDraft:
    path = _draft_path(case_id)
    if not path.exists():
        raise HTTPException(
            status_code=404, detail="No PCR draft found — POST /pcr-draft first"
        )
    return PCRDraft.model_validate_json(path.read_text())


def _save_draft(draft: PCRDraft) -> None:
    _draft_path(draft.case_id).write_text(draft.model_dump_json(indent=2))


@router.post("/pcr-draft", response_model=PCRDraft)
async def generate_pcr_draft(case_id: str, background_tasks: BackgroundTasks) -> PCRDraft:
    """Trigger PCR auto-generation from video + audio analysis.

    Returns immediately with status=pending_review and a placeholder body.
    Poll GET /pcr-draft until status is populated and draft_markdown is filled.
    """
    try:
        case = load_case(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    pending = PCRDraft(
        case_id=case_id,
        generated_at=datetime.now(timezone.utc),
        status=PCRDraftStatus.PENDING_REVIEW,
        draft_markdown="*Generating PCR draft — please wait...*",
    )
    _save_draft(pending)

    async def _run() -> None:
        try:
            cad_record, video_events, audio_events = await asyncio.gather(
                safe_cad_parse(case.cad_path),
                video_analyzer.analyze_video(case),
                audio_analyzer.analyze_audio(case),
            )
            draft = await draft_pcr(
                case_id=case_id,
                video_events=video_events,
                audio_events=audio_events,
                cad_record=cad_record,
            )
            _save_draft(draft)
            logger.info(
                "PCR draft complete for case %s — %d events, %d unconfirmed",
                case_id,
                draft.total_event_count,
                draft.unconfirmed_count,
            )
        except Exception as exc:
            logger.error("PCR draft failed for case %s: %s", case_id, exc)
            _save_draft(
                PCRDraft(
                    case_id=case_id,
                    generated_at=datetime.now(timezone.utc),
                    status=PCRDraftStatus.PENDING_REVIEW,
                    draft_markdown="*Draft generation failed. Please write PCR manually.*",
                    error=str(exc),
                )
            )

    background_tasks.add_task(_run)
    return pending


@router.get("/pcr-draft", response_model=PCRDraft)
async def get_pcr_draft(case_id: str) -> PCRDraft:
    """Return the current PCR draft. Poll this after POST to check status."""
    return _load_draft(case_id)


class ConfirmRequest(BaseModel):
    edited_markdown: str
    confirmed_by: str = "emt"


@router.patch("/pcr-draft/confirm", response_model=PCRDraft)
async def confirm_pcr_draft(case_id: str, body: ConfirmRequest) -> PCRDraft:
    """EMT confirms the PCR draft.

    Writes the confirmed plain-text PCR to cases/{id}/pcr.md — the file the
    existing pcr_parser (Stage 1a) reads. After this call,
    POST /api/cases/{id}/process will run the QI pipeline against the
    confirmed PCR.
    """
    draft = _load_draft(case_id)

    if draft.error and not body.edited_markdown.strip():
        raise HTTPException(
            status_code=400,
            detail="Draft errored and no edited content provided — regenerate or write manually",
        )

    emt_edits = body.edited_markdown.strip() != draft.draft_markdown.strip()

    _pcr_path(case_id).write_text(body.edited_markdown, encoding="utf-8")

    confirmed = draft.model_copy(
        update={
            "status": PCRDraftStatus.CONFIRMED,
            "draft_markdown": body.edited_markdown,
            "confirmed_by": body.confirmed_by,
            "confirmed_at": datetime.now(timezone.utc),
            "emt_edits_made": emt_edits,
            "unconfirmed_count": body.edited_markdown.count("[UNCONFIRMED]"),
        }
    )
    _save_draft(confirmed)

    logger.info(
        "PCR confirmed for case %s by %s (edits: %s, remaining unconfirmed: %d)",
        case_id,
        body.confirmed_by,
        emt_edits,
        confirmed.unconfirmed_count,
    )
    return confirmed
