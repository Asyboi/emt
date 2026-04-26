"""LLM + media client wrappers.

Phase 4 wired `claude_haiku`. Phase 5 added `claude_sonnet` and now
brings up `elevenlabs_transcribe` (audio) and `gemini_pro_video`
(video). Each wrapper is the thinnest possible adapter — retries +
returning a plain dict — so pipeline stages stay readable.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import httpx
from anthropic import AsyncAnthropic
from tenacity import retry, stop_after_attempt, wait_random_exponential

from app.config import settings

_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


@retry(stop=stop_after_attempt(5), wait=wait_random_exponential(min=2, max=30))
async def claude_haiku(
    messages: list[dict[str, Any]],
    system: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 2048,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system is not None:
        kwargs["system"] = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
    if tools is not None:
        kwargs["tools"] = tools
    response = await _client.messages.create(**kwargs)
    return response.model_dump()


@retry(stop=stop_after_attempt(5), wait=wait_random_exponential(min=2, max=30))
async def claude_sonnet(
    messages: list[dict[str, Any]],
    system: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 4096,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system is not None:
        kwargs["system"] = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
    if tools is not None:
        kwargs["tools"] = tools
    response = await _client.messages.create(**kwargs)
    return response.model_dump()


@retry(stop=stop_after_attempt(5), wait=wait_random_exponential(min=2, max=30))
async def elevenlabs_transcribe(audio_path: str) -> dict[str, Any]:
    """Transcribe an audio file with ElevenLabs Scribe v1.

    Returns the raw JSON payload from the API. Callers downstream care
    about ``text`` (full transcript) and ``words`` (per-token timing
    with ``start`` and ``end`` floats in seconds plus a ``type`` field).
    """

    if not settings.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(audio_path)

    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {"xi-api-key": settings.ELEVENLABS_API_KEY}
    data = {
        "model_id": "scribe_v1",
        "timestamps_granularity": "word",
        "tag_audio_events": "false",
        "diarize": "false",
    }
    with path.open("rb") as fh:
        files = {"file": (path.name, fh, "application/octet-stream")}
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            response = await client.post(url, headers=headers, data=data, files=files)
    response.raise_for_status()
    return response.json()


async def gemini_pro_video(
    video_path: str,
    prompt: str,
    tool: dict[str, Any],
    system: str | None = None,
) -> dict[str, Any]:
    """Send a video file to Gemini 2.5 Pro with a structured-output tool.

    The video is uploaded via the File API, polled until ACTIVE, and
    then attached to a generate_content call constrained to the
    supplied tool (function declaration) so callers get parsed
    structured output. Returns the function call args as a plain dict.
    """

    if not settings.GOOGLE_API_KEY:
        raise RuntimeError("GOOGLE_API_KEY is not configured")

    path = Path(video_path)
    if not path.exists():
        raise FileNotFoundError(video_path)

    import google.generativeai as genai

    genai.configure(api_key=settings.GOOGLE_API_KEY)

    upload = await asyncio.to_thread(genai.upload_file, str(path))
    while upload.state.name == "PROCESSING":
        await asyncio.sleep(2)
        upload = await asyncio.to_thread(genai.get_file, upload.name)

    if upload.state.name != "ACTIVE":
        raise RuntimeError(f"Gemini File API upload failed: state={upload.state.name}")

    function_declaration = {
        "name": tool["name"],
        "description": tool.get("description", ""),
        "parameters": tool["input_schema"],
    }
    model = genai.GenerativeModel(
        model_name="gemini-2.5-pro",
        system_instruction=system,
        tools=[{"function_declarations": [function_declaration]}],
        tool_config={"function_calling_config": {"mode": "ANY", "allowed_function_names": [tool["name"]]}},
    )

    response = await asyncio.to_thread(
        model.generate_content,
        [upload, prompt],
    )

    for candidate in response.candidates:
        for part in candidate.content.parts:
            fc = getattr(part, "function_call", None)
            if fc and fc.name == tool["name"]:
                return _proto_to_dict(fc.args)

    raise RuntimeError("Gemini did not return a function_call for video event extraction")


def _proto_to_dict(value: Any) -> Any:
    """Convert a Gemini proto MapComposite/ListValue tree into plain Python."""

    if hasattr(value, "items") and callable(value.items):
        return {k: _proto_to_dict(v) for k, v in value.items()}
    if isinstance(value, str) or isinstance(value, (int, float, bool)) or value is None:
        return value
    try:
        iter(value)
    except TypeError:
        return value
    return [_proto_to_dict(v) for v in value]
