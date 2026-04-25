import json
from pathlib import Path

from app.schemas import AARDraft

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "sample_aar.json"


def test_sample_aar_fixture_validates() -> None:
    raw = json.loads(FIXTURE_PATH.read_text())
    aar = AARDraft.model_validate(raw)

    assert len(aar.timeline) >= 3, "fixture must have at least 3 timeline entries"
    assert len(aar.findings) >= 4, "fixture must have at least 4 findings"
    assert len(aar.protocol_checks) >= 5, "fixture must have at least 5 protocol checks"
