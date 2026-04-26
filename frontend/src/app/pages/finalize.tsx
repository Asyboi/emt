import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useIncident } from '../../data/hooks';
import { loadApprovals, saveApprovals } from '../../data/approvals';
import { PRIMARY_MOCK_INCIDENT_ID } from '../../mock/mock_data';
import type { ReportSection, SectionStatus } from '../../types';
import { SectionView } from '../components/section-views/SectionView';

const QUICK_TAGS = [
  'MISSING DETAIL',
  'INCORRECT TIMELINE',
  'PROTOCOL MISCITED',
  'TONE / WORDING',
];

export function Finalize() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const resolvedId = incidentId ?? PRIMARY_MOCK_INCIDENT_ID;
  const { data: incident, loading, error } = useIncident(resolvedId);

  const [showDiff, setShowDiff] = useState(false);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [revisionSection, setRevisionSection] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const [sections, setSections] = useState<ReportSection[]>([]);

  useEffect(() => {
    if (incident) {
      const saved = loadApprovals(incident.id);
      const approvedIds = new Set(saved.approvedSectionIds);
      setSections(
        incident.sections.map((s) =>
          approvedIds.has(s.id) ? { ...s, status: 'approved' as SectionStatus } : { ...s },
        ),
      );
      const needsRevision = incident.sections.find((s) => s.status === 'needs-revision');
      if (needsRevision && !approvedIds.has(needsRevision.id)) {
        setRevisionSection(needsRevision.id);
        setFeedbackText(needsRevision.feedback ?? '');
        setSelectedTags(new Set(needsRevision.feedback ? ['INCORRECT TIMELINE'] : []));
      }
    }
  }, [incident]);

  // Helper: persist the current approved-section IDs to localStorage.
  const persistApprovedIds = (next: ReportSection[]) => {
    if (!incident) return;
    const ids = next.filter((s) => s.status === 'approved').map((s) => s.id);
    saveApprovals(incident.id, { approvedSectionIds: ids });
  };

  const approvedCount = sections.filter((s) => s.status === 'approved').length;
  const pendingCount = sections.filter((s) => s.status === 'pending').length;
  const needsRevisionCount = sections.filter((s) => s.status === 'needs-revision').length;
  const total = sections.length || 1;
  const progress = (approvedCount / total) * 100;
  const allApproved = sections.length > 0 && approvedCount === sections.length;

  // Auto-resolve any 'regenerating' section after 4s — preserves the old UI demo behavior.
  useEffect(() => {
    const regenerating = sections.find((s) => s.status === 'regenerating');
    if (!regenerating) return;
    const timer = setTimeout(() => {
      setSections((current) =>
        current.map((s) =>
          s.id === regenerating.id
            ? {
                ...s,
                status: 'approved',
                preview: 'Updated content with verified timestamps and protocol references...',
                content:
                  'Updated content with verified timestamps and protocol references from cross-referenced sources.',
              }
            : s
        )
      );
    }, 4000);
    return () => clearTimeout(timer);
  }, [sections]);

  const toggleExpand = (id: number) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const approveSection = (id: number) => {
    const next = sections.map((s): ReportSection =>
      s.id === id ? { ...s, status: 'approved' } : s,
    );
    setSections(next);
    persistApprovedIds(next);
    if (expandedSection === id) setExpandedSection(null);
  };

  const undoApproval = (id: number) => {
    const next = sections.map((s): ReportSection =>
      s.id === id ? { ...s, status: 'pending' } : s,
    );
    setSections(next);
    persistApprovedIds(next);
  };

  const requestRevision = (id: number) => {
    setRevisionSection(id);
    setFeedbackText('');
    setSelectedTags(new Set());
  };

  const cancelRevision = () => {
    setRevisionSection(null);
    setFeedbackText('');
    setSelectedTags(new Set());
  };

  const submitRevision = (id: number) => {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, status: 'regenerating', feedback: feedbackText } : s))
    );
    setRevisionSection(null);
    setFeedbackText('');
    setSelectedTags(new Set());
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

    const tagText = tag.toLowerCase().replace(/_/g, ' ');
    if (!feedbackText.toLowerCase().includes(tagText)) {
      setFeedbackText((prev) => (prev ? `${prev}\n[${tag}]` : `[${tag}]`));
    }
  };

  const getStatusTag = (status: SectionStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="text-success bg-success/10 px-2 py-1 border border-success/20 text-[10px]">
            [APPROVED]
          </span>
        );
      case 'pending':
        return (
          <span className="text-foreground-secondary bg-surface px-2 py-1 border border-border text-[10px]">
            [PENDING]
          </span>
        );
      case 'needs-revision':
        return (
          <span className="text-primary bg-primary/10 px-2 py-1 border border-primary/20 text-[10px]">
            [NEEDS REVISION]
          </span>
        );
      case 'regenerating':
        return (
          <span className="text-primary bg-primary/10 px-2 py-1 border border-primary/20 text-[10px] animate-pulse">
            [REGENERATING...]
          </span>
        );
      default:
        return (
          <span className="text-foreground-secondary bg-surface px-2 py-1 border border-border text-[10px]">
            [DRAFT]
          </span>
        );
    }
  };

  if (loading || !incident) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-sm text-foreground-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
          {error ? `Error: ${error.message}` : 'Loading incident…'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background pb-20">
      {/* Header bar */}
      <div className="border-b border-border bg-surface px-8 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xs tracking-[0.15em] text-foreground-secondary mb-1">
              FINALIZE REPORT
            </h1>
            <div className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              {incident.id} / {incident.date}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
              <span className="text-success">
                APPROVED: {approvedCount}/{sections.length}
              </span>
              <span className="text-foreground-secondary mx-2">|</span>
              <span className="text-foreground-secondary">PENDING: {pendingCount}</span>
              <span className="text-foreground-secondary mx-2">|</span>
              <span className="text-primary">NEEDS REVISION: {needsRevisionCount}</span>
            </div>
            <label className="flex items-center gap-2 text-[10px] text-foreground-secondary cursor-pointer justify-end">
              <input
                type="checkbox"
                checked={showDiff}
                onChange={(e) => setShowDiff(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
                SHOW DIFF FROM AI DRAFT
              </span>
            </label>
          </div>
        </div>
        <div className="h-[2px] bg-border relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Section cards */}
      <div className="max-w-[900px] mx-auto px-8 py-8 space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSection === section.id;
          const isRevising = revisionSection === section.id;

          return (
            <div key={section.id} className="border border-border bg-surface">
              {/* Card content */}
              <div className="p-5 flex gap-6">
                {/* Left side */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs tracking-[0.12em] text-foreground">
                      {String(section.id).padStart(2, '0')} / {section.title}
                    </h3>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{getStatusTag(section.status)}</span>
                    {showDiff && section.edits && section.status === 'approved' && (
                      <span
                        className="text-[10px] text-foreground-secondary px-2 py-0.5 border border-border"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {section.edits} EDITS
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <div className="mb-2">
                      <SectionView section={section} />
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-secondary leading-relaxed mb-2">
                      {section.preview}
                    </p>
                  )}
                  <button
                    onClick={() => toggleExpand(section.id)}
                    className="text-[11px] text-foreground-secondary hover:text-foreground transition-colors"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {isExpanded ? (
                      <span className="flex items-center gap-1">
                        <ChevronUp className="w-3 h-3" />
                        COLLAPSE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ChevronDown className="w-3 h-3" />
                        EXPAND
                      </span>
                    )}
                  </button>

                  {section.status === 'regenerating' && (
                    <div
                      className="mt-3 text-xs text-foreground-secondary"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      <span className="animate-pulse">[..]</span> Agent re-cross-referencing CAD log and PCR narrative...
                    </div>
                  )}
                </div>

                {/* Right side - Actions */}
                <div className="flex flex-col gap-2 items-end">
                  {(section.status === 'pending' || section.status === 'draft') && (
                    <>
                      <button
                        onClick={() => approveSection(section.id)}
                        className="px-4 py-2 bg-primary text-primary-foreground text-xs tracking-wide hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => requestRevision(section.id)}
                        className="px-4 py-2 border border-border text-xs tracking-wide hover:bg-background transition-colors whitespace-nowrap"
                      >
                        REQUEST REVISION
                      </button>
                    </>
                  )}
                  {section.status === 'approved' && (
                    <button
                      onClick={() => undoApproval(section.id)}
                      className="text-xs text-foreground-secondary hover:text-foreground transition-colors"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      UNDO
                    </button>
                  )}
                  {section.status === 'needs-revision' && (
                    <div className="text-right">
                      <button
                        onClick={() => submitRevision(section.id)}
                        className="px-4 py-2 bg-primary text-primary-foreground text-xs tracking-wide hover:opacity-90 transition-opacity mb-2 whitespace-nowrap"
                      >
                        REGENERATE
                      </button>
                      <div
                        className="text-[10px] text-foreground-secondary"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Feedback submitted
                        <button
                          onClick={() => setRevisionSection(section.id)}
                          className="text-primary hover:underline ml-1"
                        >
                          view/edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Revision feedback area */}
              {isRevising && (
                <div className="border-t border-border bg-background p-5">
                  <h4 className="text-xs tracking-[0.15em] text-foreground-secondary mb-4">
                    FEEDBACK FOR AGENT
                  </h4>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe what needs to change. The agent will regenerate this section using the original sources."
                    className="w-full h-24 bg-surface border border-border p-3 text-sm resize-none outline-none focus:border-primary transition-colors mb-3"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <div className="flex flex-wrap gap-2 mb-4">
                    {QUICK_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 text-[10px] tracking-wider transition-colors ${
                          selectedTags.has(tag)
                            ? 'bg-primary/10 border border-primary text-primary'
                            : 'border border-border text-foreground-secondary hover:bg-surface'
                        }`}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={cancelRevision}
                      className="px-4 py-2 border border-border text-xs tracking-wide hover:bg-surface transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={() => submitRevision(section.id)}
                      className="px-4 py-2 bg-primary text-primary-foreground text-xs tracking-wide hover:opacity-90 transition-opacity"
                    >
                      SUBMIT & REGENERATE
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface px-8 py-4 flex items-center justify-between">
        <p className="text-xs text-foreground-secondary" style={{ fontFamily: 'var(--font-mono)' }}>
          ALL SECTIONS MUST BE APPROVED BEFORE FINALIZATION
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              persistApprovedIds(sections);
              navigate(`/review/${incident.id}`);
            }}
            className="px-6 py-2.5 border border-border text-sm tracking-wide hover:bg-background transition-colors"
          >
            BACK TO REVIEW
          </button>
          <button
            onClick={() => {
              const ids = sections.filter((s) => s.status === 'approved').map((s) => s.id);
              saveApprovals(incident.id, { approvedSectionIds: ids, finalized: true });
              navigate('/archive');
            }}
            disabled={!allApproved}
            className="px-6 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            SAVE FINAL REPORT
          </button>
        </div>
      </div>
    </div>
  );
}
