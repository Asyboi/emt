"""Case management endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.case_loader import (
    clear_cached_aar,
    list_cases,
    load_case,
    load_cached_aar,
    load_pcr_content,
)
from app.config import settings
from app.schemas import AARDraft, Case

router = APIRouter(tags=["cases"])


@router.get("/cases", response_model=list[Case])
async def get_cases() -> list[Case]:
    return list_cases()


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


@router.get("/cases/{case_id}/aar", response_model=AARDraft)
async def get_aar(case_id: str) -> AARDraft:
    aar = load_cached_aar(case_id)
    if aar is None:
        raise HTTPException(status_code=404, detail=f"No cached AAR for {case_id}")
    return aar


@router.delete("/cases/{case_id}/aar", status_code=204)
async def delete_aar(case_id: str) -> None:
    try:
        clear_cached_aar(case_id)
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
