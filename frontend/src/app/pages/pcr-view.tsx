import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ClipboardCheck, Copy, FileText, Pencil } from 'lucide-react';

import { getPcrDraft } from '../../data/pcr-api';
import { getDataSource } from '../../data/source';
import { highlightUnconfirmed, parsePcrSections } from '../../lib/pcr-highlight';
import type { PCRDraft } from '../../types/backend';

// ── Design tokens (resolved from theme.css :root) ────────────────────────────
const C_SUCCESS = 'var(--success)';
const C_PRIMARY = 'var(--primary)';
const C_MUTED = 'var(--text-2)';
const C_HIGHLIGHT = 'color-mix(in srgb, var(--primary) 18%, transparent)';
const C_HIGHLIGHT_TEXT = 'var(--primary-strong)';

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

const DEMO_CONFIRMED_DRAFT: PCRDraft = {
  case_id: 'case_01',
  generated_at: new Date('2026-04-25T15:30:00Z').toISOString(),
  status: 'confirmed',
  video_event_count: 12,
  audio_event_count: 8,
  total_event_count: 20,
  draft_markdown: DEMO_PCR_MARKDOWN,
  unconfirmed_count: (DEMO_PCR_MARKDOWN.match(/\[UNCONFIRMED\]/g) ?? []).length,
  confirmed_by: 'demo-emt',
  confirmed_at: new Date('2026-04-25T15:42:00Z').toISOString(),
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

// ── Page shell (header bar shared across all sub-states) ─────────────────────
function PageShell({
  caseId,
  children,
}: {
  caseId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div
        className="border-b border-border px-8 py-3 flex items-center gap-3 text-[11px] tracking-[0.15em] text-foreground-secondary flex-shrink-0"
        style={{ fontFamily: FONT_MONO }}
      >
        <span>PCR</span>
        <span>/</span>
        <span className="text-foreground">{caseId}</span>
      </div>
      {children}
    </div>
  );
}

// ── Loading sub-state ────────────────────────────────────────────────────────
function LoadingState({ caseId }: { caseId: string }) {
  return (
    <PageShell caseId={caseId} >
      <div className="flex-1 flex items-center justify-center">
        <div
          className="text-xs tracking-wide text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          Loading PCR…
        </div>
      </div>
    </PageShell>
  );
}

// ── Not-confirmed sub-state ──────────────────────────────────────────────────
function NotConfirmedState({
  caseId,
  message,
}: {
  caseId: string;
  message: string;
}) {
  return (
    <PageShell caseId={caseId} >
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[460px] bg-surface border border-border p-8 text-center">
          <FileText
            className="mx-auto mb-4"
            style={{ width: 28, height: 28, color: C_MUTED }}
          />
          <h2
            className="text-xs tracking-[0.18em] mb-3"
            style={{ fontFamily: 'var(--font-sans)', color: 'var(--text)' }}
          >
            PCR NOT YET CONFIRMED
          </h2>
          <p
            className="text-xs leading-relaxed text-foreground-secondary mb-6"
            style={{ fontFamily: FONT_MONO }}
          >
            {message}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              to={`/pcr-draft/${caseId}`}
              className="px-4 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-opacity"
            >
              GO TO DRAFT
            </Link>
            <Link
              to="/archive"
              className="px-4 py-2.5 border border-border text-sm tracking-wide hover:bg-surface transition-colors"
            >
              BACK TO ARCHIVE
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ── Error sub-state ──────────────────────────────────────────────────────────
function PageErrorState({
  caseId,
  errorMessage,
}: {
  caseId: string;
  errorMessage: string;
}) {
  return (
    <PageShell caseId={caseId} >
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[460px] bg-surface border border-border p-8 text-center">
          <h2
            className="text-xs tracking-[0.18em] mb-3"
            style={{ fontFamily: 'var(--font-sans)', color: 'var(--destructive)' }}
          >
            COULD NOT LOAD PCR
          </h2>
          <p
            className="text-xs leading-relaxed text-foreground-secondary mb-6"
            style={{ fontFamily: FONT_MONO }}
          >
            {errorMessage}
          </p>
          <Link
            to="/archive"
            className="inline-block px-4 py-2.5 border border-border text-sm tracking-wide hover:bg-surface transition-colors"
          >
            BACK TO ARCHIVE
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

// ── Structured PCR renderer ──────────────────────────────────────────────────
// Parses a section body into typed rows and renders each with appropriate
// typography. Beats <pre> markdown soup: field rows align as a definition
// list, timestamped events read as a log, free prose flows as paragraphs.

const FIELD_LINE = /^([A-Z][A-Za-z #/.\-]{0,30}):\s{2,}(.+)$/;
const TIME_LINE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;

type SectionRow =
  | { kind: 'field'; label: string; value: string }
  | { kind: 'event'; time: string; text: string }
  | { kind: 'paragraph'; text: string };

function parseSectionBody(content: string): SectionRow[] {
  const lines = content.split('\n').map((l) => l.trimEnd());
  const rows: SectionRow[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    const joined = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) rows.push({ kind: 'paragraph', text: joined });
    buffer = [];
  };

  for (const raw of lines) {
    if (!raw.trim()) {
      flushParagraph();
      continue;
    }
    const fm = FIELD_LINE.exec(raw);
    if (fm) {
      flushParagraph();
      rows.push({ kind: 'field', label: fm[1].trim(), value: fm[2].trim() });
      continue;
    }
    const tm = TIME_LINE.exec(raw);
    if (tm) {
      flushParagraph();
      rows.push({ kind: 'event', time: tm[1], text: tm[2].trim() });
      continue;
    }
    buffer.push(raw);
  }
  flushParagraph();
  return rows;
}

const VALUE_TOKEN_STYLE = {
  background: C_HIGHLIGHT,
  color: C_HIGHLIGHT_TEXT,
  borderRadius: 2,
  padding: '0 3px',
};

function FormattedPcr({ text }: { text: string }) {
  const sections = useMemo(() => parsePcrSections(text), [text]);

  return (
    <article className="bg-surface border border-border" style={{ background: 'var(--surface)' }}>
      {sections.map((section, i) => (
        <PcrSection
          key={`${section.startLine}-${i}`}
          header={section.header}
          rows={parseSectionBody(section.content)}
          isLast={i === sections.length - 1}
        />
      ))}
    </article>
  );
}

function PcrSection({
  header,
  rows,
  isLast,
}: {
  header: string;
  rows: SectionRow[];
  isLast: boolean;
}) {
  return (
    <section
      style={{
        padding: '24px 28px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
      }}
    >
      <h3
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          color: 'var(--text)',
          marginBottom: 16,
          textTransform: 'uppercase',
        }}
      >
        {header}
      </h3>

      <div className="flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <SectionRowView key={i} row={row} />
        ))}
      </div>
    </section>
  );
}

function SectionRowView({ row }: { row: SectionRow }) {
  if (row.kind === 'field') {
    return (
      <div
        className="grid items-baseline"
        style={{
          gridTemplateColumns: 'minmax(120px, 160px) 1fr',
          columnGap: 20,
        }}
      >
        <dt
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-2)',
          }}
        >
          {row.label}
        </dt>
        <dd
          style={{
            fontSize: 14,
            color: 'var(--text)',
            lineHeight: 1.45,
          }}
        >
          {highlightUnconfirmed(row.value, { tokenStyle: VALUE_TOKEN_STYLE })}
        </dd>
      </div>
    );
  }

  if (row.kind === 'event') {
    return (
      <div
        className="grid items-baseline"
        style={{
          gridTemplateColumns: 'minmax(80px, auto) 1fr',
          columnGap: 16,
          paddingLeft: 0,
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: 'var(--primary-strong)',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {row.time}
        </span>
        <span
          style={{
            fontSize: 14,
            color: 'var(--text)',
            lineHeight: 1.5,
          }}
        >
          {highlightUnconfirmed(row.text, { tokenStyle: VALUE_TOKEN_STYLE })}
        </span>
      </div>
    );
  }

  // Paragraph
  return (
    <p
      style={{
        fontSize: 14.5,
        color: 'var(--text)',
        lineHeight: 1.6,
        maxWidth: '70ch',
      }}
    >
      {highlightUnconfirmed(row.text, { tokenStyle: VALUE_TOKEN_STYLE })}
    </p>
  );
}

// ── Read-only PCR view ───────────────────────────────────────────────────────
function ReadOnlyPcr({
  caseId,
  draft,
}: {
  caseId: string;
  draft: PCRDraft;
}) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const navigate = useNavigate();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft.draft_markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard write can fail in non-secure contexts — fall through silently.
    }
  };

  return (
    <PageShell caseId={caseId} >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1120px] px-8 py-8">
          {/* Header card */}
          <header className="bg-surface border border-border p-6 mb-5">
            <div
              className="text-[10px] tracking-[0.18em] text-foreground-secondary mb-2"
              style={{ fontFamily: FONT_MONO }}
            >
              PATIENT CARE REPORT
            </div>
            <div
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4"
              style={{ fontFamily: FONT_MONO }}
            >
              <span className="text-base">{caseId}</span>
              <span className="text-xs text-foreground-secondary">
                CONFIRMED · {formatTimestamp(draft.confirmed_at)}
              </span>
              <span className="text-xs text-foreground-secondary">
                BY · {draft.confirmed_by ?? '—'}
              </span>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span
                className="px-2 py-1 text-[10px] tracking-wider rounded-sm"
                style={{
                  fontFamily: FONT_MONO,
                  background: 'rgba(61,90,61,0.10)',
                  color: C_SUCCESS,
                  border: `1px solid rgba(61,90,61,0.28)`,
                }}
              >
                CONFIRMED
              </span>
              {draft.unconfirmed_count > 0 && (
                <span
                  className="px-2 py-1 text-[10px] tracking-wider rounded-sm"
                  style={{
                    fontFamily: FONT_MONO,
                    background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                    color: C_PRIMARY,
                    border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
                  }}
                >
                  {draft.unconfirmed_count} UNCONFIRMED REMAINING
                </span>
              )}
              {draft.emt_edits_made && (
                <span
                  className="px-2 py-1 text-[10px] tracking-wider rounded-sm"
                  style={{
                    fontFamily: FONT_MONO,
                    background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                    color: 'var(--primary-strong)',
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                  }}
                >
                  EMT EDITED
                </span>
              )}
            </div>

            {/* Evidence stats */}
            <dl
              className="grid grid-cols-3 gap-x-4 text-xs"
              style={{ fontFamily: FONT_MONO }}
            >
              <div>
                <dt className="text-[10px] tracking-wider text-foreground-secondary mb-1">
                  VIDEO EVENTS
                </dt>
                <dd>{draft.video_event_count}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-foreground-secondary mb-1">
                  AUDIO EVENTS
                </dt>
                <dd>{draft.audio_event_count}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-foreground-secondary mb-1">
                  TOTAL EVENTS
                </dt>
                <dd>{draft.total_event_count}</dd>
              </div>
            </dl>
          </header>

          {/* View toggle */}
          <div
            role="tablist"
            aria-label="PCR view mode"
            className="flex items-center gap-0 mb-3"
          >
            {(['preview', 'code'] as const).map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setViewMode(mode)}
                  className="transition-colors"
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10.5,
                    letterSpacing: '0.16em',
                    padding: '7px 14px',
                    border: '1px solid var(--border)',
                    borderRight: mode === 'preview' ? 'none' : '1px solid var(--border)',
                    background: active ? 'var(--text)' : 'transparent',
                    color: active ? 'var(--surface)' : 'var(--text-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {mode}
                </button>
              );
            })}
          </div>

          {/* Body — structured template OR raw markdown, depending on toggle */}
          {viewMode === 'preview' ? (
            <FormattedPcr text={draft.draft_markdown} />
          ) : (
            <div
              className="bg-surface border border-border"
              style={{ background: 'var(--surface)' }}
            >
              <pre
                className="m-0 overflow-x-auto"
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                  lineHeight: 1.55,
                  padding: 20,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  color: 'var(--text)',
                }}
              >
                {highlightUnconfirmed(draft.draft_markdown, {
                  tokenStyle: {
                    background: C_HIGHLIGHT,
                    color: C_HIGHLIGHT_TEXT,
                    borderRadius: 2,
                    padding: '0 2px',
                  },
                })}
              </pre>
            </div>
          )}

          {/* Action bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/archive"
              className="px-4 py-2.5 border border-border text-sm tracking-wide hover:bg-surface transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK TO ARCHIVE
            </Link>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2.5 border border-border text-sm tracking-wide hover:bg-surface transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <ClipboardCheck className="w-4 h-4" style={{ color: C_SUCCESS }} />
                    COPIED
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    COPY
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/pcr-draft/${caseId}`)}
                className="px-4 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                EDIT
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ── Top-level page ───────────────────────────────────────────────────────────
export function PcrView() {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams] = useSearchParams();

  const isDemo =
    searchParams.get('demo') === '1' || getDataSource().mode === 'local';

  const [draft, setDraft] = useState<PCRDraft | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    if (isDemo) {
      setDraft({ ...DEMO_CONFIRMED_DRAFT, case_id: caseId });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getPcrDraft(caseId)
      .then((d) => {
        if (!cancelled) {
          setDraft(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load PCR');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, isDemo]);

  if (!caseId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="text-sm text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          Missing case id in route.
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingState caseId={caseId} />;
  }

  if (error) {
    return <PageErrorState caseId={caseId} errorMessage={error} />;
  }

  if (!draft) {
    return (
      <PageErrorState
        caseId={caseId}
        errorMessage="No PCR draft was returned by the server."
      />
    );
  }

  if (draft.status !== 'confirmed') {
    return (
      <NotConfirmedState
        caseId={caseId}
        message="This PCR has not been confirmed yet. Open the draft to review and confirm it."
      />
    );
  }

  return <ReadOnlyPcr caseId={caseId} draft={draft} />;
}
