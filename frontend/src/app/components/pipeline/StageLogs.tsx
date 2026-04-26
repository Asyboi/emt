import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PipelineStage } from '../../../types/backend';
import { StatusIcon } from './StatusIcon';
import type { AgentVizStatus } from './types';

type LogLevel = 'system' | 'action' | 'reasoning' | 'finding' | 'warning';

interface LogEntry {
  atMs: number;
  level: LogLevel;
  text: string;
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  cad_parsing: 'CAD sync',
  pcr_parsing: 'ePCR parser',
  video_analysis: 'Video analysis',
  audio_analysis: 'Audio analysis',
  reconciliation: 'Reconciliation',
  protocol_check: 'Protocol check',
  findings: 'Findings',
  drafting: 'Report drafting',
  pcr_drafting: 'PCR auto-draft',
};

// Per-stage scripted log feed. atMs = offset from when the stage entered
// `running`. The panel reveals entries progressively while the stage is
// live and shows the complete list once it's done.
const STAGE_LOGS: Record<PipelineStage, LogEntry[]> = {
  cad_parsing: [
    { atMs: 0, level: 'system', text: 'Loading cad.json from /cases/case_01' },
    { atMs: 250, level: 'action', text: 'Parsing CAD record (Pydantic v2)' },
    { atMs: 600, level: 'reasoning', text: 'Validating dispatch_response_seconds against incident_datetime' },
    { atMs: 950, level: 'finding', text: 'protocol_families = ["cardiac_arrest"]' },
    { atMs: 1300, level: 'system', text: 'CAD record hydrated · 12 fields populated' },
  ],
  pcr_parsing: [
    { atMs: 0, level: 'system', text: 'Loading pcr.md (8.2 KB)' },
    { atMs: 350, level: 'action', text: 'Claude Haiku 4.5 → extract_events tool call' },
    { atMs: 1100, level: 'reasoning', text: 'Detected 3 medication administrations' },
    { atMs: 1500, level: 'reasoning', text: 'Detected 5 vital sign captures' },
    { atMs: 1900, level: 'finding', text: '14 events extracted from PCR narrative' },
    { atMs: 2200, level: 'system', text: 'PCR parser complete' },
  ],
  video_analysis: [
    { atMs: 0, level: 'system', text: 'Streaming video.mp4 → Gemini 2.5 Flash' },
    { atMs: 600, level: 'action', text: 'Sampling frames at 1Hz with audio context' },
    { atMs: 1500, level: 'reasoning', text: 'Detected airway management at 04:12' },
    { atMs: 2200, level: 'reasoning', text: 'Detected defibrillation at 06:44' },
    { atMs: 2800, level: 'finding', text: '11 timestamped events from video' },
    { atMs: 3100, level: 'system', text: 'Video analysis complete' },
  ],
  audio_analysis: [
    { atMs: 0, level: 'system', text: 'POST audio.mp3 → ElevenLabs Scribe v1' },
    { atMs: 850, level: 'action', text: 'Transcript returned · 4:32 audio · 612 tokens' },
    { atMs: 1300, level: 'action', text: 'Claude Haiku 4.5 → extract events from transcript' },
    { atMs: 2200, level: 'finding', text: '7 events extracted from audio' },
    { atMs: 2600, level: 'system', text: 'Audio analysis complete' },
  ],
  reconciliation: [
    { atMs: 0, level: 'system', text: 'Aggregating 38 events from 4 sources' },
    { atMs: 400, level: 'action', text: 'Cluster agent (Haiku) · semantic grouping' },
    { atMs: 1900, level: 'finding', text: '12 clusters identified' },
    { atMs: 2200, level: 'action', text: 'Review agent (Haiku) ×12 · gather() · sem(3)' },
    { atMs: 4200, level: 'reasoning', text: 'Cluster c004 · 28s spread across PCR/video — disputed' },
    { atMs: 4600, level: 'reasoning', text: 'Cluster c007 · PCR-only intervention — disputed' },
    { atMs: 5100, level: 'reasoning', text: 'Cluster c011 · type mismatch — disputed' },
    { atMs: 5500, level: 'system', text: 'Dispute gate · 3 of 12 escalated to critic' },
    { atMs: 5800, level: 'action', text: 'Critic agent (Sonnet 4.6) · verifying disputes' },
    { atMs: 8200, level: 'reasoning', text: 'c004 → keep PCR · c007 → phantom · c011 → resolved' },
    { atMs: 8800, level: 'finding', text: 'Final timeline · 11 verified entries' },
    { atMs: 9400, level: 'system', text: 'Reconciliation complete' },
  ],
  protocol_check: [
    { atMs: 0, level: 'system', text: 'Loading protocol family · cardiac_arrest' },
    { atMs: 450, level: 'action', text: 'Matching timeline against 8 protocol steps (rule-based)' },
    { atMs: 1000, level: 'finding', text: '6 adherent · 2 deviations · epi timing + rhythm gap' },
    { atMs: 1500, level: 'system', text: 'Protocol check complete' },
  ],
  findings: [
    { atMs: 0, level: 'system', text: 'Synthesizing findings · Sonnet 4.6 · no fallback' },
    { atMs: 450, level: 'action', text: 'Cross-referencing protocol gaps with timeline' },
    { atMs: 1100, level: 'finding', text: 'CRITICAL · epinephrine administered 4m late' },
    { atMs: 1500, level: 'finding', text: 'CONCERN · 6m rhythm check gap (07:42 → 13:50)' },
    { atMs: 1900, level: 'finding', text: 'INFO · documentation completeness 0.82' },
    { atMs: 2200, level: 'system', text: 'Findings complete · 3 entries' },
  ],
  drafting: [
    { atMs: 0, level: 'system', text: 'Wave 1 · gather() spawning 3 sub-agents' },
    { atMs: 100, level: 'action', text: 'Header agent (Haiku) · summary + crew + Utstein' },
    { atMs: 200, level: 'action', text: 'Clinical agent (Haiku) · per-category benchmarks' },
    { atMs: 300, level: 'action', text: 'DocQuality agent (Haiku) · completeness / accuracy / narrative' },
    { atMs: 2700, level: 'finding', text: 'Wave 1 complete · 6 met / 2 not_met' },
    { atMs: 3000, level: 'system', text: 'compute_determination() → PERFORMANCE_CONCERN' },
    { atMs: 4500, level: 'system', text: 'Wave 2 · gather() spawning 2 sub-agents' },
    { atMs: 4600, level: 'action', text: 'Recommendations agent (Haiku) · crew/agency/follow_up' },
    { atMs: 4700, level: 'action', text: 'Rationale agent (Haiku) · determination prose' },
    { atMs: 6500, level: 'finding', text: 'Wave 2 complete · 4 recommendations + rationale' },
    { atMs: 6900, level: 'system', text: 'QI Case Review assembled' },
  ],
  pcr_drafting: [],
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  system: 'var(--text-2)',
  action: 'var(--primary-strong)',
  reasoning: 'var(--text)',
  finding: 'var(--success)',
  warning: 'var(--destructive)',
};

