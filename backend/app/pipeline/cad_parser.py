"""CAD ingestion — parses NYC EMS CAD JSON into a CADRecord.

No LLM used. Pure Pydantic + datetime parsing + zipcode centroid geocoding.
Fails gracefully — caller wraps in safe_cad_parse() which returns None on error.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

from app.pipeline.protocols import select_protocol_families
from app.schemas import CADRecord, GeoPoint, IncidentDisposition

logger = logging.getLogger(__name__)

# Zipcode centroid fallback — extend as needed for demo cases
ZIPCODE_CENTROIDS: dict[str, GeoPoint] = {
    "10002": GeoPoint(lat=40.7157, lng=-73.9863),  # Chinatown / LES
    "10001": GeoPoint(lat=40.7484, lng=-73.9967),  # Chelsea
    "10003": GeoPoint(lat=40.7317, lng=-73.9892),  # East Village
    "10007": GeoPoint(lat=40.7135, lng=-74.0079),  # Tribeca
    "10036": GeoPoint(lat=40.7580, lng=-73.9855),  # Midtown
}


def _parse_dt(value: str) -> datetime:
    """Parse ISO datetime string. Strips trailing .000 microseconds if present."""
    return datetime.fromisoformat(value.replace(".000", ""))


def _parse_optional_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return _parse_dt(value)
    except (ValueError, AttributeError):
        return None


def _parse_optional_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def parse_cad(path: str) -> CADRecord:
    """Parse a CAD JSON file into a CADRecord.

    Expects NYC EMS CAD format (from data.cityofnewyork.us/resource/76xm-jjuj).
    Raises ValueError or KeyError on malformed input.
    """
    with open(path) as f:
        raw = json.load(f)

    # Handle both single-record dicts and single-element arrays
    if isinstance(raw, list):
        raw = raw[0]

    zipcode = raw.get("zipcode") or raw.get("zip_code")
    location = ZIPCODE_CENTROIDS.get(zipcode or "")

    disposition_code = raw.get("incident_disposition_code", "99")
    try:
        disposition = IncidentDisposition(str(disposition_code))
    except ValueError:
        disposition = IncidentDisposition.UNKNOWN

    record = CADRecord(
        cad_incident_id=str(raw["cad_incident_id"]),
        incident_datetime=_parse_dt(raw["incident_datetime"]),
        initial_call_type=raw["initial_call_type"],
        initial_severity_level_code=int(raw["initial_severity_level_code"]),
        final_call_type=raw["final_call_type"],
        final_severity_level_code=int(raw["final_severity_level_code"]),
        first_assignment_datetime=_parse_dt(raw["first_assignment_datetime"]),
        first_activation_datetime=_parse_dt(raw["first_activation_datetime"]),
        first_on_scene_datetime=_parse_dt(raw["first_on_scene_datetime"]),
        first_to_hosp_datetime=_parse_optional_dt(raw.get("first_to_hosp_datetime")),
        first_hosp_arrival_datetime=_parse_optional_dt(
            raw.get("first_hosp_arrival_datetime")
        ),
        incident_close_datetime=_parse_dt(raw["incident_close_datetime"]),
        dispatch_response_seconds=_parse_optional_int(
            raw.get("dispatch_response_seconds_qy")
        ),
        incident_response_seconds=_parse_optional_int(
            raw.get("incident_response_seconds_qy")
        ),
        incident_travel_seconds=_parse_optional_int(
            raw.get("incident_travel_tm_seconds_qy")
        ),
        incident_disposition_code=disposition,
        borough=raw.get("borough"),
        zipcode=zipcode,
        incident_location=location,
    )

    record.protocol_families = select_protocol_families(record)
    return record


async def safe_cad_parse(path: Optional[str]) -> Optional[CADRecord]:
    """Non-blocking wrapper — returns None if path is missing or parse fails.
    Pipeline continues without CAD data rather than hard-failing.
    """
    if not path:
        return None
    try:
        return parse_cad(path)
    except Exception as exc:
        logger.warning("CAD parsing failed for %s: %s", path, exc)
        return None
