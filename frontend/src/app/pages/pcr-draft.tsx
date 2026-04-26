import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { confirmPcrDraft, createPcrDraft } from '../../data/pcr-api';
import { usePcrDraft } from '../../data/pcr-hooks';
import { getDataSource } from '../../data/source';
import {
  countUnconfirmed,
  highlightUnconfirmed,
  parsePcrSections,
} from '../../lib/pcr-highlight';
import { PCR_BLANK_TEMPLATE } from '../../lib/pcr-template';
import type { PCRDraft } from '../../types/backend';
import { AgentCard } from '../components/pipeline/AgentCard';
import { ModelPill } from '../components/pipeline/ModelPill';
import { ParallelBox } from '../components/pipeline/ParallelBox';
import {
  PipelineLines,
  type PipelinePath,
} from '../components/pipeline/PipelineLines';
import type {
  AgentVizStatus,
  ModelPillKind,
  ModelPillSpec,
} from '../components/pipeline/types';

// ── Design tokens (resolved from theme.css :root) ────────────────────────────
const C_SUCCESS = 'var(--success)';
const C_PRIMARY = 'var(--primary)';
const C_HIGHLIGHT = 'color-mix(in srgb, var(--primary) 18%, transparent)';

const POST_CONFIRM_REDIRECT_MS = 2400;
const GENERATING_STAGE_MS = 1800;
const DEMO_GENERATING_MS = 10_000;

const FONT_MONO = 'var(--font-mono)';

// ── Demo draft (used when ?demo=1 or local mode) ─────────────────────────────
const DEMO_PCR_MARKDOWN = `============================================================
AGENCY / UNIT INFORMATION
============================================================
Agency:           [UNCONFIRMED]
Unit ID:          MEDIC-12
Crew:             J. Rivera (paramedic), K. Choi (EMT)

============================================================
DISPATCH INFORMATION
============================================================
CAD Incident #:   2026-04-25-0142
Call Type:        CARDIAC ARREST
Dispatch Time:    14:08:32
On Scene Time:    14:14:11
Patient Contact:  14:14:55

============================================================
PATIENT DEMOGRAPHICS
============================================================
Age:              [UNCONFIRMED]
Sex:              M
Chief Complaint:  Witnessed collapse, unresponsive, no pulse

============================================================
INITIAL ASSESSMENT
============================================================
Found patient supine on living-room floor. Bystander CPR in
progress. Patient unresponsive, apneic, no carotid pulse.
Skin pale and diaphoretic. Initial rhythm on monitor:
[UNCONFIRMED] (interpreted as VF on second look at 14:15:42).

============================================================
INTERVENTIONS PERFORMED
============================================================
14:15:10  CPR taken over by crew, high-quality compressions
14:15:42  Defibrillation attempt #1 — 200 J biphasic
14:17:15  IV access established, left AC, 18g
14:17:48  Epinephrine 1 mg IV/IO push
14:19:30  Defibrillation attempt #2 — [UNCONFIRMED] J biphasic
14:21:05  Amiodarone 300 mg IV bolus

============================================================
RESPONSE / DISPOSITION
============================================================
ROSC achieved at:  [UNCONFIRMED]
Transport to:      Mt. Sinai West
Patient handoff:   14:38:20, ED bed 4

============================================================
NARRATIVE
============================================================
Crew responded to a witnessed cardiac arrest. Bystander CPR
was in progress on arrival. ALS care initiated immediately
per ACLS algorithm. Patient was defibrillated twice and
received epinephrine and amiodarone per protocol. ROSC was
achieved en route. Patient was transferred to ED with
sustained pulse and spontaneous respirations.
`;

