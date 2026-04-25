"""Call type → protocol family mapping and protocol selection logic."""
from __future__ import annotations

from app.schemas import CADRecord, IncidentDisposition

CALL_TYPE_TO_FAMILY: dict[str, str] = {
    # Cardiac arrest
    "UNC": "cardiac_arrest",
    "CARD": "cardiac_arrest",
    "ARREST": "cardiac_arrest",
    "CPR": "cardiac_arrest",
    "ARREFC": "cardiac_arrest",
    # Stroke
    "CVA": "stroke",
    "CVAC": "stroke",
    # Respiratory
    "DIFFBR": "respiratory",
    "ASTHMA": "respiratory",
    "RESPIR": "respiratory",
    # Altered mental status
    "ALTMEN": "altered_mental_status",
    # Seizure
    "SEIZR": "seizure",
    "STATEP": "seizure",
    # Trauma
    "TRAUMA": "trauma",
    "INJMAJ": "trauma",
    "STAB": "trauma",
    "SHOT": "trauma",
    "MVAINJ": "trauma",
    # Overdose
    "OD": "overdose",
    "DRUG": "overdose",
    "POISON": "overdose",
    # Obstetric
    "LABOR": "obstetric",
    "OBLAB": "obstetric",
    "OBMAJ": "obstetric",
    # Anaphylaxis
    "ANAPH": "anaphylaxis",
    "MEDRXN": "anaphylaxis",
    # General
    "INJURY": "trauma",
    "OTHER": "general",
}

SKIP_DISPOSITIONS = {
    IncidentDisposition.UNFOUNDED,
    IncidentDisposition.GONE_ON_ARRIVAL,
    IncidentDisposition.CANCELLED,
}


def select_protocol_families(cad: CADRecord) -> list[str]:
    """Return list of protocol family strings to load for this incident.
    Returns empty list if incident should skip clinical protocol checks.
    """
    if cad.incident_disposition_code in SKIP_DISPOSITIONS:
        return []
    family = CALL_TYPE_TO_FAMILY.get(cad.final_call_type, "general")
    return [family]
