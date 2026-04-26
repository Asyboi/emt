import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useIncident } from '../../data/hooks';
import { loadApprovals, saveApprovals } from '../../data/approvals';
import { PRIMARY_MOCK_INCIDENT_ID } from '../../mock/mock_data';
import type { ReportSection, SectionStatus } from '../../types';
import { SectionView } from '../components/section-views/SectionView';

export function ReviewReport() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const resolvedId = incidentId ?? PRIMARY_MOCK_INCIDENT_ID;
  const { data: incident, loading, error } = useIncident(resolvedId);

  const [expandedSection, setExpandedSection] = useState(1);
  const [sections, setSections] = useState<ReportSection[]>([]);

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

  const getStatusTag = (status: SectionStatus) => {
    switch (status) {
      case 'edited':
        return <span className="text-primary">[EDITED]</span>;
      case 'approved':
        return <span className="text-success">[APPROVED]</span>;
      default:
        return <span className="text-foreground-secondary">[DRAFT]</span>;
    }
  };

  const toggleSection = (id: number) => {
    setExpandedSection(expandedSection === id ? 0 : id);
  };

  const approveSection = (id: number) => {
    const next = sections.map((s): ReportSection =>
      s.id === id ? { ...s, status: 'approved' } : s,
    );
    setSections(next);
    if (incident) {
      const ids = next.filter((s) => s.status === 'approved').map((s) => s.id);
      saveApprovals(incident.id, { approvedSectionIds: ids });
    }
    if (expandedSection === id) setExpandedSection(0);
  };

  const persistAndGo = (path: string) => {
    if (incident) {
      const ids = sections.filter((s) => s.status === 'approved').map((s) => s.id);
      saveApprovals(incident.id, { approvedSectionIds: ids });
    }
    navigate(path);
  };

  const allApproved = sections.length > 0 && sections.every((s) => s.status === 'approved');

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4" style={{ fontFamily: 'var(--font-mono)' }}>
          <span className="text-sm">{incident.id}</span>
          <span className="text-foreground-secondary text-sm">/</span>
          <span className="text-sm text-foreground-secondary">
            {incident.date} {incident.time}
          </span>
        </div>

        <div
          className="px-3 py-1 border border-border bg-surface text-xs tracking-wider"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          REPORT REVIEW
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

      {/* Centered report column */}
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="max-w-3xl mx-auto p-6 space-y-3">
          {sections.map((section) => {
            const isExpanded = expandedSection === section.id;

            return (
              <div key={section.id} className="border border-border bg-background">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="text-xs tracking-[0.1em]">{section.title}</span>
                  </div>
                  <span className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                    {getStatusTag(section.status)}
                  </span>
                </button>

                {isExpanded && (section.data || section.content) && (
                  <div className="px-4 pb-4 space-y-4">
                    <div className="text-sm leading-relaxed">
                      <SectionView section={section} />
                      {section.citations.map((cit, idx) => (
                        <sup
                          key={idx}
                          className="text-primary mx-0.5"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {cit}
                        </sup>
                      ))}
                    </div>
                    {section.status !== 'approved' && (
                      <button
                        onClick={() => approveSection(section.id)}
                        className="px-4 py-2 border border-primary text-primary text-xs tracking-wide hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        APPROVE
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
