import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useProcessingStream } from '../../data/sse';
import type { PipelineStage } from '../../types/backend';
import { AgentCard } from '../components/pipeline/AgentCard';
import { DraftingWaves } from '../components/pipeline/DraftingWaves';
import { ModelPill } from '../components/pipeline/ModelPill';
import { ParallelBox } from '../components/pipeline/ParallelBox';
import {
  PipelineLines,
  type PipelinePath,
} from '../components/pipeline/PipelineLines';
import { StageLogs } from '../components/pipeline/StageLogs';
import { SubAgentChain } from '../components/pipeline/SubAgentChain';
import type {
  AgentVizStatus,
  ModelPillKind,
  ModelPillSpec,
} from '../components/pipeline/types';

// ── Stage configuration ─────────────────────────────────────────────────────

interface ParallelAgentDef {
  id: string;
  stage: PipelineStage;
  label: string;
  description: string;
  pills: ModelPillSpec[];
}

const PARALLEL_AGENTS: ParallelAgentDef[] = [
  {
    id: 'cad',
    stage: 'cad_parsing',
    label: 'CAD sync',
    description: 'Pure-Python parse of cad.json into a typed CAD record.',
    pills: [{ kind: 'pydantic' }],
  },
  {
    id: 'pcr',
    stage: 'pcr_parsing',
    label: 'ePCR parser',
    description: 'Extract structured events and patient context from the PCR.',
    pills: [{ kind: 'haiku' }],
  },
  {
    id: 'video',
    stage: 'video_analysis',
    label: 'Video analysis',
    description: 'Body-cam frames → timestamped clinical events.',
    pills: [{ kind: 'gemini' }],
  },
  {
    id: 'audio',
    stage: 'audio_analysis',
    label: 'Audio analysis',
    description: 'Dispatch audio: transcribe, then extract events.',
    pills: [{ kind: 'scribe' }, { kind: 'haiku' }],
  },
];

interface ReconSubDef {
  id: string;
  label: string;
  pill: ModelPillKind;
  count?: string;
  conditional?: { tag: string };
}

const RECON_SUBS: ReconSubDef[] = [
  { id: 'cluster', label: 'Cluster', pill: 'haiku' },
  { id: 'review', label: 'Review', pill: 'haiku', count: '×N' },
  { id: 'dispute', label: 'Dispute gate', pill: 'rule' },
  { id: 'critic', label: 'Critic', pill: 'sonnet', conditional: { tag: 'if disputed' } },
];

const DRAFTING_WAVE1: { id: string; label: string; pill: ModelPillKind }[] = [
  { id: 'header', label: 'Header', pill: 'haiku' },
  { id: 'clinical', label: 'Clinical', pill: 'haiku' },
  { id: 'doc', label: 'Doc qual', pill: 'haiku' },
];

const DRAFTING_WAVE2: { id: string; label: string; pill: ModelPillKind }[] = [
  { id: 'recommend', label: 'Recommend', pill: 'haiku' },
  { id: 'rationale', label: 'Rationale', pill: 'haiku' },
];

const SEQUENTIAL_ORDER: PipelineStage[] = [
  'reconciliation',
  'protocol_check',
  'findings',
  'drafting',
];

// Shown in the logs-panel header so the reviewer can see what model
// vocabulary the stage uses without opening the legend.
const STAGE_MODEL_LABELS: Partial<Record<PipelineStage, string>> = {
  cad_parsing: 'Pydantic',
  pcr_parsing: 'Haiku 4.5',
  video_analysis: 'Gemini 2.5 Flash',
  audio_analysis: 'Scribe v1 + Haiku 4.5',
  reconciliation: 'Haiku ×3 + Sonnet 4.6',
  protocol_check: 'fixture stub',
  findings: 'Sonnet 4.6 (no fallback)',
  drafting: 'Haiku ×5 + rule',
};

const RECON_STEP_MS = 2000;
const DRAFTING_GATE_DELAY_MS = 3000;
const DRAFTING_WAVE2_DELAY_MS = 5000;

// Where connectors enter/exit the cards. Stable y-offset from the card's
// top edge — equates roughly to the title-row centerline. Cards can grow
// downward (sub-agent reveals) without shifting the connection point.
const CARD_HEADER_OFFSET = 24;