const DEMO_DRAFT: PCRDraft = {
  case_id: 'case_01',
  generated_at: new Date('2026-04-25T15:30:00Z').toISOString(),
  status: 'pending_review',
  video_event_count: 12,
  audio_event_count: 8,
  total_event_count: 20,
  draft_markdown: DEMO_PCR_MARKDOWN,
  unconfirmed_count: (DEMO_PCR_MARKDOWN.match(/\[UNCONFIRMED\]/g) ?? []).length,
  confirmed_by: null,
  confirmed_at: null,
  emt_edits_made: false,
  error: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatTimestamp = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

// ── Highlight overlay editor ─────────────────────────────────────────────────
interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function HighlightedEditor({ value, onChange, textareaRef }: EditorProps) {
  const backRef = useRef<HTMLDivElement>(null);

  // Sync backdrop scroll to textarea scroll.
  const syncScroll = () => {
    const ta = textareaRef.current;
    const back = backRef.current;
    if (ta && back) {
      back.scrollTop = ta.scrollTop;
      back.scrollLeft = ta.scrollLeft;
    }
  };

  // Build the highlighted backdrop nodes. Text rendered transparent — only
  // the [UNCONFIRMED] spans show their background fill, and the textarea
  // text floats above thanks to the transparent background on the textarea.
  // No padding on the token style so glyph alignment matches the textarea.
  const backdropNodes = useMemo(
    () =>
      highlightUnconfirmed(value, {
        tokenStyle: { background: C_HIGHLIGHT, borderRadius: 2 },
      }),
    [value],
  );

  const sharedTextStyle: React.CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: 13,
    lineHeight: 1.55,
    padding: 16,
    margin: 0,
    border: 0,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    boxSizing: 'border-box',
  };

  return (
    <div className="relative w-full h-full" style={{ background: 'var(--surface)' }}>
      <div
        ref={backRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none overflow-auto"
        style={{ ...sharedTextStyle, color: 'transparent' }}
      >
        {backdropNodes}
        {/* trailing newline guarantees the last line height matches */}
        {'\n'}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        className="absolute inset-0 w-full h-full resize-none outline-none"
        style={{
          ...sharedTextStyle,
          background: 'transparent',
          color: 'var(--text)',
        }}
      />
    </div>
  );
}

// ── Generating state ─────────────────────────────────────────────────────────
//
// Mirrors the QI Processing page pipeline diagram, scoped to the PCR
// auto-draft pre-pipeline:
//
//   ┌─ CAD sync (pydantic)              ──╮
//   │  Video analysis (Gemini)           ──┼──>  Sonnet drafting → PCRDraft
//   └─ Audio analysis (Scribe + Haiku)  ──╯
//
// Status is simulated from elapsed time since the PCR draft endpoint has
// no SSE stream — only a polling loop.

interface PcrParallelDef {
  id: 'cad' | 'video' | 'audio';
  label: string;
  description: string;
  pills: ModelPillSpec[];
  startsAt: number;
  completesAt: number;
}

const PCR_PARALLEL: PcrParallelDef[] = [
  {
    id: 'cad',
    label: 'CAD sync',
    description: 'Pure-Python parse of cad.json into a typed CAD record.',
    pills: [{ kind: 'pydantic' }],
    startsAt: 0,
    completesAt: 2,
  },
  {
    id: 'video',
    label: 'Video analysis',
    description: 'Body-cam frames → timestamped clinical events.',
    pills: [{ kind: 'gemini' }],
    startsAt: 0,
    completesAt: 18,
  },
  {
    id: 'audio',
    label: 'Audio analysis',
    description: 'Dispatch audio: transcribe, then extract events.',
    pills: [{ kind: 'scribe' }, { kind: 'haiku' }],
    startsAt: 0,
    completesAt: 18,
  },
];

const PCR_DRAFTING_STARTS_AT = 18;
const PCR_DRAFTING_COMPLETES_AT = 60;

function statusFromElapsed(
  startsAt: number,
  completesAt: number,
  elapsed: number,
): AgentVizStatus {
  if (elapsed >= completesAt) return 'complete';
  if (elapsed >= startsAt) return 'running';
  return 'pending';
}

const PCR_CARD_HEADER_OFFSET = 24;

function GeneratingState({ caseId }: { caseId: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const t = window.setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 250);
    return () => window.clearInterval(t);
  }, []);

  const parallelStatuses = PCR_PARALLEL.map((s) =>
    statusFromElapsed(s.startsAt, s.completesAt, elapsed),
  );
  const draftingStatus = statusFromElapsed(
    PCR_DRAFTING_STARTS_AT,
    PCR_DRAFTING_COMPLETES_AT,
    elapsed,
  );
  const parallelComplete = parallelStatuses.filter((s) => s === 'complete').length;

  // Layout-tracking refs (mirror processing.tsx: SVG overlay reads element
  // rects each layout pass so connector lines re-anchor as cards grow).
  const fitWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const parallelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const draftingRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  const setParallelRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      parallelRefs.current[id] = el;
    },
    [],
  );

  const [paths, setPaths] = useState<PipelinePath[]>([]);

  const layoutSig = `${parallelStatuses.join('|')}|${draftingStatus}|${scale}`;

  // Fit-to-viewport scaler.
  useLayoutEffect(() => {
    const fit = fitWrapRef.current;
    const canvas = canvasRef.current;
    if (!fit || !canvas) return;

    const compute = () => {
      const naturalW = canvas.offsetWidth;
      const naturalH = canvas.offsetHeight;
      const availW = fit.clientWidth;
      const availH = fit.clientHeight;
      if (!naturalW || !naturalH || !availW || !availH) return;
      const sx = availW / naturalW;
      const sy = availH / naturalH;
      const next = Math.min(1, sx, sy);
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(fit);
    ro.observe(canvas);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  // Compute connector paths from element rects.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;

    const compute = () => {
      raf = 0;
      const cv = canvasRef.current;
      if (!cv) return;
      const cRect = cv.getBoundingClientRect();
      const sf = scaleRef.current || 1;
      const next: PipelinePath[] = [];

      const draftEl = draftingRef.current;
      if (draftEl) {
        const r = draftEl.getBoundingClientRect();
        const targetX = (r.left - cRect.left) / sf;
        const targetY = (r.top - cRect.top) / sf + PCR_CARD_HEADER_OFFSET;

        PCR_PARALLEL.forEach((agent, i) => {
          const el = parallelRefs.current[agent.id];
          if (!el) return;
          const pr = el.getBoundingClientRect();
          next.push({
            id: `pcr-fan-${agent.id}`,
            x1: (pr.right - cRect.left) / sf,
            y1: (pr.top - cRect.top) / sf + pr.height / sf / 2,
            x2: targetX,
            y2: targetY,
            sourceStatus: parallelStatuses[i],
          });
        });
      }

      setPaths((prev) => (samePcrPaths(prev, next) ? prev : next));
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    schedule();

    const ro = new ResizeObserver(schedule);
    ro.observe(canvas);
    Object.values(parallelRefs.current).forEach((el) => el && ro.observe(el));
    if (draftingRef.current) ro.observe(draftingRef.current);
    window.addEventListener('resize', schedule);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSig]);

  const overallStatus =
    draftingStatus === 'complete'
      ? 'complete'
      : parallelStatuses.some((s) => s === 'running') || draftingStatus === 'running'
        ? 'active'
        : 'pending';
  const overallStatusColor =
    overallStatus === 'complete' ? 'var(--success)' : 'var(--primary-strong)';
  const hms = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--background)', fontFamily: 'var(--font-sans)' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 border-b"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          padding: '18px 36px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-2)',
            fontWeight: 500,
          }}
        >
          Generating PCR draft
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--text)',
            marginTop: 3,
            letterSpacing: 0.1,
          }}
        >
          {caseId}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-2)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>PCR-DRAFTER</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span>{hms(elapsed)} elapsed</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span
            style={{
              color: overallStatusColor,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {overallStatus}
          </span>
        </div>
      </header>

      {/* Pipeline visualization */}
      <main
        ref={fitWrapRef}
        className="flex-1 min-h-0 min-w-0 overflow-hidden"
        style={{
          background: 'var(--background)',
          backgroundImage:
            'radial-gradient(circle, color-mix(in srgb, var(--text) 10%, transparent) 1px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          padding: '28px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          ref={canvasRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            flexShrink: 0,
          }}
        >
          {/* Zone 1: Parallel extraction */}
          <ParallelBox
            title="Parallel extraction"
            completedCount={parallelComplete}
            totalCount={PCR_PARALLEL.length}
            parallelismLabel="asyncio.gather()"
            width={260}
          >
            {PCR_PARALLEL.map((agent, i) => (
              <div key={agent.id} ref={setParallelRef(agent.id)}>
                <AgentCard
                  label={agent.label}
                  description={agent.description}
                  pills={agent.pills}
                  status={parallelStatuses[i]}
                  variant="parallel"
                />
              </div>
            ))}
          </ParallelBox>

          {/* Zone 2: Convergence — empty space, lines drawn by SVG overlay */}
          <div style={{ width: 96, flexShrink: 0 }} aria-hidden />

          {/* Zone 3: Sonnet drafter */}
          <div ref={draftingRef} style={{ flexShrink: 0 }}>
            <AgentCard
              label="Sonnet drafting"
              description="Single Claude Sonnet 4.6 call: CAD + video + audio events → PCR markdown with [UNCONFIRMED] flags."
              pills={[{ kind: 'sonnet' }]}
              status={draftingStatus}
              variant="sequential"
              noteRight="max_tokens=3000"
              width={340}
            />
          </div>

          {/* SVG overlay */}
          <PipelineLines paths={paths} />
        </div>
      </main>

      {/* Legend */}
      <div
        className="flex-shrink-0 border-t"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          padding: '10px 36px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          fontSize: 11,
          color: 'var(--text-2)',
        }}
      >
        <PcrLegendItem pill="pydantic" tagline="deterministic" />
        <PcrLegendItem pill="gemini" tagline="video" />
        <PcrLegendItem pill="scribe" tagline="transcription" />
        <PcrLegendItem pill="haiku" tagline="fast extraction" />
        <PcrLegendItem pill="sonnet" tagline="deep reasoning" />
      </div>

      {/* Footer */}
      <footer
        className="flex-shrink-0 border-t"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          padding: '10px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-2)',
        }}
      >
        <div className="flex items-center" style={{ gap: 14 }}>
          <span>4 stages</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: 'var(--text-2)' }}>polling · 2s interval</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: 'var(--text-2)' }}>typically 30s – 2m</span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-2)',
          }}
        >
          POST /api/cases/{caseId}/pcr-draft
        </span>
      </footer>
    </div>
  );
}

