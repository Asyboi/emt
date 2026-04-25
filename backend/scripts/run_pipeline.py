"""CLI runner: end-to-end pipeline against a case directory.

Usage (from backend/):
    uv run python scripts/run_pipeline.py case_01
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

# Make `app` importable when running this file directly.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.case_loader import load_case  # noqa: E402
from app.pipeline.orchestrator import process_case  # noqa: E402
from app.schemas import PipelineProgress  # noqa: E402


async def _print_progress(update: PipelineProgress) -> None:
    if update.status == "complete":
        marker = "OK"
    elif update.status == "error":
        marker = "ERR"
    else:
        marker = "..."
    print(f"  [{marker}] {update.stage.value:<18} {update.status}")


async def _run(case_id: str) -> int:
    try:
        case = load_case(case_id)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"Running pipeline for {case.case_id} ({case.incident_type})")
    aar = await process_case(case, _print_progress)
    print()
    print(json.dumps(aar.model_dump(mode="json"), indent=2, default=str))
    return 0


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: run_pipeline.py <case_id>", file=sys.stderr)
        return 2
    return asyncio.run(_run(sys.argv[1]))


if __name__ == "__main__":
    raise SystemExit(main())
