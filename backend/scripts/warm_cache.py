"""CLI: pre-warm the upstream-stage cache for a case.

Runs the four slow upstream pipeline stages (CAD parse, PCR parse,
Gemini video analysis, ElevenLabs audio transcription) against the
case media and saves the results to `cases/<id>/upstream_cache.json`.
After warming, the live SSE stream replays these stages instantly and
only the four downstream agentic stages (reconciliation → protocol
check → findings → drafting) hit the LLM during the demo.

Usage (from backend/):
    uv run python scripts/warm_cache.py case_01
    uv run python scripts/warm_cache.py case_01 --force
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.case_loader import load_case  # noqa: E402
from app.pipeline import audio_analyzer, pcr_parser, video_analyzer  # noqa: E402
from app.pipeline.cad_parser import safe_cad_parse  # noqa: E402
from app.upstream_cache import (  # noqa: E402
    UpstreamCache,
    load_upstream_cache,
    save_upstream_cache,
)


async def _warm(case_id: str, force: bool) -> int:
    try:
        case = load_case(case_id)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if not force and load_upstream_cache(case_id) is not None:
        print(
            f"upstream_cache.json already exists for {case_id}; pass --force to rebuild."
        )
        return 0

    print(f"Warming upstream cache for {case.case_id}...")

    cad_task = safe_cad_parse(case.cad_path)
    pcr_task = pcr_parser.parse_pcr(case)
    video_task = video_analyzer.analyze_video(case)
    audio_task = audio_analyzer.analyze_audio(case)

    cad_record, pcr_events, video_events, audio_events = await asyncio.gather(
        cad_task, pcr_task, video_task, audio_task
    )

    cache = UpstreamCache(
        pcr_events=pcr_events,
        video_events=video_events,
        audio_events=audio_events,
        cad_record=cad_record,
    )
    path = save_upstream_cache(case_id, cache)

    print(f"  pcr_events   : {len(cache.pcr_events)}")
    print(f"  video_events : {len(cache.video_events)}")
    print(f"  audio_events : {len(cache.audio_events)}")
    print(f"  cad_record   : {'present' if cache.cad_record else 'absent'}")
    print(f"Wrote {path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Pre-warm the upstream-stage cache for a case."
    )
    parser.add_argument("case_id", help="Case directory under cases/, e.g. case_01")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild the cache even if upstream_cache.json already exists.",
    )
    args = parser.parse_args()
    return asyncio.run(_warm(args.case_id, args.force))


if __name__ == "__main__":
    raise SystemExit(main())