// ── Main component ──────────────────────────────────────────────────────────

export function Processing() {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const demoFlag = searchParams.get('demo') === '1';

  const stream = useProcessingStream(caseId, { demo: demoFlag });

  // Auto-advance to review once the pipeline finishes.
  useEffect(() => {
    if (stream.isComplete && caseId) {
      const t = window.setTimeout(() => navigate(`/review/${caseId}`), 1600);
      return () => window.clearTimeout(t);
    }
  }, [stream.isComplete, caseId, navigate]);

  // ── Reconciliation sub-agent timed sequence ──
  const reconStatus = stream.stages.get('reconciliation')?.status ?? 'pending';
  const [reconSubIdx, setReconSubIdx] = useState<number>(-1);

  useEffect(() => {
    if (reconStatus === 'running') {
      setReconSubIdx(0);
      const timeouts = RECON_SUBS.slice(1).map((_, i) =>
        window.setTimeout(() => setReconSubIdx(i + 1), RECON_STEP_MS * (i + 1)),
      );
      return () => timeouts.forEach((t) => window.clearTimeout(t));
    }
    if (reconStatus === 'complete') {
      setReconSubIdx(RECON_SUBS.length);
    } else {
      setReconSubIdx(-1);
    }
  }, [reconStatus]);

  function reconSubStatus(idx: number): AgentVizStatus {
    if (reconSubIdx === -1) return 'pending';
    if (reconSubIdx >= RECON_SUBS.length) return 'complete';
    if (idx < reconSubIdx) return 'complete';
    if (idx === reconSubIdx) return 'running';
    return 'pending';
  }

  // ── Drafting wave timed sequence ──
  const draftingStatus = stream.stages.get('drafting')?.status ?? 'pending';
  const [draftingPhase, setDraftingPhase] = useState<
    'pending' | 'wave1' | 'gate' | 'wave2' | 'complete'
  >('pending');

  useEffect(() => {
    if (draftingStatus === 'running') {
      setDraftingPhase('wave1');
      const t1 = window.setTimeout(
        () => setDraftingPhase('gate'),
        DRAFTING_GATE_DELAY_MS,
      );
      const t2 = window.setTimeout(
        () => setDraftingPhase('wave2'),
        DRAFTING_WAVE2_DELAY_MS,
      );
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    if (draftingStatus === 'complete') {
      setDraftingPhase('complete');
    } else {
      setDraftingPhase('pending');
    }
  }, [draftingStatus]);

  const wave1Status: AgentVizStatus =
    draftingPhase === 'pending'
      ? 'pending'
      : draftingPhase === 'wave1'
        ? 'running'
        : 'complete';
  const gateStatus: AgentVizStatus =
    draftingPhase === 'pending' || draftingPhase === 'wave1'
      ? 'pending'
      : draftingPhase === 'gate'
        ? 'running'
        : 'complete';
  const wave2Status: AgentVizStatus =
    draftingPhase === 'pending' ||
    draftingPhase === 'wave1' ||
    draftingPhase === 'gate'
      ? 'pending'
      : draftingPhase === 'wave2'
        ? 'running'
        : 'complete';

  // ── Helpers ──
  const getStageStatus = (stage: PipelineStage): AgentVizStatus =>
    stream.stages.get(stage)?.status ?? 'pending';

  const parallelStatuses = PARALLEL_AGENTS.map((a) => getStageStatus(a.stage));
  const parallelCompleteCount = parallelStatuses.filter(
    (s) => s === 'complete',
  ).length;
  const parallelTotalCount = PARALLEL_AGENTS.length;

  const allStages: PipelineStage[] = [
    'cad_parsing',
    'pcr_parsing',
    'video_analysis',
    'audio_analysis',
    ...SEQUENTIAL_ORDER,
  ];
  const stageStatuses = allStages.map(getStageStatus);
  const completeCount = stageStatuses.filter((s) => s === 'complete').length;
  const activeCount = stageStatuses.filter((s) => s === 'running').length;
  const errorCount = stageStatuses.filter((s) => s === 'error').length;
  const totalStages = demoFlag ? 7 : 8;
  const totalEvents = totalStages * 2;

  const overallStatusLabel = stream.error
    ? 'error'
    : stream.isComplete
      ? 'complete'
      : 'active';

  const elapsed = stream.elapsedSeconds;
  const hms = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const reconSubAgents = useMemo(
    () =>
      RECON_SUBS.map((def, i) => ({
        id: def.id,
        label: def.label,
        pill: def.pill,
        count: def.count,
        status: reconSubStatus(i),
        conditional: def.conditional,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reconSubIdx],
  );

  const wave1Agents = useMemo(
    () => DRAFTING_WAVE1.map((a) => ({ ...a, status: wave1Status })),
    [wave1Status],
  );
  const wave2Agents = useMemo(
    () => DRAFTING_WAVE2.map((a) => ({ ...a, status: wave2Status })),
    [wave2Status],
  );

  // ── Layout-tracking refs ──
  // Each card we want a connector attached to gets a ref. The SVG overlay
  // computes path endpoints from these refs every layout pass — so when a
  // card grows (e.g. reconciliation expands its sub-agent chain), the
  // lines re-anchor automatically.
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fitWrapRef = useRef<HTMLDivElement | null>(null);
  const parallelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const seqRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scale factor that shrinks the canvas to fit the available viewport.
  // Stored in a ref so the line-drawing effect can read the current value
  // when undoing the transform on getBoundingClientRect deltas.
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  const setParallelRef = useCallback(
    (stage: PipelineStage) => (el: HTMLDivElement | null) => {
      parallelRefs.current[stage] = el;
    },
    [],
  );
  const setSeqRef = useCallback(
    (stage: PipelineStage) => (el: HTMLDivElement | null) => {
      seqRefs.current[stage] = el;
    },
    [],
  );

  const [paths, setPaths] = useState<PipelinePath[]>([]);

  // Logs-panel target. Pending stages are non-interactive — there's
  // nothing to show yet — so this is only set when the user clicks a
  // running, complete, or errored card.
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);

  const openLogsFor = (stage: PipelineStage) => {
    if (getStageStatus(stage) === 'pending') return;
    setSelectedStage(stage);
  };

  // Triggers that may shift any card's bounding rect: stage statuses (which
  // drive sub-agent reveals), the timed sub-agent indexes themselves, and
  // the fit-to-viewport scale (since deltas are divided by it).
  const layoutSig = `${parallelStatuses.join('|')}|${reconStatus}|${reconSubIdx}|${draftingStatus}|${draftingPhase}|${scale}`;

  // Fit-to-viewport scaler. Measures the canvas's natural (pre-transform)
  // dimensions via offsetWidth/offsetHeight and the available wrapper size
  // via clientWidth/clientHeight, then sets a uniform scale ≤ 1 so the
  // pipeline never overflows the viewport in either axis.
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

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;

    const compute = () => {
      raf = 0;
      const cv = canvasRef.current;
      if (!cv) return;
      const cRect = cv.getBoundingClientRect();
      const next: PipelinePath[] = [];
      // SVG lives inside the scaled canvas, so its coordinate system is the
      // *unscaled* canvas. getBoundingClientRect returns transformed values,
      // so divide deltas by the current scale to recover layout-space coords.
      const sf = scaleRef.current || 1;

      // Convergence fan-in: each parallel card → recon card's left edge at
      // the title-row level. Source point is each parallel card's right
      // edge at its vertical midpoint.
      const reconEl = seqRefs.current.reconciliation;
      if (reconEl) {
        const r = reconEl.getBoundingClientRect();
        const targetX = (r.left - cRect.left) / sf;
        const targetY = (r.top - cRect.top) / sf + CARD_HEADER_OFFSET;

        for (const agent of PARALLEL_AGENTS) {
          const el = parallelRefs.current[agent.stage];
          if (!el) continue;
          const pr = el.getBoundingClientRect();
          next.push({
            id: `fan-${agent.stage}`,
            x1: (pr.right - cRect.left) / sf,
            y1: (pr.top - cRect.top) / sf + (pr.height / sf) / 2,
            x2: targetX,
            y2: targetY,
            sourceStatus: getStageStatus(agent.stage),
          });
        }
      }

      // Sequential spine: stage[i-1].right → stage[i].left, both at the
      // header offset so cards of different heights still link cleanly.
      for (let i = 1; i < SEQUENTIAL_ORDER.length; i++) {
        const prevEl = seqRefs.current[SEQUENTIAL_ORDER[i - 1]];
        const nextEl = seqRefs.current[SEQUENTIAL_ORDER[i]];
        if (!prevEl || !nextEl) continue;
        const pr = prevEl.getBoundingClientRect();
        const nr = nextEl.getBoundingClientRect();
        next.push({
          id: `spine-${SEQUENTIAL_ORDER[i - 1]}-${SEQUENTIAL_ORDER[i]}`,
          x1: (pr.right - cRect.left) / sf,
          y1: (pr.top - cRect.top) / sf + CARD_HEADER_OFFSET,
          x2: (nr.left - cRect.left) / sf,
          y2: (nr.top - cRect.top) / sf + CARD_HEADER_OFFSET,
          sourceStatus: getStageStatus(SEQUENTIAL_ORDER[i - 1]),
        });
      }

      setPaths((prev) => (samePaths(prev, next) ? prev : next));
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    schedule();

    const ro = new ResizeObserver(schedule);
    ro.observe(canvas);
    Object.values(parallelRefs.current).forEach(
      (el) => el && ro.observe(el),
    );
    Object.values(seqRefs.current).forEach((el) => el && ro.observe(el));
    window.addEventListener('resize', schedule);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSig]);

  // ── Loading / error states ──
  if (!caseId) {
    return (
      <div role="alert" className="h-full bg-background flex items-center justify-center px-6">
        <div
          className="text-sm text-foreground-secondary text-center max-w-md"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          No incident ID in this URL. Open an incident from the dashboard to begin.
        </div>
      </div>
    );
  }

  if (stream.error) {
    return (
      <div
        role="alert"
        className="h-full bg-background flex flex-col items-center justify-center gap-2 px-6"
      >
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--destructive)',
            fontWeight: 600,
          }}
        >
          Pipeline error
        </div>
        <div
          className="text-sm max-w-md text-center"
          style={{ fontFamily: 'var(--font-sans)', color: 'var(--text)' }}
        >
          {stream.error}
        </div>
      </div>
    );
  }

  // ── Render ──
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
          Processing incident
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
          <span>CALYX-CORE-01</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span>{hms(elapsed)} elapsed</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span
            style={{
              color:
                overallStatusLabel === 'complete'
                  ? 'var(--success)'
                  : overallStatusLabel === 'error'
                    ? 'var(--destructive)'
                    : 'var(--primary-strong)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {overallStatusLabel}
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
              completedCount={parallelCompleteCount}
              totalCount={parallelTotalCount}
              parallelismLabel="asyncio.gather()"
              width={240}
            >
              {PARALLEL_AGENTS.map((agent) => {
                const stageStatus = getStageStatus(agent.stage);
                const interactive = stageStatus !== 'pending';
                return (
                  <div
                    key={agent.id}
                    ref={setParallelRef(agent.stage)}
                    onClick={interactive ? () => openLogsFor(agent.stage) : undefined}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onKeyDown={
                      interactive
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openLogsFor(agent.stage);
                            }
                          }
                        : undefined
                    }
                    style={{ cursor: interactive ? 'pointer' : 'default' }}
                  >
                    <AgentCard
                      label={agent.label}
                      description={agent.description}
                      pills={agent.pills}
                      status={stageStatus}
                      variant="parallel"
                    />
                  </div>
                );
              })}
            </ParallelBox>

            {/* Zone 2: Convergence — empty space, lines drawn by SVG overlay */}
            <div style={{ width: 96, flexShrink: 0 }} aria-hidden />

            {/* Zone 3: Sequential cards (no inline connectors — overlay handles them) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                flexShrink: 0,
              }}
            >
              <SeqCardWrapper
                stage="reconciliation"
                status={reconStatus}
                refSetter={setSeqRef}
                onOpen={openLogsFor}
              >
                <AgentCard
                  label="Reconciliation"
                  description="Cluster events across sources, score discrepancies, escalate disputes."
                  pills={[{ kind: 'haiku', count: 3 }, { kind: 'sonnet' }]}
                  status={reconStatus}
                  variant="sequential"
                  width={460}
                  detail={
                    /* Always render so the card occupies its final height
                       from t=0 — the row stays vertically stable as other
                       cards center against it. */
                    <SubAgentChain
                      items={reconSubAgents}
                      parallelismHint="gather() · sem(3)"
                    />
                  }
                />
              </SeqCardWrapper>
              <SeqCardWrapper
                stage="protocol_check"
                status={getStageStatus('protocol_check')}
                refSetter={setSeqRef}
                onOpen={openLogsFor}
              >
                <AgentCard
                  label="Protocol check"
                  description="Rule-based protocol family matching."
                  pills={[{ kind: 'fixture' }]}
                  status={getStageStatus('protocol_check')}
                  variant="sequential"
                  width={200}
                />
              </SeqCardWrapper>
              <SeqCardWrapper
                stage="findings"
                status={getStageStatus('findings')}
                refSetter={setSeqRef}
                onOpen={openLogsFor}
              >
                <AgentCard
                  label="Findings"
                  description="Timeline + checks → findings."
                  pills={[{ kind: 'sonnet' }]}
                  status={getStageStatus('findings')}
                  variant="sequential"
                  noteRight="no fallback"
                  width={210}
                />
              </SeqCardWrapper>
              <SeqCardWrapper
                stage="drafting"
                status={draftingStatus}
                refSetter={setSeqRef}
                onOpen={openLogsFor}
              >
                <AgentCard
                  label="Report drafting"
                  description="Compose the QI Case Review across two parallel waves."
                  pills={[{ kind: 'haiku', count: 5 }, { kind: 'rule' }]}
                  status={draftingStatus}
                  variant="sequential"
                  width={340}
                  detail={
                    /* Always render so drafting reserves its expanded
                       footprint from the start — keeps the row height
                       fixed across the demo. */
                    <DraftingWaves
                      wave1={wave1Agents}
                      wave2={wave2Agents}
                      gateStatus={gateStatus}
                    />
                  }
                />
              </SeqCardWrapper>
            </div>

            {/* SVG overlay — coords computed dynamically, lines draw on completion */}
            <PipelineLines paths={paths} />
          </div>
      </main>

      {selectedStage && (
        <StageLogs
          stage={selectedStage}
          status={getStageStatus(selectedStage)}
          startedAt={stream.stages.get(selectedStage)?.startedAt}
          modelLabel={STAGE_MODEL_LABELS[selectedStage]}
          onClose={() => setSelectedStage(null)}
        />
      )}

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
        <LegendItem pill="pydantic" tagline="deterministic" />
        <LegendItem pill="haiku" tagline="fast extraction" />
        <LegendItem pill="sonnet" tagline="deep reasoning" />
        <LegendItem pill="gemini" tagline="video" />
        <LegendItem pill="scribe" tagline="transcription" />
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
          <span>{totalStages} stages</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: completeCount > 0 ? 'var(--success)' : undefined }}>
            {completeCount} complete
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: activeCount > 0 ? 'var(--primary-strong)' : undefined }}>
            {activeCount} active
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ color: errorCount > 0 ? 'var(--destructive)' : undefined }}>
            {errorCount} errors
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-2)',
          }}
        >
          SSE · {totalEvents} events
        </span>
      </footer>
    </div>
  );
}

// Wraps a sequential card with click/keyboard handling and ref attachment.
// Pulled out so the four sequential stages don't each duplicate the
// boilerplate inline.
function SeqCardWrapper({
  stage,
  status,
  refSetter,
  onOpen,
  children,
}: {
  stage: PipelineStage;
  status: AgentVizStatus;
  refSetter: (stage: PipelineStage) => (el: HTMLDivElement | null) => void;
  onOpen: (stage: PipelineStage) => void;
  children: ReactNode;
}) {
  const interactive = status !== 'pending';
  return (
    <div
      ref={refSetter(stage)}
      onClick={interactive ? () => onOpen(stage) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(stage);
              }
            }
          : undefined
      }
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  );
}

function LegendItem({
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

// Shallow path comparison — keeps setPaths from triggering an unnecessary
// re-render when nothing geometric or status-wise actually changed.
function samePaths(a: PipelinePath[], b: PipelinePath[]): boolean {
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
