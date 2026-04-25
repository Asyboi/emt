import { useEffect, useState, useRef } from 'react';
import { Check, Loader2, X, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useIncident } from '../../data/hooks';
import { PRIMARY_MOCK_INCIDENT_ID } from '../../mock/mock_data';
import type { AgentStatus, AgentTile } from '../../types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C_SUCCESS = '#3D5A3D';
const C_PRIMARY = '#B8732E';
const C_BORDER = '#D9D7D0';
const C_MUTED = '#9A9890';
const C_BG = '#F5F4F0';
const C_SURFACE = '#FAF9F5';
const C_SUBCARD = '#EDECE8';

// ── Layout constants ──────────────────────────────────────────────────────────
const CARD_H = 104;
const C1_GAP = 14;
const C1_W = 380;
const RECON_H = 212;
const SEQ_H = 100;
const ARR_H = 28;
const HARR_W = 32;
const SEQ_ARR = 56;
const CON_W = 90;
const FLOW_H = 340;

const EPCR_TOP = 0;
const AUDIO_TOP = CARD_H + C1_GAP;
const CAD_TOP = 2 * (CARD_H + C1_GAP);

const CY_EPCR = EPCR_TOP + CARD_H / 2;
const CY_AUDIO = AUDIO_TOP + CARD_H / 2;
const CY_CAD = CAD_TOP + CARD_H / 2;

const CONV_Y = CY_AUDIO;

// ── Horizontal tile-to-tile arrow ─────────────────────────────────────────────
const HorizArrow = ({ done }: { done: boolean }) => (
  <div className="flex items-center justify-center flex-shrink-0" style={{ width: HARR_W }}>
    <svg width={HARR_W} height={14} viewBox={`0 0 ${HARR_W} 14`}>
      <line
        x1="0"
        y1="7"
        x2={HARR_W - 9}
        y2="7"
        stroke={done ? C_PRIMARY : C_MUTED}
        strokeWidth="1.5"
        strokeDasharray={done ? undefined : '3 2'}
      />
      <polygon points={`${HARR_W},7 ${HARR_W - 9},3 ${HARR_W - 9},11`} fill={done ? C_PRIMARY : C_MUTED} />
    </svg>
  </div>
);

