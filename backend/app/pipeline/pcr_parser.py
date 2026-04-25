"""Stage 1a — PCR parsing via Claude Haiku 4.5."""

from __future__ import annotations

import uuid

from app.case_loader import load_pcr_content
from app.llm_clients import claude_haiku
from app.prompts import PCR_EVENTS_TOOL, PCR_PARSER_SYSTEM, PCR_PARSER_USER_TEMPLATE
from app.schemas import Case, Event, EventSource, EventType


async def parse_pcr(case: Case) -> list[Event]:
    pcr_content = load_pcr_content(case.case_id)
    response = await claude_haiku(
        system=PCR_PARSER_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": PCR_PARSER_USER_TEMPLATE.format(pcr_content=pcr_content),
            }
        ],
        tools=[PCR_EVENTS_TOOL],
        max_tokens=4096,
    )

    tool_use = next((b for b in response["content"] if b["type"] == "tool_use"), None)
    if tool_use is None:
        raise RuntimeError("Claude did not return a tool_use block for extract_pcr_events")

    raw_events = tool_use["input"]["events"]
    return [
        Event(
            event_id=str(uuid.uuid4()),
            timestamp=e["timestamp"],
            timestamp_seconds=e["timestamp_seconds"],
            source=EventSource.PCR,
            event_type=EventType(e["event_type"]),
            description=e["description"],
            details=e.get("details", {}),
            confidence=e["confidence"],
            raw_evidence=e["raw_evidence"],
        )
        for e in raw_events
    ]
