Here's the full combined prompt — drop this into Figma Make:

---

**Build a frontend for an EMS Quality Improvement (QI) report review tool called "Salvage."**

This is an internal web app used by EMS supervisors to review AI-generated incident reports after a 911 call. It replaces a traumatic manual reconstruction process with a calm, focused review workflow. Design priorities: clean, uncluttered, generous whitespace, one primary action per page, trauma-conscious defaults (no auto-playing footage, audio-first).

---

## Visual Style — Palantir Operator, Light Mode

The aesthetic is **defense-tech / institutional operator console, but in light mode.** Think Palantir Gotham, Anduril, or Rune — serious, dense-but-clean, telegraphs gravity. This isn't a SaaS dashboard; it handles life-and-death incidents.

**Color palette:**
- Background: warm off-white (#F5F4F0 or #F2F1ED) — never pure white
- Surface/cards: slightly lighter off-white (#FAF9F5) with hairline borders
- Primary text: near-black charcoal (#1A1A1A)
- Secondary text: warm grey (#6B6B68)
- Borders/dividers: subtle warm grey (#D9D7D0), 1px hairlines only
- Accent (primary actions, selected states): deep amber/ochre (#B8732E) — operator-console amber, but muted and refined for light mode
- Flag/warning: same amber, used sparingly
- Critical/error: deep rust red (#8B2E1F), only when truly critical
- Success/approved: muted forest (#3D5A3D), never bright green

**Typography:**
- Body and UI: **Inter** or **IBM Plex Sans**, tight letter spacing, weights 400/500/600
- Data, IDs, timestamps, coordinates, codes: **JetBrains Mono** or **IBM Plex Mono** — use monospace anywhere a number, ID, or timecode appears. This is critical to the vibe.
- Headers: same sans-serif as body, slightly tighter tracking, never oversized
- Small caps or uppercase tracked-out labels for section headers (e.g., "TIMELINE" "CONTEXT VIEWER" "REPORT")

**Layout & components:**
- Sharp 4px corners (not rounded/soft) — operator feel
- No shadows, no gradients, no glassmorphism
- 1px hairline borders define structure
- Dense but never cramped — generous padding inside containers, tight spacing between data points
- Grid-based, aligned to a clear baseline
- Status pills are rectangular with 2px corners, monospace text, hairline border + tinted background
- Buttons: rectangular, 2px corners, primary = filled amber, secondary = hairline border with transparent fill
- Icons: thin-stroke line icons (Lucide, 1.5px stroke), monochrome
- Subtle scan-line or grid texture in empty states is acceptable but optional

**Tone of UI copy:**
- Terse, factual, operator-style
- "INCIDENT INC-2026-04-0231 / READY FOR REVIEW" not "Your incident is ready!"
- Timestamps in 24-hour format
- Coordinates and IDs always in monospace

---

## Build these 5 pages:

### Page 1 — New Report (Upload)
- Top bar: "SALVAGE" wordmark on left (monospace, tracked out), "SAVED REPORTS" link on right
- Centered card (max 600px wide) titled "NEW INCIDENT REPORT" (small caps, tracked)
- 4 vertical upload slots inside the card, each with a label, hairline-bordered drop zone, and "CHOOSE FILE" button:
  1. ePCR file (PDF/XML)
  2. CAD export (includes AVL/GPS data)
  3. Video footage (multiple files allowed)
  4. Dispatch audio — disabled with small "STRETCH / V2" tag
- Once uploaded, each slot shows filename (mono), size (mono), and × to remove
- Below the card: one primary button "GENERATE REPORT" (disabled until ePCR + one other source attached)
- Muted footer text: "Missing sources will result in partial reconstruction."

### Page 2 — Processing
- Minimal centered layout
- Auto-generated incident ID at top in monospace: "INC-2026-04-0231"
- Thin 1px progress bar (amber fill)
- Vertical checklist with completed/in-progress states (use small status indicators, not checkmarks — think `[OK]` `[..]` `[--]` in mono):
  - Parsing ePCR — `[OK]`
  - Syncing CAD timeline — `[OK]`
  - Processing video (audio-only extraction) — `[..]`
  - Cross-referencing sources — `[--]`
  - Drafting report — `[--]`
- Muted footer line: "Video is processed audio-first. Footage is not displayed without explicit user action."

### Page 3 — Review (main screen)
Three-column layout with a top bar.

*Top bar:*
- Left: incident ID in mono + date in mono ("INC-2026-04-0231 / 2026-04-12 14:32")
- Center: status pill "IN REVIEW" (mono, hairline border, tinted bg)
- Right: "SAVE & EXIT" (secondary) and "FINALIZE REPORT" (primary amber, disabled until all sections approved)

*Left column (~25% width) — Timeline*
- Section header: "TIMELINE" (small caps, tracked) + "KEY MOMENTS ONLY" toggle (ON by default)
- Vertical scrubbable timeline with monospace timestamp labels
- Collapsible track groups: CAD EVENTS, GPS PATH, VIDEO SEGMENTS, PCR ENTRIES, VITALS
- Each event = small node with thin-line icon and short label
- Selected node has amber accent highlight + amber 1px left border on the row

*Center column (~40% width) — Context Viewer*
- Tab bar at top: MAP (default), VIDEO, PCR SOURCE, CAD LOG (small caps mono tabs, underline indicator on active)
- Map tab: map view (placeholder) with route line and unit marker — use a muted, almost monochrome map style (think Mapbox "Light" with reduced saturation), amber route line, monospace coordinate readout in the corner
- Video tab: prominent "AUDIO ONLY" state with a waveform visualization, secondary button "DISPLAY VIDEO FOOTAGE" requiring explicit click. Include a one-line warning: "Footage may contain graphic content."

*Right column (~35% width) — Report*
- Scrollable list of 9 collapsible sections, each with a small monospace status tag (`[DRAFT]` `[EDITED]` `[APPROVED]`):
  1. INCIDENT SUMMARY
  2. TIMELINE RECONSTRUCTION
  3. PCR DOCUMENTATION CHECK
  4. PROTOCOL COMPLIANCE REVIEW
  5. KEY CLINICAL DECISIONS
  6. COMMUNICATION / SCENE MANAGEMENT
  7. STRENGTHS
  8. AREAS FOR IMPROVEMENT
  9. RECOMMENDED FOLLOW-UP
- Each section: AI-drafted text with subtle superscript citation numbers (mono), inline-editable area, "APPROVE" button at the bottom
- Show one section expanded (Incident Summary) with realistic example text and citations, others collapsed

### Page 4 — Finalize
- Centered card layout
- Title: "FINALIZE REPORT" (small caps, tracked)
- Summary block in monospace key-value format:
  - INCIDENT ID: INC-2026-04-0231
  - DATE: 2026-04-12
  - CREW: M-7 / RODRIGUEZ, CHEN
  - SECTIONS APPROVED: 9/9
  - REVIEWER: [name]
- Toggle: "VIEW CHANGES FROM AI DRAFT" — placeholder diff view
- Two buttons: "BACK TO REVIEW" (secondary) and "SAVE FINAL REPORT" (primary amber)

### Page 5 — Archive (Saved Reports)
- Top bar: "SAVED REPORTS" title + "+ NEW REPORT" button (top right, primary amber)
- Single search bar below title (hairline border, mono placeholder text "SEARCH BY ID, DATE, CREW")
- Clean table with 4 columns: INCIDENT ID (mono), DATE (mono), CREW (mono), STATUS
- Status pills: "FINALIZED" (forest tint) or "DRAFT" (amber tint), monospace
- Rows clickable, hover = subtle warm grey background
- No filters, no widgets, no sidebar

---

## General rules across all pages:
- One primary action per page maximum
- No floating chat assistants, no notification bells, no sidebars beyond what's specified
- All copy is terse, factual, operator-style
- Use realistic placeholder data: "INC-2026-04-0231", "CARDIAC ARREST / 14:32 DISPATCH", "UNIT M-7", "CREW: RODRIGUEZ, CHEN", "GPS: 34.0522, -118.2437"
- Show realistic filled-in states (expanded section, in-progress processing, populated archive) — not empty templates
- Every ID, timestamp, coordinate, and code in monospace. Every label and body in sans-serif. The contrast between the two is the entire vibe.

---

That should give you a strong, distinctive direction. If Figma Make produces something too generic, push back with "more institutional, more operator-console, more monospace" — those are the levers.