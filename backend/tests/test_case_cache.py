"""Cache + clear endpoints (formerly Phase 6 AAR caching).

Step 2 of the QI Case Review update swaps AARDraft → QICaseReview but
keeps the on-disk filename and HTTP path (/aar) stable; Step 3 of the
same update will rename them to /review and review.json.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import case_loader
from app.config import settings
from app.main import app
from app.schemas import QICaseReview


FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "sample_qi_review.json"


@pytest.fixture
def isolated_cases(tmp_path, monkeypatch):
    """Point CASES_DIR at a tmp dir with one synthetic case directory."""
    case_dir = tmp_path / "case_test"
    case_dir.mkdir()
    monkeypatch.setattr(settings, "CASES_DIR", tmp_path)
    return tmp_path, case_dir


def _sample_review() -> QICaseReview:
    raw = json.loads(FIXTURE.read_text())
    raw["case_id"] = "case_test"
    review = QICaseReview.model_validate(raw)
    review.generated_at = datetime.now(timezone.utc)
    return review


def test_save_and_load_cached_review_roundtrip(isolated_cases) -> None:
    _, case_dir = isolated_cases
    review = _sample_review()

    case_loader.save_cached_aar("case_test", review)
    written = case_dir / "aar.json"
    assert written.exists()

    loaded = case_loader.load_cached_aar("case_test")
    assert loaded is not None
    assert loaded.case_id == "case_test"
    assert len(loaded.findings) == len(review.findings)
    assert len(loaded.clinical_assessment) == len(review.clinical_assessment)
    assert loaded.determination == review.determination


def test_clear_cached_review_removes_file(isolated_cases) -> None:
    _, case_dir = isolated_cases
    case_loader.save_cached_aar("case_test", _sample_review())
    assert (case_dir / "aar.json").exists()

    removed = case_loader.clear_cached_aar("case_test")
    assert removed is True
    assert not (case_dir / "aar.json").exists()

    # Second call returns False (idempotent).
    assert case_loader.clear_cached_aar("case_test") is False


def test_clear_cached_review_404_when_case_missing(isolated_cases) -> None:
    with pytest.raises(FileNotFoundError):
        case_loader.clear_cached_aar("case_does_not_exist")


def test_delete_review_endpoint(isolated_cases) -> None:
    case_loader.save_cached_aar("case_test", _sample_review())
    client = TestClient(app)

    res = client.delete("/api/cases/case_test/aar")
    assert res.status_code == 204

    res2 = client.get("/api/cases/case_test/aar")
    assert res2.status_code == 404


def test_demo_stream_replays_cached_review(isolated_cases) -> None:
    case_loader.save_cached_aar("case_test", _sample_review())
    client = TestClient(app)

    with client.stream("GET", "/api/cases/case_test/stream?demo=1") as res:
        assert res.status_code == 200
        body = b"".join(res.iter_bytes()).decode()

    # 7 stages, each emits running + complete = 14 progress events; plus 1 complete.
    assert body.count("event: progress") == 14
    assert body.count("event: complete") == 1
    assert "case_test" in body