interface StageLogsProps {
  stage: PipelineStage;
  status: AgentVizStatus;
  /** ISO timestamp from the stream when this stage started running. */
  startedAt?: string;
  modelLabel?: string;
  onClose: () => void;
}

export function StageLogs({
  stage,
  status,
  startedAt,
  modelLabel,
  onClose,
}: StageLogsProps) {
  const allLogs = STAGE_LOGS[stage] ?? [];
  const startedAtMs = useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : null),
    [startedAt],
  );

  const [tick, setTick] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Tick while live so visible-log filter recomputes against wall clock.
  useEffect(() => {
    if (status !== 'running') return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const visibleLogs = useMemo(() => {
    if (status === 'pending') return [];
    if (status === 'complete' || status === 'error') return allLogs;
    if (status === 'running' && startedAtMs !== null) {
      const elapsed = Date.now() - startedAtMs;
      return allLogs.filter((l) => l.atMs <= elapsed);
    }
    // running with no startedAt — show nothing yet
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, startedAtMs, allLogs, tick]);

  // Auto-scroll to bottom when new entries arrive.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [visibleLogs.length]);

  const statusLabel =
    status === 'running'
      ? 'live'
      : status === 'complete'
        ? 'complete'
        : status === 'error'
          ? 'error'
          : 'pending';

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'color-mix(in srgb, var(--text) 22%, transparent)',
          zIndex: 50,
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={`${STAGE_LABELS[stage]} log feed`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: '100vw',
          background: 'var(--surface)',
          borderLeft: `1px solid var(--border)`,
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 18px',
            borderBottom: `1px solid var(--border)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
            <StatusIcon status={status} size={16} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text)',
                  letterSpacing: 0.1,
                }}
              >
                {STAGE_LABELS[stage]}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-2)',
                  marginTop: 2,
                  letterSpacing: 0.05,
                }}
              >
                <span
                  style={{
                    color:
                      status === 'running'
                        ? 'var(--primary-strong)'
                        : status === 'complete'
                          ? 'var(--success)'
                          : status === 'error'
                            ? 'var(--destructive)'
                            : 'var(--text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {statusLabel}
                </span>
                {modelLabel && (
                  <>
                    <span style={{ margin: '0 6px', color: 'var(--border)' }}>·</span>
                    <span>{modelLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            type="button"
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: 6,
              color: 'var(--text-2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Live indicator */}
        {status === 'running' && (
          <div
            style={{
              padding: '8px 18px',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--primary-strong)',
              borderBottom: `1px solid var(--border)`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              className="animate-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: 0,
                background: 'var(--primary)',
                display: 'inline-block',
              }}
            />
            <span>
              Streaming · {visibleLogs.length} of {allLogs.length} events
            </span>
          </div>
        )}

        {/* Log feed */}
        <div
          ref={bodyRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 18px',
            background: 'var(--background)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1.55,
          }}
        >
          {visibleLogs.length === 0 ? (
            <div
              style={{
                color: 'var(--text-2)',
                fontStyle: 'italic',
                padding: '14px 0',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
              }}
            >
              {status === 'pending'
                ? 'Stage has not started yet. Logs will stream once the pipeline reaches it.'
                : 'Awaiting events…'}
            </div>
          ) : (
            visibleLogs.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '52px 10px 1fr',
                  gap: 6,
                  padding: '3px 0',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ color: 'var(--text-2)' }}>
                  +{(entry.atMs / 1000).toFixed(1)}s
                </span>
                <span
                  style={{
                    color: LEVEL_COLOR[entry.level],
                    fontWeight: 700,
                  }}
                >
                  ·
                </span>
                <span
                  style={{
                    color: LEVEL_COLOR[entry.level],
                    fontStyle:
                      entry.level === 'reasoning' ? 'italic' : 'normal',
                  }}
                >
                  {entry.text}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: `1px solid var(--border)`,
            fontSize: 10,
            color: 'var(--text-2)',
            display: 'flex',
            justifyContent: 'space-between',
            letterSpacing: 0.1,
          }}
        >
          <span>Esc to close</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {STAGE_LABELS[stage].toLowerCase().replace(/\s+/g, '_')}
          </span>
        </div>
      </div>
    </>
  );
}
