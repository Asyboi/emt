"""Case management endpoints."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.case_loader import (
    clear_cached_review,
    list_cases,
    load_case,
    load_cached_review,
    load_pcr_content,
    next_case_id,
)
from app.config import settings
from app.schemas import Case, QICaseReview

router = APIRouter(tags=["cases"])

EPCR_ALLOWED_EXTS = {"pdf", "xml"}


@router.get("/cases", response_model=list[Case])
async def get_cases() -> list[Case]:
    return list_cases()


AUDIO_ALLOWED_EXTS = {"mp3", "wav", "m4a"}


@router.post("/cases", response_model=Case, status_code=201)
async def create_case(
    epcr: UploadFile | None = File(None),
    title: str | None = Form(None),
    cad: UploadFile | None = File(None),
    audio: UploadFile | None = File(None),
    videos: list[UploadFile] | None = File(None),
) -> Case:
    """Create a new case from uploaded files.

    All uploads are optional so this endpoint serves both flows:
    the QI Review page (which uploads an ePCR) and the PCR Auto-Draft
    page (which uploads only video/audio/CAD and lets the AI draft the PCR).
    At least one of epcr/video/audio/cad must be provided.
    """
    if epcr is None and not videos and audio is None and cad is None:
        raise HTTPException(
            status_code=400,
            detail="At least one of epcr, audio, video, or cad must be provided.",
        )

    ext: str | None = None
    if epcr is not None:
        epcr_filename = epcr.filename or "pcr_source"
        ext = Path(epcr_filename).suffix.lower().lstrip(".")
        if ext not in EPCR_ALLOWED_EXTS:
            raise HTTPException(
                status_code=400,
                detail=f"ePCR must be a .pdf or .xml file (got '.{ext}')",
            )

    audio_ext: str | None = None
    if audio is not None:
        audio_filename = audio.filename or "audio"
        audio_ext = Path(audio_filename).suffix.lower().lstrip(".")
        if audio_ext not in AUDIO_ALLOWED_EXTS:
            raise HTTPException(
                status_code=400,
                detail=f"Audio must be one of {sorted(AUDIO_ALLOWED_EXTS)} (got '.{audio_ext}')",
            )

    case_id = next_case_id()
    case_dir = settings.CASES_DIR.resolve() / case_id
    case_dir.mkdir(parents=True, exist_ok=False)

    if epcr is not None and ext is not None:
        (case_dir / f"pcr_source.{ext}").write_bytes(await epcr.read())
        (case_dir / "pcr.md").write_text(
            f"# ePCR\n\nSource file: {epcr.filename or 'pcr_source'}\n\n[PCR content to be extracted]\n",
            encoding="utf-8",
        )

    if cad is not None:
        (case_dir / "cad.json").write_bytes(await cad.read())

    if audio is not None and audio_ext is not None:
        (case_dir / f"audio.{audio_ext}").write_bytes(await audio.read())

    if videos:
        first_video = videos[0]
        (case_dir / "video.mp4").write_bytes(await first_video.read())

    if title:
        (case_dir / "metadata.json").write_text(
            json.dumps({"title": title}, indent=2),
            encoding="utf-8",
        )

    return load_case(case_id)


@router.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: str) -> Case:
    try:
        return load_case(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/cases/{case_id}/pcr")
async def get_pcr(case_id: str) -> dict[str, str]:
    try:
        content = load_pcr_content(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"content": content}


@router.get("/cases/{case_id}/review", response_model=QICaseReview)
async def get_review(case_id: str) -> QICaseReview:
    review = load_cached_review(case_id)
    if review is None:
        raise HTTPException(status_code=404, detail=f"No cached review for {case_id}")
    return review


@router.delete("/cases/{case_id}/review", status_code=204)
async def delete_review(case_id: str) -> None:
    try:
        clear_cached_review(case_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/cases/{case_id}/video")
async def get_video(case_id: str) -> FileResponse:
    case_dir: Path = settings.CASES_DIR.resolve() / case_id
    if not case_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    for candidate in ("video.mp4", "video.mov", "video.webm"):
        video_path = case_dir / candidate
        if video_path.exists():
            return FileResponse(video_path, media_type="video/mp4")
    raise HTTPException(status_code=404, detail=f"No video for {case_id}")
