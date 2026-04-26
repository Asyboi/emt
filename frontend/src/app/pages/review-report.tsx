import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { useIncident } from '../../data/hooks';
import { loadApprovals, saveApprovals } from '../../data/approvals';
import { PRIMARY_MOCK_INCIDENT_ID } from '../../mock/mock_data';
import type { ReportSection, SectionStatus } from '../../types';
import { SectionView } from '../components/section-views/SectionView';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import { SectionTile } from '../components/section-tiles/SectionTile';
import { IncidentSummaryPreview } from '../components/section-tiles/IncidentSummaryPreview';
import { TimelinePreview } from '../components/section-tiles/TimelinePreview';
import { DocQualityPreview } from '../components/section-tiles/DocQualityPreview';
import { ProtocolChecksPreview } from '../components/section-tiles/ProtocolChecksPreview';
import { ClinicalAssessmentPreview } from '../components/section-tiles/ClinicalAssessmentPreview';
import { StrengthsPreview } from '../components/section-tiles/StrengthsPreview';
import { FindingsPreview } from '../components/section-tiles/FindingsPreview';
import { RecommendationsPreview } from '../components/section-tiles/RecommendationsPreview';
import { StructuredTextPreview } from '../components/section-tiles/StructuredTextPreview';

// Bento grid placement, keyed by section.id (assigned in adapters.ts).
// Combined with grid-auto-flow:dense, tiles pack to fill row gaps.
const GRID_LAYOUT: Record<number, string> = {
  1: 'col-span-12 lg:col-span-8',                              // INCIDENT SUMMARY (hero)
  3: 'col-span-12 sm:col-span-6 lg:col-span-4',                // PCR DOC CHECK
  8: 'col-span-12 lg:col-span-6 lg:row-span-2',                // AREAS FOR IMPROVEMENT (tall)
  4: 'col-span-12 sm:col-span-6 lg:col-span-3',                // PROTOCOL COMPLIANCE
  9: 'col-span-12 sm:col-span-6 lg:col-span-3',                // RECOMMENDED FOLLOW-UP
  5: 'col-span-12 sm:col-span-6 lg:col-span-3',                // KEY CLINICAL DECISIONS
  6: 'col-span-12 sm:col-span-6 lg:col-span-3',                // COMM / SCENE
  2: 'col-span-12 lg:col-span-6',                              // TIMELINE
  7: 'col-span-12 lg:col-span-6',                              // STRENGTHS
};

const RENDER_ORDER = [1, 3, 8, 4, 9, 5, 6, 2, 7];

function previewFor(section: ReportSection) {
  if (!section.data) {
    return <StructuredTextPreview content={section.content} sectionId={section.id} />;
  }
  switch (section.data.kind) {
    case 'incident-summary':
      return <IncidentSummaryPreview text={section.data.text} />;
    case 'timeline':
      return <TimelinePreview entries={section.data.entries} />;
    case 'doc-quality':
      return <DocQualityPreview quality={section.data.quality} />;
    case 'protocol-checks':
      return <ProtocolChecksPreview checks={section.data.checks} />;
    case 'clinical-assessment':
      return <ClinicalAssessmentPreview items={section.data.items} />;
    case 'strengths':
      return <StrengthsPreview items={section.data.items} />;
    case 'findings':
      return <FindingsPreview findings={section.data.findings} />;
    case 'recommendations':
      return <RecommendationsPreview recs={section.data.recs} />;
  }
}

