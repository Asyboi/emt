Here's a prompt you can drop into Figma Make:

Redesign the "Processing Incident" page for an EMS agentic review system called SALVAGE. This page is shown while multiple AI agents process an incident in the background. The goal is to visually communicate a multi-agent orchestration system — not a build log. Judges at a hackathon need to look at this screen and immediately understand: "there are multiple specialized agents working in parallel, reasoning, and handing data to each other."
Visual style (must match existing app):

Warm off-white background (#F5F4F0)
Monospace-heavy typography, small caps with letter-spacing for labels
Hairline borders (1px, light warm grey)
Amber accent (#B8732E) for active/primary states
Forest green for success/complete, muted grey for pending
4px border radius, no shadows, no gradients
Operator-console aesthetic — refined terminal, not consumer SaaS

Page structure — top to bottom:
1. Top header bar (full width, hairline border bottom)

Centered: "PROCESSING INCIDENT" small caps tracked, then larger mono "INC-2026-04-0231"
Below: mono status line "AGENT: SALVAGE-CORE-01 | ELAPSED: 01:47 | STATUS: ACTIVE"
Thin amber progress bar spanning full width beneath header (~55% filled)

2. Agent topology diagram (centered, ~140px tall)
This is the key visual. Show a horizontal node-and-edge flow diagram of the agent architecture. Each node is a small rounded rectangle with the agent name inside in mono. Edges are thin lines with small directional arrows.
Layout the nodes like this:

Left column (parallel, stacked vertically): three extraction agents running simultaneously

"ePCR PARSER" — status: complete (green border/check)
"AUDIO ANALYZER" — status: active (amber border, subtle pulse)
"CAD SYNC" — status: complete (green border/check)


All three have edges flowing right into a single node:

"RECONCILIATION" — status: pending (grey, dashed border)


That flows right into:

"PROTOCOL CHECK" — status: pending


That flows right into:

"REPORT DRAFTER" — status: pending



Each node shows a tiny label beneath it with the model powering it (e.g., "Haiku 4.5", "Whisper + Haiku", "Sonnet 4.6"). Active nodes have a small spinning indicator. Completed nodes show a small checkmark. The edges between completed→active nodes should be amber/highlighted. Edges to pending nodes are grey/dashed.
This diagram communicates parallelism (three agents at once), convergence (into reconciliation), and sequential reasoning (protocol → draft). It should feel like a system architecture diagram, not a flowchart.
3. Agent cards section (below the topology, horizontal row or 2×3 grid)
Six cards, one per agent. Each card is a compact rectangle (~200px wide) with:

Agent name in mono small caps at top
One-line current status: "COMPLETE", "PROCESSING...", or "WAITING"
A small progress indicator (substep count like "4/4" or a thin progress bar)
One line of "currently doing" text in small muted mono for active agents (e.g., "Extracting audio from BODYCAM-02.mp4")
For completed agents: a small summary line of what they produced (e.g., "14 events extracted" or "47 GPS waypoints captured")
Bottom of card: small mono label showing the model ("Haiku 4.5") and elapsed time for that agent

Active cards have an amber left border. Completed cards have a green left border. Pending cards have a grey dashed left border. Each card should look clickable (subtle hover state implied).
Show these states across the 6 cards:

ePCR Parser: COMPLETE — "14 events, 3 medications, vitals timeline" — 00:00:08
CAD Sync: COMPLETE — "47 waypoints, 6 dispatch events synced" — 00:00:11
Audio Analyzer: ACTIVE — "Processing BODYCAM-02.mp4 audio track..." — substeps 5/7
Reconciliation: WAITING — "Awaiting audio analyzer completion"
Protocol Check: WAITING
Report Drafter: WAITING

4. Live findings ticker (below agents, full width, subtle background tint)
A horizontal bar or compact feed showing 3-4 key findings the agents have surfaced so far. Each finding is one line of mono text with a colored prefix:

✓ green: "Response time 3m 47s — within threshold"
✓ green: "Defibrillation timing matches ePCR ±1s"
⚠ amber: "IV access attempts: PCR says 2, audio suggests 3 — flagged"
✓ green: "Epinephrine administration appropriate for refractory VF"

This section gives the reviewer something meaningful to read while waiting. Label it "LIVE FINDINGS" in small caps.
5. Expandable agent detail panel (shown as if user clicked the Audio Analyzer card)
Show a right-side drawer or expanded panel (~50% page width) that slides out over or pushes the main content. This panel contains the detailed log stream for that specific agent — this is where the current log feed lives, but scoped to one agent.
Panel header: "AUDIO ANALYZER" with a small × close button and "AUTO-SCROLL [ON]" toggle.
Below: the scrolling mono log feed, same style as existing but only showing logs relevant to this agent:

[00:00:20] Loading audio extraction pipeline
[00:00:21] → Processing BODYCAM-01.mp4 (1.2 GB) — audio track only
[00:00:22] Extracting audio stream (AAC 48kHz stereo)
[00:00:35] → Running speech-to-text inference (Whisper large-v3)
[00:00:52] ✓ Audio transcript extracted: 8m 14s of crew communication
[00:01:04] → Identifying clinical keywords and intervention timestamps
[00:01:12] ✓ Detected mentions: "VF rhythm" (14:37:02), "shock delivered" (14:37:08)
[00:01:23] > Audio timestamp 14:37:08 aligns with ePCR log (14:37:09) — 1s drift
[00:01:34] ! IV access discrepancy — flagging for human review

Same color coding: grey for system, white for actions, amber for reasoning, green for findings, red/rust for warnings.
6. Bottom bar (full width, hairline border top)
Left side: small counters in mono — "3 AGENTS DEPLOYED | 2 COMPLETE | 1 ACTIVE | 47 EVENTS SYNCED | 1 FLAG RAISED"
Right side: muted text "Video is processed audio-first. Footage is not displayed without explicit user action."
7. Sources ingested (small, bottom-left or as a collapsible section)
Keep the existing file list but make it more compact — just filenames with size and a status icon (check, spinner, or empty circle). This is secondary information now, not a main panel element.