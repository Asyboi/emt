import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useIncident } from '../../data/hooks';
import { getDataSource } from '../../data/source';
import { useProcessingStream } from '../../data/sse';
import type { PipelineStage, PipelineStatus } from '../../types/backend';
import type { AgentStatus, AgentTile, PipelineFinding } from '../../types';

// ── Design tokens (resolved from theme.css :root) ────────────────────────────
const C_SUCCESS = 'var(--success)';
const C_PRIMARY = 'var(--primary)';
const C_BORDER = 'var(--border)';
const C_MUTED = 'var(--text-2)';
const C_SURFACE = 'var(--surface)';
const C_SUBCARD = 'var(--subcard)';

// ── Stage configuration (data-driven 8-card grid) ─────────────────────────────
interface StageDef {
  stage: PipelineStage;
  label: string;
  model: string;
  row: 'parallel' | 'sequential';
}

const STAGE_CONFIG: StageDef[] = [
  { stage: 'cad_parsing',    label: 'CAD SYNC',       model: 'Haiku 4.5',         row: 'parallel' },
  { stage: 'pcr_parsing',    label: 'ePCR PARSER',    model: 'Haiku 4.5',         row: 'parallel' },
  { stage: 'video_analysis', label: 'VIDEO ANALYSIS', model: 'Gemini 2.5 Flash',  row: 'parallel' },
  { stage: 'audio_analysis', label: 'AUDIO ANALYSIS', model: 'Scribe v1 + Haiku', row: 'parallel' },
  { stage: 'reconciliation', label: 'RECONCILIATION', model: 'Sonnet 4.6',        row: 'sequential' },
  { stage: 'protocol_check', label: 'PROTOCOL CHECK', model: 'Sonnet 4.6',        row: 'sequential' },
  { stage: 'findings',       label: 'FINDINGS',       model: 'Sonnet 4.6',        row: 'sequential' },
  { stage: 'drafting',       label: 'REPORT DRAFTER', model: 'Sonnet 4.6',        row: 'sequential' },
];

const PARALLEL_STAGES = STAGE_CONFIG.filter((s) => s.row === 'parallel');
const SEQUENTIAL_STAGES = STAGE_CONFIG.filter((s) => s.row === 'sequential');

const RECON_SUB_STEP_MS = 2000;

const SUB_TILE_DEFS: { id: string; shortName: string; model?: string; rulesBased?: boolean }[] = [
  { id: 'cluster', shortName: 'CLUSTER EVENTS', model: 'Haiku 4.5' },
  { id: 'review', shortName: 'REVIEW CLUSTERS', rulesBased: true },
  { id: 'critic', shortName: 'CRITIQUE TIMELINE', model: 'Sonnet 4.6' },
];

function pipelineStatusToAgentStatus(s: PipelineStatus | undefined): AgentStatus {
  if (s === 'complete') return 'complete';
  if (s === 'running') return 'active';
  return 'waiting';
}

// ── Sub-agent tile (inside reconciliation card) ───────────────────────────────
function SubTile({ sa }: { sa: AgentTile }) {
  const bl = sa.status === 'complete' ? C_SUCCESS : sa.status === 'active' ? C_PRIMARY : C_MUTED;
  const blW = sa.status === 'waiting' ? '1px' : '2px';
  const blS = sa.status === 'waiting' ? 'dashed' : 'solid';
  return (
    <div
      className="flex flex-col flex-1 rounded-sm overflow-hidden"
      style={{
        background: C_SUBCARD,
        padding: '8px 10px',
        gap: 4,
        minWidth: 0,
        border: `1px solid ${C_BORDER}`,
        borderLeft: `${blW} ${blS} ${bl}`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text)',
          }}
        >
          {sa.shortName}
        </span>
        {sa.status === 'complete' && (
          <Check style={{ width: 11, height: 11, color: C_SUCCESS, flexShrink: 0 }} />
        )}
        {sa.status === 'active' && (
          <Loader2
            style={{ width: 11, height: 11, color: C_PRIMARY, flexShrink: 0 }}
            className="animate-spin"
          />
        )}
        {sa.status === 'waiting' && (
          <Circle style={{ width: 11, height: 11, color: C_MUTED, flexShrink: 0 }} />
        )}
      </div>
      {sa.rulesBased ? (
        <span
          className="inline-block self-start px-1.5 rounded-sm"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.07em',
            background: C_BORDER,
            color: 'var(--text-2)',
          }}
        >
          RULE-BASED
        </span>
      ) : sa.model ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C_MUTED }}>
          {sa.model}
        </span>
      ) : null}
    </div>
  );
}