// ── Sub-agent tile ─────────────────────────────────────────────────────────────
const SubTile = ({ sa }: { sa: AgentTile }) => {
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
            color: '#1A1A1A',
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
            color: '#6B6B68',
          }}
        >
          RULE-BASED
        </span>
      ) : sa.model ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C_MUTED }}>
          {sa.model}
        </span>
      ) : null}
      {sa.status === 'active' && sa.progressPct && (
        <div style={{ height: 2, background: C_BORDER, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: sa.progressPct, background: C_PRIMARY }} />
        </div>
      )}
      {sa.statLine && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            lineHeight: 1.4,
            color:
              sa.status === 'complete' ? C_SUCCESS : sa.status === 'active' ? C_PRIMARY : '#6B6B68',
          }}
        >
          {sa.statLine}
        </span>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export function Processing() {
  const { data: incident, loading, error } = useIncident(PRIMARY_MOCK_INCIDENT_ID);
  const logRef = useRef<HTMLDivElement>(null);

  const [autoScroll, setAutoScroll] = useState(true);
  const [selected, setSelected] = useState<string | null>('audio-analyzer');
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setCursor((p) => !p), 530);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [incident, autoScroll]);

  if (loading || !incident) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-foreground-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
          {error ? `Error: ${error.message}` : 'Loading pipeline…'}
        </div>
      </div>
    );
  }

  const { pipeline } = incident;
  const subTiles = pipeline.agentTiles;
  const findings = pipeline.findings;
  const audioLogs = pipeline.audioLogs;
  const elapsed = pipeline.elapsedSeconds;
  const progress = pipeline.progressPct;

  const hms = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const logColor = (t: (typeof audioLogs)[number]['type']) => {
    if (t === 'system') return 'text-foreground-secondary';
    if (t === 'action') return 'text-foreground';
    if (t === 'reasoning') return 'text-primary';
    if (t === 'finding') return 'text-success';
    return 'text-destructive';
  };

  // ── Compact extraction card (Col 1) ─────────────────────────────────────────
  const CompactCard = ({
    id,
    name,
    model,
    status,
    stat,
  }: {
    id: string;
    name: string;
    model: string;
    status: AgentStatus;
    stat: string;
  }) => {
    const accent = status === 'complete' ? C_SUCCESS : status === 'active' ? C_PRIMARY : C_MUTED;
    const isSel = selected === id;
    return (
      <button
        onClick={() => setSelected(isSel ? null : id)}
        className="w-full text-left rounded-sm transition-all hover:shadow-sm"
        style={{
          height: CARD_H,
          background: C_SURFACE,
          boxSizing: 'border-box',
          border: `1px solid ${isSel ? C_PRIMARY : C_BORDER}`,
          borderLeft: `3px solid ${accent}`,
          boxShadow: isSel ? `0 0 0 1px ${C_PRIMARY}` : undefined,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '12px 14px',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.09em',
                flexShrink: 0,
              }}
            >
              {name}
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
            color: '#6B6B68',
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
      </button>
    );
  };

  const SeqCard = ({
    id,
    name,
    model,
    status,
    stat,
  }: {
    id: string;
    name: string;
    model: string;
    status: AgentStatus;
    stat: string;
  }) => {
    const accent = status === 'complete' ? C_SUCCESS : status === 'active' ? C_PRIMARY : C_MUTED;
    return (
      <button
        onClick={() => setSelected(selected === id ? null : id)}
        className="w-full h-full text-left rounded-sm transition-all hover:shadow-sm"
        style={{
          minHeight: SEQ_H,
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
          <div className="flex items-center gap-2 min-w-0">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.09em',
              }}
            >
              {name}
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#6B6B68' }}>{stat}</div>
      </button>
    );
  };

  const ReconciliationCard = () => (
    <div
      className="w-full rounded-sm"
      style={{
        height: RECON_H,
        background: C_SURFACE,
        boxSizing: 'border-box',
        border: `1px solid rgba(184,115,46,0.35)`,
        borderLeft: `3px solid ${C_PRIMARY}`,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
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
        <Loader2
          style={{ width: 14, height: 14, color: C_PRIMARY, flexShrink: 0 }}
          className="animate-spin"
        />
      </div>

      <div
        className="inline-flex items-center gap-1.5 self-start mt-2 px-2 py-1 rounded-sm"
        style={{ background: 'rgba(184,115,46,0.08)', border: '1px solid rgba(184,115,46,0.22)' }}
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
          RUNNING · {subTiles.filter((s) => s.status === 'complete').length}/{subTiles.length} SUB-AGENTS COMPLETE
        </span>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: C_MUTED,
            letterSpacing: '0.10em',
          }}
        >
          INPUTS
        </span>
        {[
          { src: 'ePCR', ok: true },
          { src: 'CAD', ok: true },
          { src: 'Audio', ok: false },
        ].map((inp, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: inp.ok ? C_SUCCESS : 'transparent',
                border: inp.ok ? 'none' : `1px solid ${C_MUTED}`,
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: inp.ok ? C_SUCCESS : C_MUTED,
              }}
            >
              {inp.src} {inp.ok ? '✓' : '…'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${C_BORDER}`, margin: '10px 0 6px' }} />
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: C_MUTED,
          letterSpacing: '0.14em',
          marginBottom: 8,
        }}
      >
        SUB-AGENT CHAIN
      </div>

      <div className="flex items-stretch flex-1" style={{ minHeight: 0 }}>
        {subTiles.map((tile, i) => (
          <SubTileWithArrow key={tile.id} tile={tile} isLast={i === subTiles.length - 1} />
        ))}
      </div>
    </div>
  );

  const flagCount = findings.filter((f) => f.type === 'warning').length;
  const completeCount = subTiles.filter((s) => s.status === 'complete').length;
  const activeCount = subTiles.filter((s) => s.status === 'active').length;

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
              color: '#6B6B68',
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
            {incident.id}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#6B6B68' }}>
            AGENT: CALYX-CORE-01
            <span style={{ margin: '0 12px' }}>|</span>
            ELAPSED: {hms(elapsed)}
            <span style={{ margin: '0 12px' }}>|</span>
            STATUS: <span style={{ color: C_PRIMARY }}>ACTIVE</span>
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
            }}
          />
        </div>
      </div>

      {/* Flow section */}
      <div className="flex-1 flex flex-col justify-center px-10 min-h-0">
        <div className="flex items-center mb-4">
          <div style={{ width: C1_W, flexShrink: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.15em',
                color: C_MUTED,
              }}
            >
              PARALLEL EXTRACTION
            </span>
          </div>
          <div style={{ width: CON_W, flexShrink: 0 }} />
          <div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.15em',
                color: C_MUTED,
              }}
            >
              SEQUENTIAL REASONING
            </span>
          </div>
        </div>

        <div className="flex items-start" style={{ height: FLOW_H }}>
          {/* Col 1 */}
          <div className="flex-shrink-0 relative" style={{ width: C1_W, height: FLOW_H }}>
            <div style={{ position: 'absolute', top: EPCR_TOP, left: 0, right: 0 }}>
              <CompactCard
                id="epcr-parser"
                name="ePCR PARSER"
                model="Haiku 4.5"
                status="complete"
                stat="14 events · 3 meds · vitals timeline"
              />
            </div>
            <div style={{ position: 'absolute', top: AUDIO_TOP, left: 0, right: 0 }}>
              <CompactCard
                id="audio-analyzer"
                name="AUDIO ANALYZER"
                model="Whisper + Haiku 4.5"
                status="active"
                stat="5/7 substeps — processing BODYCAM-02…"
              />
            </div>
            <div style={{ position: 'absolute', top: CAD_TOP, left: 0, right: 0 }}>
              <CompactCard
                id="cad-sync"
                name="CAD SYNC"
                model="Haiku 4.5"
                status="complete"
                stat="47 GPS waypoints · 6 dispatch events"
              />
            </div>
          </div>

          {/* Connectors */}
          <svg
            width={CON_W}
            height={FLOW_H}
            className="flex-shrink-0"
            style={{ display: 'block', overflow: 'visible' }}
          >
            <line x1="0" y1={CY_EPCR} x2={CON_W} y2={CONV_Y} stroke={C_SUCCESS} strokeWidth="1.5" />
            <line x1="0" y1={CY_AUDIO} x2={CON_W} y2={CONV_Y} stroke={C_PRIMARY} strokeWidth="1.5" />
            <line x1="0" y1={CY_CAD} x2={CON_W} y2={CONV_Y} stroke={C_SUCCESS} strokeWidth="1.5" />
            <circle cx={CON_W} cy={CONV_Y} r="5" fill={C_PRIMARY} stroke={C_BG} strokeWidth="2.5" />
          </svg>

          {/* Col 2 */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ height: FLOW_H }}>
            <ReconciliationCard />

            <div style={{ height: ARR_H, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <svg width={12} height={ARR_H} viewBox={`0 0 12 ${ARR_H}`}>
                  <line
                    x1="6"
                    y1="0"
                    x2="6"
                    y2={ARR_H - 9}
                    stroke={C_MUTED}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <polygon points={`6,${ARR_H} 2,${ARR_H - 9} 10,${ARR_H - 9}`} fill={C_MUTED} />
                </svg>
              </div>
              <div style={{ width: SEQ_ARR, flexShrink: 0 }} />
              <div style={{ flex: 1 }} />
            </div>

            <div className="flex items-stretch" style={{ flex: 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SeqCard
                  id="protocol-check"
                  name="PROTOCOL CHECK"
                  model="Sonnet 4.6"
                  status="waiting"
                  stat="Awaiting reconciled timeline · ACLS adherence check"
                />
              </div>
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: SEQ_ARR }}
              >
                <svg width={SEQ_ARR} height={14} viewBox={`0 0 ${SEQ_ARR} 14`}>
                  <line
                    x1="0"
                    y1="7"
                    x2={SEQ_ARR - 9}
                    y2="7"
                    stroke={C_MUTED}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <polygon
                    points={`${SEQ_ARR},7 ${SEQ_ARR - 9},3 ${SEQ_ARR - 9},11`}
                    fill={C_MUTED}
                  />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SeqCard
                  id="report-drafter"
                  name="REPORT DRAFTER"
                  model="Sonnet 4.6"
                  status="waiting"
                  stat="Awaiting protocol results · 9-section After-Action Review"
                />
              </div>
            </div>
          </div>
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
            <button style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: C_PRIMARY }}>
              (+{findings.length - 3} more)
            </button>
          </div>
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
          style={{ color: '#6B6B68' }}
        >
          <span>7 AGENTS</span>
          <span style={{ color: C_BORDER }}>|</span>
          <span style={{ color: C_SUCCESS }}>{completeCount} COMPLETE</span>
          <span style={{ color: C_BORDER }}>|</span>
          <span style={{ color: C_PRIMARY }}>{activeCount} ACTIVE</span>
          <span style={{ color: C_BORDER }}>|</span>
          <span>47 EVENTS SYNCED</span>
          <span style={{ color: C_BORDER }}>|</span>
          <span style={{ color: C_PRIMARY }}>
            {flagCount} FLAG{flagCount !== 1 ? 'S' : ''} RAISED
          </span>
        </div>
        <span className="whitespace-nowrap flex-shrink-0" style={{ color: '#6B6B68' }}>
          Video processed audio-first · Footage not displayed without explicit user action
        </span>
      </div>

      {/* Audio Analyzer Detail Drawer */}
      {selected === 'audio-analyzer' && (
        <div
          className="fixed right-0 top-0 bottom-0 flex flex-col z-50"
          style={{
            width: '38%',
            background: C_SURFACE,
            borderLeft: `1px solid ${C_BORDER}`,
            boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="flex items-center justify-between flex-shrink-0"
            style={{
              borderBottom: `1px solid ${C_BORDER}`,
              padding: '16px 22px',
              background: C_SURFACE,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.10em' }}>
              AUDIO ANALYZER — DETAIL LOG
            </span>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6B6B68' }}>
                  AUTO-SCROLL
                </span>
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="w-3 h-3"
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  [{autoScroll ? 'ON' : 'OFF'}]
                </span>
              </label>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded hover:bg-background"
              >
                <X style={{ width: 15, height: 15, color: '#6B6B68' }} />
              </button>
            </div>
          </div>
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto p-6"
            style={{ fontFamily: 'var(--font-mono)', background: C_BG }}
          >
            {audioLogs.map((log, i) => (
              <div
                key={i}
                className={`leading-relaxed mb-1 ${logColor(log.type)}`}
                style={{ fontSize: 12 }}
              >
                <span className="text-foreground-secondary">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#1A1A1A' }}>
              [00:01:47] → Processing BODYCAM-02.mp4 (980 MB) — audio track only
              {cursor && <span style={{ color: C_PRIMARY }}>▊</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: render a SubTile with a HorizArrow after it (except for the last).
function SubTileWithArrow({ tile, isLast }: { tile: AgentTile; isLast: boolean }) {
  return (
    <>
      <SubTile sa={tile} />
      {!isLast && <HorizArrow done={tile.status === 'complete'} />}
    </>
  );
}
