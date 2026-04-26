import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ClipboardCheck, Copy, FileText, Pencil } from 'lucide-react';

import { getPcrDraft } from '../../data/pcr-api';
import { getDataSource } from '../../data/source';
import { highlightUnconfirmed } from '../../lib/pcr-highlight';
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

const PCR_TOKEN_STYLE: React.CSSProperties = {
  background: C_HIGHLIGHT,
  color: C_HIGHLIGHT_TEXT,
  borderRadius: 2,
  padding: '0 2px',
};

// ── Page shell (header bar shared across all sub-states) ─────────────────────
function PageShell({
  caseId,
  isDemo,
  children,
}: {
  caseId: string;
  isDemo: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border px-8 py-4 flex items-center justify-between flex-shrink-0">
        <Link
          to="/"
          className="tracking-[0.2em] text-sm hover:text-primary transition-colors"
          style={{ fontFamily: FONT_MONO }}
        >
          CALYX
        </Link>
        <div
          className="flex items-center gap-3 text-xs"
          style={{ fontFamily: FONT_MONO }}
        >
          <span className="text-foreground-secondary">PCR</span>
          <span className="text-foreground-secondary">/</span>
          <span>{caseId}</span>
          {isDemo && (
            <span
              className="ml-2 px-2 py-0.5 border border-border text-[10px] tracking-wider"
              style={{ background: 'var(--surface)', color: C_MUTED }}
            >
              DEMO
            </span>
          )}
        </div>
        <Link
          to="/archive"
          className="text-sm tracking-wide hover:text-primary transition-colors"
        >
          SAVED REPORTS
        </Link>
      </div>
      {children}
    </div>
  );
}

// ── Loading sub-state ────────────────────────────────────────────────────────
function LoadingState({ caseId, isDemo }: { caseId: string; isDemo: boolean }) {
  return (
    <PageShell caseId={caseId} isDemo={isDemo}>
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
  isDemo,
  message,
}: {
  caseId: string;
  isDemo: boolean;
  message: string;
}) {
  return (
    <PageShell caseId={caseId} isDemo={isDemo}>
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
  isDemo,
  errorMessage,
}: {
  caseId: string;
  isDemo: boolean;
  errorMessage: string;
}) {
  return (
    <PageShell caseId={caseId} isDemo={isDemo}>
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

// ── Read-only PCR view ───────────────────────────────────────────────────────
function ReadOnlyPcr({
  caseId,
  isDemo,
  draft,
}: {
  caseId: string;
  isDemo: boolean;
  draft: PCRDraft;
}) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const highlighted = useMemo(
    () => highlightUnconfirmed(draft.draft_markdown, { tokenStyle: PCR_TOKEN_STYLE }),
    [draft.draft_markdown]
  );

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
    <PageShell caseId={caseId} isDemo={isDemo}>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[800px] px-6 py-8">
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

          {/* Body */}
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
              {highlighted}
            </pre>
          </div>

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
    return <LoadingState caseId={caseId} isDemo={isDemo} />;
  }

  if (error) {
    return <PageErrorState caseId={caseId} isDemo={isDemo} errorMessage={error} />;
  }

  if (!draft) {
    return (
      <PageErrorState
        caseId={caseId}
        isDemo={isDemo}
        errorMessage="No PCR draft was returned by the server."
      />
    );
  }

  if (draft.status !== 'confirmed') {
    return (
      <NotConfirmedState
        caseId={caseId}
        isDemo={isDemo}
        message="This PCR has not been confirmed yet. Open the draft to review and confirm it."
      />
    );
  }

  return <ReadOnlyPcr caseId={caseId} isDemo={isDemo} draft={draft} />;
}