// ── Standard stage card ───────────────────────────────────────────────────────
function StageCard({
  label,
  model,
  status,
}: {
  label: string;
  model: string;
  status: AgentStatus;
}) {
  const accent = status === 'complete' ? C_SUCCESS : status === 'active' ? C_PRIMARY : C_MUTED;
  const stat =
    status === 'complete'
      ? 'Complete'
      : status === 'active'
        ? 'Running…'
        : 'Waiting';
  return (
    <div
      className="w-full text-left rounded-sm transition-all"
      style={{
        minHeight: 104,
        background: C_SURFACE,
        boxSizing: 'border-box',
        border: `1px solid ${C_BORDER}`,
        borderLeft: `3px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 14px',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.09em',
            }}
          >
            {label}
          </span>
          <span
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: C_MUTED, flexShrink: 0 }}
          >
            · {model}
          </span>
        </div>
        {status === 'complete' && (
          <Check style={{ width: 14, height: 14, color: C_SUCCESS, flexShrink: 0 }} />
        )}
        {status === 'active' && (
          <Loader2
            style={{ width: 14, height: 14, color: C_PRIMARY, flexShrink: 0 }}
            className="animate-spin"
          />
        )}
        {status === 'waiting' && (
          <Circle style={{ width: 14, height: 14, color: C_MUTED, flexShrink: 0 }} />
        )}
      </div>
      <div style={{ borderTop: `1px solid ${C_BORDER}` }} />
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {status === 'active' && (
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse flex-shrink-0"
            style={{ background: C_PRIMARY }}
          />
        )}
        {stat}
      </div>
    </div>
  );
}

// ── Reconciliation card (with 3 sub-tiles) ────────────────────────────────────
function ReconciliationCard({
  status,
  subTiles,
}: {
  status: AgentStatus;
  subTiles: AgentTile[];
}) {
  const accent = status === 'complete' ? C_SUCCESS : status === 'active' ? C_PRIMARY : C_MUTED;
  const completeCount = subTiles.filter((s) => s.status === 'complete').length;
  return (
    <div
      className="w-full rounded-sm"
      style={{
        background: C_SURFACE,
        boxSizing: 'border-box',
        border: `1px solid ${C_BORDER}`,
        borderLeft: `3px solid ${accent}`,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.09em',
            }}
          >
            RECONCILIATION
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: C_MUTED }}>
            · Orchestrator · Sonnet 4.6
          </span>
        </div>
        {status === 'complete' && (
          <Check style={{ width: 14, height: 14, color: C_SUCCESS, flexShrink: 0 }} />
        )}
        {status === 'active' && (
          <Loader2
            style={{ width: 14, height: 14, color: C_PRIMARY, flexShrink: 0 }}
            className="animate-spin"
          />
        )}
        {status === 'waiting' && (
          <Circle style={{ width: 14, height: 14, color: C_MUTED, flexShrink: 0 }} />
        )}
      </div>

      {status === 'active' && (
        <div
          className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-sm"
          style={{
            background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: C_PRIMARY, display: 'inline-block' }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: C_PRIMARY,
              letterSpacing: '0.08em',
            }}
          >
            RUNNING · {completeCount}/{subTiles.length} SUB-AGENTS COMPLETE
          </span>
        </div>
      )}

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: C_MUTED,
          letterSpacing: '0.14em',
        }}
      >
        SUB-AGENT CHAIN
      </div>

      <div className="flex items-stretch gap-2 flex-wrap" style={{ minHeight: 0 }}>
        {subTiles.map((tile) => (
          <SubTile key={tile.id} sa={tile} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Processing() {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const demoFlag = searchParams.get('demo') === '1';

  const isRemote = useMemo(() => getDataSource().mode === 'remote', []);

  const localIncident = useIncident(isRemote ? undefined : caseId);
  const remoteState = useProcessingStream(isRemote ? caseId : undefined, { demo: demoFlag });

  // Auto-navigate to review on completion (remote only).
  useEffect(() => {
    if (isRemote && remoteState.isComplete && caseId) {
      const t = window.setTimeout(() => navigate(`/review/${caseId}`), 2000);
      return () => window.clearTimeout(t);
    }
  }, [isRemote, remoteState.isComplete, caseId, navigate]);

  // Reconciliation sub-tile timed sequence.
  // Index meaning: -1 = all waiting, 0..2 = that index active (lower indices complete),
  // 3 = all complete. The timed chain advances on `running`; on `complete` jumps to 3.
  const reconBackendStatus = isRemote
    ? remoteState.stages.get('reconciliation')?.status
    : 'complete';
  const [reconSubIdx, setReconSubIdx] = useState<number>(-1);

  useEffect(() => {
    if (!isRemote) {
      setReconSubIdx(3);
      return;
    }
    if (reconBackendStatus === 'running') {
      setReconSubIdx(0);
      const t1 = window.setTimeout(() => setReconSubIdx(1), RECON_SUB_STEP_MS);
      const t2 = window.setTimeout(() => setReconSubIdx(2), RECON_SUB_STEP_MS * 2);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    if (reconBackendStatus === 'complete') {
      setReconSubIdx(3);
    } else {
      setReconSubIdx(-1);
    }
  }, [isRemote, reconBackendStatus]);

  function subTileStatus(idx: number): AgentStatus {
    if (reconSubIdx === -1) return 'waiting';
    if (reconSubIdx === 3) return 'complete';
    if (idx < reconSubIdx) return 'complete';
    if (idx === reconSubIdx) return 'active';
    return 'waiting';
  }

  const subTiles: AgentTile[] = SUB_TILE_DEFS.map((def, i) => ({
    id: def.id,
    shortName: def.shortName,
    model: def.model,
    rulesBased: def.rulesBased,
    status: subTileStatus(i),
  }));

  // Resolve stage status for any pipeline stage.
  function getStageStatus(stage: PipelineStage): AgentStatus {
    if (!isRemote) return 'complete';
    return pipelineStatusToAgentStatus(remoteState.stages.get(stage)?.status);
  }

  // Header values
  const elapsed = isRemote
    ? remoteState.elapsedSeconds
    : (localIncident.data?.pipeline.elapsedSeconds ?? 0);
  const progress = isRemote
    ? remoteState.progressPct
    : (localIncident.data?.pipeline.progressPct ?? 100);
  const overallStatus = isRemote
    ? remoteState.error
      ? 'ERROR'
      : remoteState.isComplete
        ? 'COMPLETE'
        : 'ACTIVE'
    : 'STATIC MOCK';

  // Findings strip (live from remote review once available; mock otherwise)
  const findings: PipelineFinding[] = isRemote
    ? (remoteState.review?.pipeline.findings ?? [])
    : (localIncident.data?.pipeline.findings ?? []);

  const completeCount = isRemote
    ? Array.from(remoteState.stages.values()).filter((s) => s.status === 'complete').length
    : STAGE_CONFIG.length;
  const activeCount = isRemote
    ? Array.from(remoteState.stages.values()).filter((s) => s.status === 'running').length
    : 0;
  const flagCount = findings.filter((f) => f.type === 'warning').length;

  const hms = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Loading / error states
  if (!caseId) {
    return (
      <div role="alert" className="h-screen bg-background flex items-center justify-center px-6">
        <div className="text-sm text-foreground-secondary text-center max-w-md" style={{ fontFamily: 'var(--font-mono)' }}>
          No incident ID in this URL. Open an incident from the dashboard to begin.
        </div>
      </div>
    );
  }

  if (!isRemote && localIncident.error) {
    return (
      <div
        role="alert"
        className="h-screen bg-background flex flex-col items-center justify-center gap-2 px-6"
      >
        <div
          className="text-xs tracking-[0.15em]"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--destructive)' }}
        >
          COULDN'T LOAD INCIDENT
        </div>
        <div className="text-sm text-foreground-secondary max-w-md text-center">
          {localIncident.error.message}. Refresh to retry, or check that the backend is running on port 8000.
        </div>
      </div>
    );
  }

  if (!isRemote && (localIncident.loading || !localIncident.data)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="h-screen bg-background flex items-center justify-center"
      >
        <div className="text-sm text-foreground-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
          Loading pipeline…
        </div>
      </div>
    );
  }

  if (isRemote && remoteState.error) {
    return (
      <div
        role="alert"
        className="h-screen bg-background flex flex-col items-center justify-center gap-2 px-6"
      >
        <div
          className="text-xs tracking-[0.15em]"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--destructive)' }}
        >
          PIPELINE ERROR
        </div>
        <div
          className="text-sm text-foreground-secondary max-w-md text-center"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {remoteState.error}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1.2px, transparent 1.2px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* Header */}
      <div
        className="border-b border-border flex-shrink-0 px-10 py-4"
        style={{ background: 'rgba(250,249,245,0.92)', backdropFilter: 'blur(6px)' }}
      >
        <div className="text-center">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.15em',
              color: 'var(--text-2)',
              marginBottom: 5,
            }}
          >
            PROCESSING INCIDENT
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              letterSpacing: '0.08em',
              marginBottom: 5,
            }}
          >
            {caseId}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
            AGENT: CALYX-CORE-01
            <span style={{ margin: '0 12px' }}>|</span>
            ELAPSED: {hms(elapsed)}
            <span style={{ margin: '0 12px' }}>|</span>
            STATUS:{' '}
            <span
              style={{
                color: overallStatus === 'COMPLETE' ? C_SUCCESS : overallStatus === 'ERROR' ? 'var(--destructive)' : C_PRIMARY,
              }}
            >
              {overallStatus}
            </span>
          </div>
        </div>
        <div
          style={{
            height: 2,
            background: C_BORDER,
            position: 'relative',
            overflow: 'hidden',
            marginTop: 12,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '0 auto 0 0',
              width: `${progress}%`,
              background: C_PRIMARY,
              transition: 'width 600ms ease-out',
            }}
          />
        </div>
      </div>

      {/* Pipeline grid */}
      <div className="flex-1 flex flex-col px-10 py-6 gap-6 min-h-0 overflow-y-auto">
        {/* Row 1 — parallel extraction */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.15em',
              color: C_MUTED,
              marginBottom: 10,
            }}
          >
            PARALLEL EXTRACTION
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {PARALLEL_STAGES.map((s) => (
              <StageCard
                key={s.stage}
                label={s.label}
                model={s.model}
                status={getStageStatus(s.stage)}
              />
            ))}
          </div>
        </div>

        {/* Row 2 — sequential reasoning */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.15em',
              color: C_MUTED,
              marginBottom: 10,
            }}
          >
            SEQUENTIAL REASONING
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-stretch">
            <ReconciliationCard
              status={getStageStatus('reconciliation')}
              subTiles={subTiles}
            />
            {SEQUENTIAL_STAGES.filter((s) => s.stage !== 'reconciliation').map((s) => (
              <StageCard
                key={s.stage}
                label={s.label}
                model={s.model}
                status={getStageStatus(s.stage)}
              />
            ))}
          </div>
        </div>

        {/* Logs panel (remote: deferred placeholder; local: existing audio logs) */}
        <div
          className="rounded-sm border"
          style={{
            borderColor: C_BORDER,
            background: C_SURFACE,
            padding: '12px 14px',
            minHeight: 100,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.15em',
              color: C_MUTED,
              marginBottom: 8,
            }}
          >
            ACTIVITY LOG
          </div>
          {isRemote ? (
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Logs available after processing.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {(localIncident.data?.pipeline.audioLogs ?? []).map((log, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-2)' }}>[{log.timestamp}]</span> {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Findings Strip */}
      <div
        className="flex-shrink-0 border-t border-border flex items-center gap-0 px-10"
        style={{
          height: 50,
          background: 'rgba(250,249,245,0.92)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            color: C_MUTED,
            flexShrink: 0,
            marginRight: 14,
          }}
        >
          LIVE FINDINGS
        </span>
        {findings.slice(0, 3).map((f, i) => (
          <div key={i} className="flex items-center min-w-0">
            {i > 0 && (
              <div
                style={{ width: 1, height: 16, background: C_BORDER, margin: '0 14px', flexShrink: 0 }}
              />
            )}
            <div className="flex items-center gap-2 min-w-0">
              {f.type === 'success' ? (
                <CheckCircle2 style={{ width: 12, height: 12, color: C_SUCCESS, flexShrink: 0 }} />
              ) : (
                <AlertTriangle style={{ width: 12, height: 12, color: C_PRIMARY, flexShrink: 0 }} />
              )}
              <span
                className="truncate"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: f.type === 'success' ? C_SUCCESS : C_PRIMARY,
                  maxWidth: 280,
                }}
              >
                {f.message}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: C_MUTED,
                  flexShrink: 0,
                  marginLeft: 4,
                }}
              >
                [{f.sources}]
              </span>
            </div>
          </div>
        ))}
        {findings.length > 3 && (
          <div className="flex items-center" style={{ marginLeft: 14 }}>
            <div style={{ width: 1, height: 16, background: C_BORDER, marginRight: 14 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C_PRIMARY }}>
              (+{findings.length - 3} more)
            </span>
          </div>
        )}
        {findings.length === 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: C_MUTED }}>
            None reported yet.
          </span>
        )}
      </div>

      {/* Bottom status bar */}
      <div
        className="flex-shrink-0 border-t border-border flex items-center justify-between gap-6 px-10"
        style={{
          height: 46,
          background: 'rgba(250,249,245,0.95)',
          backdropFilter: 'blur(4px)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        <div
          className="flex items-center gap-3 flex-shrink-0 whitespace-nowrap"
          style={{ color: 'var(--text-2)' }}
        >
          <span>{STAGE_CONFIG.length} STAGES</span>
          <span style={{ color: C_BORDER }}>|</span>
          <span style={{ color: C_SUCCESS }}>{completeCount} COMPLETE</span>
          <span style={{ color: C_BORDER }}>|</span>
          <span style={{ color: C_PRIMARY }}>{activeCount} ACTIVE</span>
          <span style={{ color: C_BORDER }}>|</span>
          <span style={{ color: C_PRIMARY }}>
            {flagCount} FLAG{flagCount !== 1 ? 'S' : ''} RAISED
          </span>
        </div>
        <span className="whitespace-nowrap flex-shrink-0" style={{ color: 'var(--text-2)' }}>
          Video processed audio-first · Footage not displayed without explicit user action
        </span>
      </div>
    </div>
  );
}
