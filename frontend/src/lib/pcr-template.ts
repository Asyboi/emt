// Mirrors the section structure of `backend/app/prompts.py:PCR_DRAFT_USER_TEMPLATE`
// — the format the backend pcr_parser (Stage 1a) ingests. Every variable slot
// is filled with [UNCONFIRMED] so manual writers can replace placeholders in
// place without breaking the parser's section anchors.
export const PCR_BLANK_TEMPLATE = `PATIENT CARE REPORT
Report Type: EMS Patient Care Report
CAD Incident ID: [UNCONFIRMED]
PCR Number: PCR-[UNCONFIRMED]
Date of Service: [UNCONFIRMED]

============================================================
AGENCY / UNIT INFORMATION
============================================================

EMS Agency: [UNCONFIRMED]
Unit ID: [UNCONFIRMED]
Crew:
- Paramedic: [UNCONFIRMED]
- EMT: [UNCONFIRMED]

Incident Borough: [UNCONFIRMED]
Dispatch Area: [UNCONFIRMED]
ZIP Code: [UNCONFIRMED]
Police Precinct: [UNCONFIRMED]

============================================================
DISPATCH INFORMATION
============================================================

Initial Call Type: [UNCONFIRMED]
Initial Severity Level: [UNCONFIRMED]
Final Call Type: [UNCONFIRMED]
Final Severity Level: [UNCONFIRMED]

Dispatch Complaint:
[UNCONFIRMED]

Call Notes:
[UNCONFIRMED]

============================================================
TIMES
============================================================

Incident Date/Time:          [UNCONFIRMED]
First Assignment:            [UNCONFIRMED]
Unit Activated:              [UNCONFIRMED]
Unit Arrived On Scene:       [UNCONFIRMED]
Departed Scene To Hospital:  [UNCONFIRMED]
Arrived At Hospital:         [UNCONFIRMED]
Incident Closed:             [UNCONFIRMED]

Dispatch Response Time: [UNCONFIRMED] seconds
Incident Response Time: [UNCONFIRMED] seconds
Travel Time To Scene: [UNCONFIRMED] seconds

============================================================
PATIENT INFORMATION
============================================================

Patient Name: [UNCONFIRMED]
Age: [UNCONFIRMED]
Sex: [UNCONFIRMED]
DOB: [UNCONFIRMED]
Address: [UNCONFIRMED], NY [UNCONFIRMED]
Patient ID: Not available at time of care

============================================================
CHIEF COMPLAINT
============================================================

[UNCONFIRMED]

============================================================
HISTORY OF PRESENT ILLNESS
============================================================

[UNCONFIRMED]

============================================================
PAST MEDICAL HISTORY
============================================================

[UNCONFIRMED]

============================================================
MEDICATIONS
============================================================

[UNCONFIRMED]

============================================================
ALLERGIES
============================================================

[UNCONFIRMED]

============================================================
INITIAL ASSESSMENT
============================================================

[UNCONFIRMED]

============================================================
VITAL SIGNS
============================================================

[UNCONFIRMED]

============================================================
TREATMENTS / INTERVENTIONS
============================================================

[UNCONFIRMED]

============================================================
MEDICATIONS ADMINISTERED
============================================================

[UNCONFIRMED]

============================================================
PROCEDURES
============================================================

[UNCONFIRMED]

============================================================
TRANSPORT INFORMATION
============================================================

Transported: [UNCONFIRMED]
Destination: [UNCONFIRMED]
Destination Type: Emergency Department
Transport Priority: Emergency
Patient Position: Supine
Condition During Transport: [UNCONFIRMED]
Condition At Transfer: [UNCONFIRMED]

Reason For Destination: [UNCONFIRMED]

============================================================
TRANSFER OF CARE
============================================================

Care transferred to emergency department staff on arrival.
Verbal report given to ED physician and nursing staff.

Patient transferred with: [UNCONFIRMED]

============================================================
NARRATIVE
============================================================

[UNCONFIRMED]

============================================================
DISPOSITION
============================================================

Incident Disposition Code: [UNCONFIRMED]
Patient Disposition: [UNCONFIRMED]
Final Patient Condition: [UNCONFIRMED]
ROSC Achieved: [UNCONFIRMED]
Transported To Hospital: [UNCONFIRMED]
Crew Cleared: [UNCONFIRMED]

============================================================
SIGNATURES
============================================================

Primary Provider: [UNCONFIRMED]
Partner: [UNCONFIRMED]
Receiving Facility Signature: [UNCONFIRMED]
Patient Signature: [UNCONFIRMED]
Report Completed: [UNCONFIRMED]
`;
