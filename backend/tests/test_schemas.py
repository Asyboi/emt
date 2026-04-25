import json
from pathlib import Path

from app.schemas import QICaseReview

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "sample_qi_review.json"


def test_sample_qi_review_fixture_validates() -> None:
    raw = json.loads(FIXTURE_PATH.read_text())
    review = QICaseReview.model_validate(raw)

    assert len(review.timeline) >= 3, "fixture must have at least 3 timeline entries"
    assert len(review.findings) >= 4, "fixture must have at least 4 findings"
    assert len(review.protocol_checks) >= 5, "fixture must have at least 5 protocol checks"
    assert len(review.clinical_assessment) >= 8, (
        "fixture must have at least 8 clinical assessment items"
    )
    assert len(review.recommendations) >= 3, (
        "fixture must have at least 3 recommendations"
    )
    assert review.utstein_data is not None, "fixture must include utstein_data"
    assert review.utstein_data.rosc_achieved is True, "fixture utstein_data must have rosc_achieved=True"
    assert review.determination.value == "performance_concern", (
        "fixture determination must be performance_concern"
    )