export function ReviewReport() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const resolvedId = incidentId ?? PRIMARY_MOCK_INCIDENT_ID;
  const { data: incident, loading, error } = useIncident(resolvedId);

  const [sections, setSections] = useState<ReportSection[]>([]);
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);

  useEffect(() => {
    if (incident) {
      const saved = loadApprovals(incident.id);
      const approvedIds = new Set(saved.approvedSectionIds);
      setSections(
        incident.sections.map((s) => ({
          ...s,
          status: approvedIds.has(s.id)
            ? ('approved' as SectionStatus)
            : ('draft' as SectionStatus),
        })),
      );
    }
  }, [incident]);

  const openSection = sections.find((s) => s.id === openSectionId) ?? null;

  const persistAndGo = (path: string) => {
    if (incident) {
      const ids = sections.filter((s) => s.status === 'approved').map((s) => s.id);
      saveApprovals(incident.id, { approvedSectionIds: ids });
    }
    navigate(path);
  };

  const approveCurrent = () => {
    if (openSectionId == null || !incident) return;
    const next = sections.map((s): ReportSection =>
      s.id === openSectionId ? { ...s, status: 'approved' } : s,
    );
    setSections(next);
    const ids = next.filter((s) => s.status === 'approved').map((s) => s.id);
    saveApprovals(incident.id, { approvedSectionIds: ids });
    setOpenSectionId(null);
  };

  const toggleApprove = (id: number) => {
    if (!incident) return;
    const next = sections.map((s): ReportSection =>
      s.id === id
        ? { ...s, status: s.status === 'approved' ? 'draft' : 'approved' }
        : s,
    );
    setSections(next);
    const ids = next.filter((s) => s.status === 'approved').map((s) => s.id);
    saveApprovals(incident.id, { approvedSectionIds: ids });
  };

  const approvedCount = sections.filter((s) => s.status === 'approved').length;
  const allApproved = sections.length > 0 && approvedCount === sections.length;
  const progressPct =
    sections.length > 0 ? (approvedCount / sections.length) * 100 : 0;

  if (error) {
    return (
      <div
        role="alert"
        className="min-h-screen bg-background flex flex-col items-center justify-center gap-2 px-6"
      >
        <div
          className="text-xs tracking-[0.15em]"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--destructive)' }}
        >
          COULDN'T LOAD INCIDENT
        </div>
        <div className="text-sm text-foreground-secondary max-w-md text-center">
          {error.message}. Refresh to retry — or check that the backend is running on port 8000.
        </div>
      </div>
    );
  }

  if (loading || !incident) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-background flex items-center justify-center"
      >
        <div className="text-sm text-foreground-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
          Loading incident…
        </div>
      </div>
    );
  }

  const orderedSections = RENDER_ORDER
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is ReportSection => Boolean(s));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4" style={{ fontFamily: 'var(--font-mono)' }}>
          <span className="text-sm">{incident.id}</span>
          <span className="text-foreground-secondary text-sm">/</span>
          <span className="text-sm text-foreground-secondary">
            {incident.date} {incident.time}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="px-3 py-1 border border-border bg-surface text-xs tracking-wider"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            REPORT REVIEW
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1 border border-border bg-surface text-xs tracking-wider tabular-nums"
            style={{ fontFamily: 'var(--font-mono)' }}
            aria-label={`${approvedCount} of ${sections.length} sections approved`}
          >
            <span style={{ color: allApproved ? '#3D5A3D' : undefined }}>
              {approvedCount} / {sections.length}
            </span>
            <span className="text-foreground-secondary">APPROVED</span>
            <span aria-hidden className="w-16 h-1 bg-background border border-border ml-1 overflow-hidden">
              <span
                className="block h-full transition-all duration-300"
                style={{
                  width: `${progressPct}%`,
                  background: allApproved ? '#3D5A3D' : 'var(--primary)',
                }}
              />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => persistAndGo(`/review/${incident.id}`)}
            className="px-4 py-2 border border-border text-sm tracking-wide hover:bg-surface transition-colors"
          >
            BACK
          </button>
          <button
            onClick={() => persistAndGo('/archive')}
            className="px-4 py-2 border border-border text-sm tracking-wide hover:bg-surface transition-colors"
          >
            SAVE & EXIT
          </button>
          <button
            onClick={() => persistAndGo(`/finalize/${incident.id}`)}
            disabled={!allApproved}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            FINALIZE REPORT
          </button>
        </div>
      </div>

      {/* Bento grid */}
      <div className="flex-1 bg-surface p-4 lg:p-6">
        <div
          className="grid grid-cols-12 gap-3 lg:gap-4"
          style={{ gridAutoRows: 'minmax(180px, auto)', gridAutoFlow: 'dense' }}
        >
          {orderedSections.map((section) => (
            <SectionTile
              key={section.id}
              section={section}
              className={GRID_LAYOUT[section.id] ?? 'col-span-12 sm:col-span-6 lg:col-span-4'}
              onOpen={() => setOpenSectionId(section.id)}
              onToggleApprove={() => toggleApprove(section.id)}
            >
              {previewFor(section)}
            </SectionTile>
          ))}
        </div>
      </div>

      {/* Reader sheet */}
      <Sheet
        open={openSection !== null}
        onOpenChange={(open) => {
          if (!open) setOpenSectionId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-[640px] p-0 gap-0"
        >
          {openSection && (
            <div className="flex flex-col h-full min-h-0">
              <div className="border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
                <SheetTitle
                  className="text-[11px] tracking-[0.15em] uppercase text-foreground"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {openSection.title}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Section detail and approval
                </SheetDescription>
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <SectionView section={openSection} />
                {openSection.citations.length > 0 && (
                  <div
                    className="mt-4 pt-3 border-t border-border text-[11px] text-foreground-secondary"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Citations:
                    {openSection.citations.map((cit, idx) => (
                      <sup
                        key={idx}
                        className="text-primary mx-1"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {cit}
                      </sup>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-3 flex-shrink-0">
                {openSection.status === 'approved' ? (
                  <span
                    className="flex items-center gap-1.5 text-[11px] tracking-[0.15em]"
                    style={{ fontFamily: 'var(--font-mono)', color: '#3D5A3D' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                    APPROVED
                  </span>
                ) : (
                  <button
                    onClick={approveCurrent}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs tracking-wide hover:opacity-90 transition-opacity"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    APPROVE
                  </button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
