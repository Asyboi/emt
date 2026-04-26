"""POST /api/cases — case creation from uploaded files (wiring Step 1a)."""

from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient

from app import case_loader
from app.config import settings
from app.main import app


@pytest.fixture
def isolated_cases(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "CASES_DIR", tmp_path)
    return tmp_path


def test_next_case_id_increments_past_existing(isolated_cases) -> None:
    (isolated_cases / "case_01").mkdir()
    (isolated_cases / "case_03").mkdir()
    (isolated_cases / "not_a_case").mkdir()

    assert case_loader.next_case_id() == "case_04"


def test_next_case_id_starts_at_one_when_empty(isolated_cases) -> None:
    assert case_loader.next_case_id() == "case_01"


def test_post_cases_creates_case_dir_and_files(isolated_cases) -> None:
    client = TestClient(app)
    pcr_bytes = b"%PDF-1.4 fake pdf bytes"
    cad_bytes = b'{"call_id": "X1"}'
    video_bytes = b"\x00\x00\x00\x18ftypmp42"  # mp4 magic-ish

    res = client.post(
        "/api/cases",
        data={"title": "Test Run"},
        files=[
            ("epcr", ("source.pdf", io.BytesIO(pcr_bytes), "application/pdf")),
            ("cad", ("dispatch.json", io.BytesIO(cad_bytes), "application/json")),
            ("videos", ("a.mp4", io.BytesIO(video_bytes), "video/mp4")),
        ],
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["case_id"] == "case_01"
    assert body["metadata"] == {"title": "Test Run"}

    case_dir = isolated_cases / "case_01"
    assert (case_dir / "pcr_source.pdf").read_bytes() == pcr_bytes
    assert (case_dir / "cad.json").read_bytes() == cad_bytes
    assert (case_dir / "video.mp4").read_bytes() == video_bytes
    assert (case_dir / "pcr.md").exists()
    assert "source.pdf" in (case_dir / "pcr.md").read_text()
    assert json.loads((case_dir / "metadata.json").read_text()) == {"title": "Test Run"}


def test_post_cases_rejects_non_pdf_xml(isolated_cases) -> None:
    client = TestClient(app)
    res = client.post(
        "/api/cases",
        files={"epcr": ("note.txt", io.BytesIO(b"hi"), "text/plain")},
    )
    assert res.status_code == 400
    assert ".txt" in res.json()["detail"]


def test_post_cases_minimal_request_no_optional_files(isolated_cases) -> None:
    client = TestClient(app)
    res = client.post(
        "/api/cases",
        files={"epcr": ("p.xml", io.BytesIO(b"<xml/>"), "application/xml")},
    )
    assert res.status_code == 201, res.text
    assert res.json()["case_id"] == "case_01"
    case_dir = isolated_cases / "case_01"
    assert (case_dir / "pcr_source.xml").exists()
    assert not (case_dir / "cad.json").exists()
    assert not (case_dir / "video.mp4").exists()
    assert not (case_dir / "metadata.json").exists()