function PcrLegendItem({
  pill,
  tagline,
}: {
  pill: ModelPillKind;
  tagline: string;
}) {
  return (
    <span className="inline-flex items-center" style={{ gap: 6 }}>
      <ModelPill kind={pill} />
      <span style={{ color: 'var(--text-2)', fontSize: 11 }}>{tagline}</span>
    </span>
  );
}

function samePcrPaths(a: PipelinePath[], b: PipelinePath[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.x1 !== y.x1 ||
      x.y1 !== y.y1 ||
      x.x2 !== y.x2 ||
      x.y2 !== y.y2 ||
      x.sourceStatus !== y.sourceStatus
    ) {
      return false;
    }
  }
  return true;
}

// ── Error state ──────────────────────────────────────────────────────────────
interface ErrorStateProps {
  caseId: string;
  errorMessage: string;
  onRegenerate: () => void;
  onWriteManually: () => void;
  busy: boolean;
}

function ErrorState({
  caseId,
  errorMessage,
  onRegenerate,
  onWriteManually,
  busy,
}: ErrorStateProps) {
  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[560px] bg-surface border border-border p-8">
          <div
            className="flex items-center justify-between text-[10px] tracking-[0.15em] text-foreground-secondary mb-4"
            style={{ fontFamily: FONT_MONO }}
          >
            <span>{caseId}</span>
          </div>
          <div className="flex items-start gap-3 mb-6">
            <AlertTriangle
              aria-hidden
              style={{ width: 20, height: 20, color: 'var(--destructive)', flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <h2
                className="text-xs tracking-[0.15em] mb-2"
                style={{ fontFamily: 'var(--font-sans)', color: 'var(--destructive)' }}
              >
                PCR DRAFT GENERATION FAILED
              </h2>
              <p
                className="text-xs leading-relaxed text-foreground-secondary"
                style={{ fontFamily: FONT_MONO }}
              >
                {errorMessage}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              className="flex-1 px-4 py-2.5 border border-border text-sm tracking-wide hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              REGENERATE
            </button>
            <button
              type="button"
              onClick={onWriteManually}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-opacity"
            >
              WRITE MANUALLY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confirmed state (brief) ──────────────────────────────────────────────────
function ConfirmedState({ draft }: { draft: PCRDraft }) {
  return (
    <div className="h-full overflow-y-auto bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[460px] bg-surface border border-border p-10 text-center">
        <CheckCircle2
          className="mx-auto mb-5"
          style={{ width: 36, height: 36, color: C_SUCCESS }}
        />
        <h2
          className="text-xs tracking-[0.18em] mb-6"
          style={{ fontFamily: 'var(--font-sans)', color: C_SUCCESS }}
        >
          PCR CONFIRMED
        </h2>
        <div
          className="space-y-1.5 text-xs text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          <div>
            CONFIRMED BY · <span className="text-foreground">{draft.confirmed_by ?? '—'}</span>
          </div>
          <div>
            CONFIRMED AT · <span className="text-foreground">{formatTimestamp(draft.confirmed_at)}</span>
          </div>
          <div>
            EMT EDITS · <span className="text-foreground">{draft.emt_edits_made ? 'yes' : 'no'}</span>
          </div>
          <div>
            UNCONFIRMED · <span className="text-foreground">{draft.unconfirmed_count}</span>
          </div>
        </div>
        <p className="text-[11px] text-foreground-secondary mt-6">
          Redirecting to PCR view…
        </p>
      </div>
    </div>
  );
}

// ── Editor state ─────────────────────────────────────────────────────────────
interface EditorStateProps {
  caseId: string;
  draft: PCRDraft;
  isDemo: boolean;
  onConfirm: (text: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
  busy: boolean;
  errorBanner: string | null;
}

function EditorState({
  caseId,
  draft,
  isDemo,
  onConfirm,
  onRegenerate,
  busy,
  errorBanner,
}: EditorStateProps) {
  const [text, setText] = useState(draft.draft_markdown);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Reset text when a fresh draft arrives (e.g. after regenerate).
  useEffect(() => {
    setText(draft.draft_markdown);
  }, [draft.draft_markdown]);

  const unconfirmedNow = countUnconfirmed(text);
  const edited = text !== draft.draft_markdown;
  const sections = useMemo(() => parsePcrSections(text), [text]);

  const scrollToSection = (lineIndex: number) => {
    const ta = taRef.current;
    if (!ta) return;
    const cs = window.getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 20;
    const padTop = parseFloat(cs.paddingTop) || 0;
    ta.scrollTop = Math.max(0, lineIndex * lh - padTop);
    ta.focus();
  };

  const handleRegenerate = () => {
    if (busy) return;
    const ok = window.confirm(
      'Regenerate this PCR draft? Your edits will be discarded.'
    );
    if (ok) void onRegenerate();
  };

  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">
      {/* Context strip */}
      <div
        className="border-b border-border px-8 py-3 flex items-center gap-3 text-[11px] tracking-[0.15em] text-foreground-secondary flex-shrink-0"
        style={{ fontFamily: FONT_MONO }}
      >
        <span>PCR DRAFT</span>
        <span>/</span>
        <span className="text-foreground">{caseId}</span>
      </div>

      {/* Two-column body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-0">
        {/* Left — editor */}
        <div className="flex flex-col min-h-0 border-r border-border">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
            <h2
              className="text-xs tracking-[0.15em] text-foreground-secondary"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              PCR DRAFT
            </h2>
            <span
              className="px-2 py-1 text-[10px] tracking-wider rounded-sm"
              style={{
                fontFamily: FONT_MONO,
                background: unconfirmedNow > 0 ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'color-mix(in srgb, var(--success) 10%, transparent)',
                color: unconfirmedNow > 0 ? C_PRIMARY : C_SUCCESS,
                border: `1px solid ${unconfirmedNow > 0 ? 'color-mix(in srgb, var(--primary) 28%, transparent)' : 'color-mix(in srgb, var(--success) 28%, transparent)'}`,
              }}
            >
              {unconfirmedNow} UNCONFIRMED
            </span>
          </div>

          <div
            className="mx-6 mb-4 border border-border flex-1 min-h-0"
            style={{ background: 'var(--surface)' }}
          >
            <HighlightedEditor value={text} onChange={setText} textareaRef={taRef} />
          </div>
        </div>

        {/* Right — info panel */}
        <aside className="overflow-y-auto bg-surface flex flex-col">
          <section className="p-6 border-b border-border">
            <h3
              className="text-[10px] tracking-[0.18em] text-foreground-secondary mb-4"
              style={{ fontFamily: FONT_MONO }}
            >
              EVIDENCE STATS
            </h3>
            <dl
              className="text-xs space-y-2"
              style={{ fontFamily: FONT_MONO }}
            >
              <div className="flex justify-between">
                <dt className="text-foreground-secondary">Video events</dt>
                <dd>{draft.video_event_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-secondary">Audio events</dt>
                <dd>{draft.audio_event_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-secondary">Total events</dt>
                <dd>{draft.total_event_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-secondary">Generated</dt>
                <dd>{formatTimestamp(draft.generated_at)}</dd>
              </div>
            </dl>
          </section>

          <section className="p-6 border-b border-border">
            <h3
              className="text-[10px] tracking-[0.18em] text-foreground-secondary mb-3"
              style={{ fontFamily: FONT_MONO }}
            >
              UNCONFIRMED FIELDS
            </h3>
            <div
              className="text-2xl mb-3"
              style={{ fontFamily: FONT_MONO, color: unconfirmedNow > 0 ? C_PRIMARY : C_SUCCESS }}
            >
              {unconfirmedNow}
            </div>
            <p className="text-[11px] leading-relaxed text-foreground-secondary">
              <span
                className="px-1 rounded-sm"
                style={{ background: C_HIGHLIGHT, color: 'var(--primary-strong)' }}
              >
                [UNCONFIRMED]
              </span>{' '}
              marks fields the AI couldn't verify from your evidence. Replace
              with real values or leave for later review.
            </p>
          </section>

          <section className="p-6 flex-1">
            <h3
              className="text-[10px] tracking-[0.18em] text-foreground-secondary mb-3"
              style={{ fontFamily: FONT_MONO }}
            >
              SECTIONS
            </h3>
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={`${s.startLine}-${s.header}`}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(s.startLine)}
                    className="w-full text-left px-2 py-1.5 text-[11px] tracking-wide hover:bg-background transition-colors"
                    style={{ fontFamily: FONT_MONO, color: 'var(--text)' }}
                  >
                    {s.header}
                  </button>
                </li>
              ))}
              {sections.length === 0 && (
                <li
                  className="text-[11px] text-foreground-secondary italic"
                  style={{ fontFamily: FONT_MONO }}
                >
                  No sections detected.
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>

      {/* Sticky bottom action bar */}
      <div
        className="border-t border-border px-8 py-4 flex items-center justify-between gap-4 flex-shrink-0"
        style={{ background: 'rgba(250,249,245,0.95)', backdropFilter: 'blur(4px)' }}
      >
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={busy || isDemo}
          title={isDemo ? 'Disabled in demo mode' : undefined}
          className="px-4 py-2.5 border border-border text-sm tracking-wide hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          REGENERATE
        </button>

        <div className="flex flex-col items-end gap-1">
          {errorBanner && (
            <div
              className="text-[11px]"
              style={{ fontFamily: FONT_MONO, color: 'var(--destructive)' }}
            >
              {errorBanner}
            </div>
          )}
          {edited && !errorBanner && (
            <span
              className="text-[10px] tracking-wider"
              style={{ fontFamily: FONT_MONO, color: C_PRIMARY }}
            >
              EDITED
            </span>
          )}
          {unconfirmedNow > 0 && !errorBanner && (
            <span
              className="text-[11px] text-foreground-secondary"
              style={{ fontFamily: FONT_MONO }}
            >
              {unconfirmedNow} unconfirmed remaining — preserved as-is.
            </span>
          )}
          <button
            type="button"
            onClick={() => void onConfirm(text)}
            disabled={busy}
            className="px-6 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'CONFIRMING…' : 'CONFIRM PCR'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Top-level page ───────────────────────────────────────────────────────────
export function PcrDraft() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Demo mode if URL has ?demo=1 or the data source is local.
  const isDemo =
    searchParams.get('demo') === '1' || getDataSource().mode === 'local';

  // Live polling — only active in remote/non-demo mode with a real caseId.
  const { draft: liveDraft, loading, error, isGenerating, refetch } = usePcrDraft(
    isDemo ? undefined : caseId
  );

  // Local UI state.
  const [demoDraft, setDemoDraft] = useState<PCRDraft>(DEMO_DRAFT);
  const [confirmedDraft, setConfirmedDraft] = useState<PCRDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [forcedManualWrite, setForcedManualWrite] = useState(false);
  // Cosmetic generating state used briefly after a successful regenerate.
  const [showGenerating, setShowGenerating] = useState(false);
  // In demo/local mode the draft is available immediately, so there's no
  // natural "generating" window. Hold the diagram visible for ~10s on
  // initial mount (and after a regenerate) so the agentic flow is shown.
  const [demoGenerating, setDemoGenerating] = useState(isDemo);

  // Drop the demo generating overlay after a fixed window.
  useEffect(() => {
    if (!demoGenerating) return;
    const t = window.setTimeout(() => setDemoGenerating(false), DEMO_GENERATING_MS);
    return () => window.clearTimeout(t);
  }, [demoGenerating]);

  const draft = isDemo ? demoDraft : liveDraft;

  // After confirm, redirect to the (Step 5) /pcr/:caseId view.
  useEffect(() => {
    if (!confirmedDraft || !caseId) return;
    const t = window.setTimeout(() => {
      navigate(`/pcr/${caseId}`);
    }, POST_CONFIRM_REDIRECT_MS);
    return () => window.clearTimeout(t);
  }, [confirmedDraft, caseId, navigate]);

  // Drop the cosmetic generating overlay once a real draft arrives.
  useEffect(() => {
    if (!showGenerating) return;
    if (draft && !isGenerating && !error) {
      const t = window.setTimeout(() => setShowGenerating(false), GENERATING_STAGE_MS);
      return () => window.clearTimeout(t);
    }
  }, [showGenerating, draft, isGenerating, error]);

  // ── Guards ──────────────────────────────────────────────────────────────
  if (!caseId) {
    return (
      <div className="h-full overflow-y-auto bg-background flex items-center justify-center">
        <div
          className="text-sm text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          Missing case id in route.
        </div>
      </div>
    );
  }

  if (confirmedDraft) {
    return <ConfirmedState draft={confirmedDraft} />;
  }

  if (!isDemo && (loading || !draft) && !error) {
    return <GeneratingState caseId={caseId} />;
  }

  if (!isDemo && error && !draft) {
    return (
      <ErrorState
        caseId={caseId}
        errorMessage={error.message}
        busy={busy}
        onRegenerate={async () => {
          setBusy(true);
          setActionError(null);
          try {
            await createPcrDraft(caseId);
            refetch();
            setShowGenerating(true);
          } catch (e) {
            setActionError(e instanceof Error ? e.message : 'Regenerate failed');
          } finally {
            setBusy(false);
          }
        }}
        onWriteManually={() => setForcedManualWrite(true)}
      />
    );
  }

  // At this point draft is guaranteed (either demo or remote).
  if (!draft) {
    return <GeneratingState caseId={caseId} />;
  }

  if (showGenerating || demoGenerating || (!isDemo && isGenerating)) {
    return <GeneratingState caseId={caseId} />;
  }

  // Drafter wrote an error onto the draft itself.
  if (draft.error && !forcedManualWrite) {
    return (
      <ErrorState
        caseId={caseId}
        errorMessage={draft.error}
        busy={busy}
        onRegenerate={async () => {
          setBusy(true);
          setActionError(null);
          try {
            await createPcrDraft(caseId);
            refetch();
            setShowGenerating(true);
          } catch (e) {
            setActionError(e instanceof Error ? e.message : 'Regenerate failed');
          } finally {
            setBusy(false);
          }
        }}
        onWriteManually={() => setForcedManualWrite(true)}
      />
    );
  }

  const draftForEditor: PCRDraft = forcedManualWrite
    ? { ...draft, draft_markdown: PCR_BLANK_TEMPLATE, error: null }
    : draft;

  return (
    <EditorState
      caseId={caseId}
      draft={draftForEditor}
      isDemo={isDemo}
      busy={busy}
      errorBanner={actionError}
      onConfirm={async (editedText) => {
        setBusy(true);
        setActionError(null);
        try {
          if (isDemo) {
            const fake: PCRDraft = {
              ...demoDraft,
              draft_markdown: editedText,
              status: 'confirmed',
              confirmed_by: 'demo-emt',
              confirmed_at: new Date().toISOString(),
              emt_edits_made: editedText !== demoDraft.draft_markdown,
              unconfirmed_count: countUnconfirmed(editedText),
            };
            setConfirmedDraft(fake);
          } else {
            const next = await confirmPcrDraft(caseId, editedText);
            setConfirmedDraft(next);
          }
        } catch (e) {
          setActionError(e instanceof Error ? e.message : 'Confirm failed');
        } finally {
          setBusy(false);
        }
      }}
      onRegenerate={async () => {
        setBusy(true);
        setActionError(null);
        try {
          if (isDemo) {
            // Demo: reset the editor to the original demo body and replay
            // the generating diagram for the same window.
            setDemoDraft({ ...DEMO_DRAFT, generated_at: new Date().toISOString() });
            setForcedManualWrite(false);
            setDemoGenerating(true);
          } else {
            await createPcrDraft(caseId);
            refetch();
            setForcedManualWrite(false);
            setShowGenerating(true);
          }
        } catch (e) {
          setActionError(e instanceof Error ? e.message : 'Regenerate failed');
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
