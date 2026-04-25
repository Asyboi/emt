"""CLI runner: end-to-end pipeline against a case directory.

Usage (from backend/):
    uv run python scripts/run_pipeline.py case_01
    uv run python scripts/run_pipeline.py case_01 --summary
"""

from __future__ import annotations

import argparse
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
from app.schemas import PipelineProgress, QICaseReview  # noqa: E402


async def _print_progress(update: PipelineProgress) -> None:
    if update.status == "complete":
        marker = "OK"
    elif update.status == "error":
        marker = "ERR"
    else:
        marker = "..."
    print(f"  [{marker}] {update.stage.value:<18} {update.status}")


def _print_summary(review: QICaseReview) -> None:
    print()
    print(f"determination       : {review.determination.value}")
    print(f"adherence_score     : {review.adherence_score:.2f}")
    print(f"findings            : {len(review.findings)}")
    print(f"clinical_assessment : {len(review.clinical_assessment)}")
    print(f"recommendations     : {len(review.recommendations)}")
    print(f"timeline_entries    : {len(review.timeline)}")
    print()
    print("incident_summary:")
    for line in review.incident_summary.splitlines():
        print(f"  {line}")
    print()
    print("determination_rationale:")
    for line in review.determination_rationale.splitlines():
        print(f"  {line}")


async def _run(case_id: str, summary_only: bool) -> int:
    try:
        case = load_case(case_id)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"Running pipeline for {case.case_id} ({case.incident_type})")
    review = await process_case(case, _print_progress)
    if summary_only:
        _print_summary(review)
    else:
        print()
        print(json.dumps(review.model_dump(mode="json"), indent=2, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the Sentinel pipeline against a case.")
    parser.add_argument("case_id", help="Case directory under cases/, e.g. case_01")
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print only determination + adherence + counts + summary (skip full JSON).",
    )
    args = parser.parse_args()
    return asyncio.run(_run(args.case_id, args.summary))


if __name__ == "__main__":
    raise SystemExit(main())
