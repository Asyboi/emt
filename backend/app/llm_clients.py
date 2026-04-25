"""LLM client wrapper stubs.

Phase 2 leaves these unimplemented. Phase 4 fills in `claude_haiku` first,
then Phase 5 fills the rest. Keeping the signatures stable now lets the
pipeline stages import them without churn later.
"""

from __future__ import annotations

from typing import Any


async def claude_haiku(
    messages: list[dict[str, Any]],
    system: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 2048,
) -> dict[str, Any]:
    raise NotImplementedError("claude_haiku is implemented in Phase 4")


async def claude_sonnet(
    messages: list[dict[str, Any]],
    system: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 2048,
) -> dict[str, Any]:
    raise NotImplementedError("claude_sonnet is implemented in Phase 5")


async def gemini_flash_video(video_path: str, prompt: str) -> str:
    raise NotImplementedError("gemini_flash_video is implemented in Phase 5")


async def whisper_transcribe(audio_path: str) -> dict[str, Any]:
    raise NotImplementedError("whisper_transcribe is implemented in Phase 5")
