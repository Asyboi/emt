# Sentinel — Pitch

## Elevator pitch

**Sentinel turns Patient Care Reports, body-cam video, and dispatch
audio into a reviewer-ready After-Action Report in minutes — flagging
timing drift, missing documentation, and protocol deviations that QA
teams would otherwise miss.**

It's the difference between a 90-minute manual chart review and a
two-minute glance at a timeline that's already been reconciled across
three sources of truth.

## The problem

EMS quality assurance is one of the most expensive and most-skipped
processes in pre-hospital medicine.

- **~22% of cardiac-arrest PCRs contain a documentation discrepancy**
  detectable when compared to body-cam footage (Univ. of Pittsburgh
  retrospective, n=412). Most are never caught because no one watches
  the video.
- **AHA guidelines target epinephrine every 3-5 minutes** during ACLS,
  but real-world adherence is closer to 60-70% — and the deviations
  rarely show up in the PCR because the medic is documenting from
  memory at 3am after a code.
- **A single QA reviewer takes 60-90 minutes per cardiac arrest case**
  to cross-reference the chart, the video, and the dispatch audio
  manually. Most agencies sample <5% of cases.
- **The information is already there.** It's just spread across three
  artifacts in three formats with three different timestamps.

## The solution

Sentinel runs five LLM-powered stages over a case bundle and produces a
single timeline that reconciles everything:

1. **Extract** — three parallel models pull structured `Event` objects
   from each source (Claude Haiku for PCR, Gemini 2.5 Flash for video,
   ElevenLabs Scribe + Haiku for audio).
2. **Reconcile** — Claude Sonnet merges the three event streams into a
   canonical timeline with cross-source confidence and explicit
   discrepancy flags.
3. **Check** — a deterministic ACLS protocol engine grades each step
   (epi interval, defib timing, airway, etc.) as adherent / deviation /
   insufficient evidence.
4. **Find** — Sonnet surfaces concrete issues across five categories:
   timing discrepancy, missing documentation, phantom intervention,
   protocol deviation, care gap. Every finding is grounded by
   `evidence_event_ids` and a body-cam timestamp.
5. **Draft** — Sonnet writes the summary and narrative; the adherence
   score is computed deterministically.

The reviewer sees a 3-pane UI: body-cam left, AAR center, PCR right.
Clicking a finding seeks the video to the exact second and highlights
the matching PCR sentence. **That click is the wow moment** — it
collapses three artifacts into one auditable view.

## What makes it novel

- **Multi-source reconciliation, not single-source summarization.** Most
  medical-AI demos summarize one document. Sentinel triangulates across
  three independent records and surfaces the disagreements — that's
  where QA value lives.
- **Right model for each stage.** Haiku for fast structured extraction,
  Gemini for native long-form video, Sonnet for the reasoning-heavy
  reconciliation/findings/drafting. Cheaper, faster, and better than
  forcing a single model to do everything.
- **Grounded findings.** Every finding carries explicit
  `evidence_event_ids` plus an `evidence_timestamp_seconds` and a
  `pcr_excerpt`, so the reviewer can verify the claim in one click. No
  unsourced LLM assertions.
- **Demo-bulletproof.** A `?demo=1` flag replays a cached AAR with
  synthetic timing so judges see the full UX even if every API key
  expired five minutes before stage time.

## What's next

- **Real-cohort validation** with an EMS partner: precision/recall on
  the discrepancy categories against expert-labeled ground truth.
- **Reviewer-in-the-loop training data**: every accept/reject on a
  finding becomes a labeled example for fine-tuning the findings model.
- **Protocol library expansion** beyond ACLS — trauma, stroke, OB.

The pipeline is already modular per stage; adding a new protocol means
adding rules to one file, not retraining anything.
