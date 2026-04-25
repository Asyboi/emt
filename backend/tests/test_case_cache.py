"""Cache + clear endpoints (formerly Phase 6 AAR caching).

Step 3 of the QI Case Review update renames the on-disk file to
review.json, the HTTP endpoint to /review, the cache helpers to
load_cached_review / save_cached_review / clear_cached_review, and
the SSE final-event key to "review". Includes a migration test for
legacy aar.json files left over from before the rename.
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

    case_loader.save_cached_review("case_test", review)
    written = case_dir / "review.json"
    assert written.exists()

    loaded = case_loader.load_cached_review("case_test")
    assert loaded is not None
    assert loaded.case_id == "case_test"
    assert len(loaded.findings) == len(review.findings)
    assert len(loaded.clinical_assessment) == len(review.clinical_assessment)
    assert loaded.determination == review.determination


def test_clear_cached_review_removes_file(isolated_cases) -> None:
    _, case_dir = isolated_cases
    case_loader.save_cached_review("case_test", _sample_review())
    assert (case_dir / "review.json").exists()

    removed = case_loader.clear_cached_review("case_test")
    assert removed is True
    assert not (case_dir / "review.json").exists()

    # Second call returns False (idempotent).
    assert case_loader.clear_cached_review("case_test") is False


def test_clear_cached_review_404_when_case_missing(isolated_cases) -> None:
    with pytest.raises(FileNotFoundError):
        case_loader.clear_cached_review("case_does_not_exist")


def test_delete_review_endpoint(isolated_cases) -> None:
    case_loader.save_cached_review("case_test", _sample_review())
    client = TestClient(app)

    res = client.delete("/api/cases/case_test/review")
    assert res.status_code == 204

    res2 = client.get("/api/cases/case_test/review")
    assert res2.status_code == 404


def test_demo_stream_replays_cached_review(isolated_cases) -> None:
    case_loader.save_cached_review("case_test", _sample_review())
    client = TestClient(app)

    with client.stream("GET", "/api/cases/case_test/stream?demo=1") as res:
        assert res.status_code == 200
        body = b"".join(res.iter_bytes()).decode()

    # 7 stages, each emits running + complete = 14 progress events; plus 1 complete.
    assert body.count("event: progress") == 14
    assert body.count("event: complete") == 1
    assert "case_test" in body
    # Final complete event now uses "review" key, not "aar".
    assert '"review":' in body
    assert '"aar":' not in body


def test_migration_renames_legacy_aar_to_review(isolated_cases, tmp_path) -> None:
    """A pre-existing aar.json from a previous version should be renamed."""

    legacy_a = tmp_path / "case_test" / "aar.json"
    legacy_a.write_text(_sample_review().model_dump_json(indent=2))

    legacy_b_dir = tmp_path / "case_legacy_b"
    legacy_b_dir.mkdir()
    legacy_b = legacy_b_dir / "aar.json"
    legacy_b.write_text(_sample_review().model_dump_json(indent=2))

    migrated = case_loader.migrate_legacy_aar_caches()

    assert migrated == 2
    assert not legacy_a.exists()
    assert (tmp_path / "case_test" / "review.json").exists()
    assert not legacy_b.exists()
    assert (legacy_b_dir / "review.json").exists()


def test_migration_skips_when_review_already_present(isolated_cases, tmp_path) -> None:
    """If review.json already exists, leave the legacy aar.json alone."""

    case_dir = tmp_path / "case_test"
    legacy = case_dir / "aar.json"
    legacy.write_text(_sample_review().model_dump_json(indent=2))
    new = case_dir / "review.json"
    new.write_text(_sample_review().model_dump_json(indent=2))

    migrated = case_loader.migrate_legacy_aar_caches()

    assert migrated == 0
    assert legacy.exists()
    assert new.exists()


def test_migration_discards_incompatible_legacy_aar(isolated_cases, tmp_path) -> None:
    """A legacy aar.json that doesn't validate as QICaseReview is removed."""

    case_dir = tmp_path / "case_test"
    legacy = case_dir / "aar.json"
    # Legacy AARDraft-shape file: lacks all the new QI fields.
    legacy.write_text(json.dumps({"case_id": "case_test", "summary": "old shape"}))

    migrated = case_loader.migrate_legacy_aar_caches()

    assert migrated == 0
    assert not legacy.exists(), "incompatible legacy file should be deleted"
    assert not (case_dir / "review.json").exists(), "no review.json should be created"
