import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronDown, ChevronRight, Circle, MapPin, Volume2 } from 'lucide-react';
import { useIncident } from '../../data/hooks';
import { PRIMARY_MOCK_INCIDENT_ID } from '../../mock/mock_data';
import { API_BASE } from '../../data/api';
import type { ReportSection, SectionStatus, TimelineCategory } from '../../types';

type ViewTab = 'map' | 'video' | 'pcr' | 'cad';

const TRACK_LABELS: Array<{ label: string; key: TimelineCategory }> = [
  { label: 'CAD EVENTS', key: 'cad' },
  { label: 'GPS PATH', key: 'gps' },
  { label: 'VIDEO SEGMENTS', key: 'video' },
  { label: 'PCR ENTRIES', key: 'pcr' },
  { label: 'VITALS', key: 'vitals' },
];

export function Review() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const resolvedId = incidentId ?? PRIMARY_MOCK_INCIDENT_ID;
  const { data: incident, loading, error } = useIncident(resolvedId);

  const [activeTab, setActiveTab] = useState<ViewTab>('map');
  const [expandedSection, setExpandedSection] = useState(1);
  const [showVideoFootage, setShowVideoFootage] = useState(false);
  const [keyMomentsOnly, setKeyMomentsOnly] = useState(true);
  const [expandedTracks, setExpandedTracks] = useState<Set<TimelineCategory>>(
    new Set(['cad', 'gps', 'video', 'pcr', 'vitals'])
  );
  const [selectedEvent, setSelectedEvent] = useState<string>('14:32');

  const [sections, setSections] = useState<ReportSection[]>([]);

  useEffect(() => {
    if (incident) {
      setSections(incident.sections.map((s) => ({ ...s, status: 'draft' as SectionStatus })));
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
    setSections(sections.map((s) => (s.id === id ? { ...s, status: 'approved' } : s)));
  };

  const allApproved = sections.length > 0 && sections.every((s) => s.status === 'approved');

  const toggleTrack = (track: TimelineCategory) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(track)) next.delete(track);
      else next.add(track);
      return next;
    });
  };

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
          IN REVIEW
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-border text-sm tracking-wide hover:bg-surface transition-colors">
            SAVE & EXIT
          </button>
          <button
            onClick={() => navigate(`/finalize/${incident.id}`)}
            disabled={!allApproved}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            FINALIZE REPORT
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex-1 flex">
        {/* Left column - Timeline */}
        <div className="w-[25%] border-r border-border bg-surface overflow-y-auto">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs tracking-[0.15em] text-foreground-secondary">TIMELINE</h3>
              <label className="flex items-center gap-2 text-[11px] text-foreground-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={keyMomentsOnly}
                  onChange={(e) => setKeyMomentsOnly(e.target.checked)}
                  className="w-3 h-3"
                />
                <span className="tracking-wide">KEY MOMENTS ONLY</span>
              </label>
            </div>
          </div>

          {/* Track groups */}
          <div className="p-4 space-y-1">
            {TRACK_LABELS.map(({ label, key }) => {
              const isExpanded = expandedTracks.has(key);
              const trackEvents = incident.timelineEvents.filter((e) => e.category === key);
              const panelId = `track-panel-${key}`;
              const triggerId = `track-trigger-${key}`;

              return (
                <div key={key}>
                  <button
                    id={triggerId}
                    onClick={() => toggleTrack(key)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    className="w-full flex items-center gap-2 py-1 text-[11px] tracking-wider text-foreground-secondary hover:text-foreground transition-colors"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" aria-hidden />
                    ) : (
                      <ChevronRight className="w-3 h-3" aria-hidden />
                    )}
                    {label}
                    <span className="sr-only">
                      , {trackEvents.length} {trackEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      className="ml-5 mt-1 space-y-2"
                    >
                      {trackEvents.map((event, idx) => {
                        const isSelected = selectedEvent === event.time;
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedEvent(event.time)}
                            aria-current={isSelected ? 'true' : undefined}
                            aria-label={`Jump to ${event.time}, ${event.label}`}
                            className={`w-full flex items-start gap-2 py-1.5 px-2 text-left text-[11px] transition-colors ${
                              isSelected
                                ? 'bg-primary/10 border-l-2 border-primary -ml-[2px]'
                                : 'hover:bg-background/50'
                            }`}
                          >
                            <Circle className="w-2 h-2 mt-0.5 flex-shrink-0" aria-hidden />
                            <div className="flex-1">
                              <div className="font-mono text-foreground-secondary">{event.time}</div>
                              <div className="font-mono text-foreground">{event.label}</div>
                            </div>
                          </button>
                        );
                      })}
                      {trackEvents.length === 0 && (
                        <div
                          className="px-2 py-1 text-[10px] text-foreground-secondary"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          No {label.toLowerCase()} for this incident.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center column - Context Viewer */}
        <div className="w-[40%] border-r border-border bg-background overflow-hidden flex flex-col">
          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Context viewer"
            className="border-b border-border flex"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {(['map', 'video', 'pcr', 'cad'] as ViewTab[]).map((tab) => {
              const selected = activeTab === tab;
              const tabLabel =
                tab === 'pcr' ? 'PCR SOURCE' : tab === 'cad' ? 'CAD LOG' : tab.toUpperCase();
              return (
                <button
                  key={tab}
                  id={`viewer-tab-${tab}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`viewer-panel-${tab}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-xs tracking-wider transition-colors relative ${
                    selected
                      ? 'text-foreground'
                      : 'text-foreground-secondary hover:text-foreground'
                  }`}
                >
                  {tabLabel}
                  {selected && (
                    <div
                      aria-hidden
                      className="absolute bottom-0 left-0 right-0 h-[1px] bg-primary"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div
            role="tabpanel"
            id={`viewer-panel-${activeTab}`}
            aria-labelledby={`viewer-tab-${activeTab}`}
            className="flex-1 overflow-y-auto"
          >
            {activeTab === 'map' && (
              <div className="h-full relative flex items-center justify-center" style={{ background: 'var(--subcard)' }}>
                <div
                  className="absolute top-4 right-4 bg-surface border border-border px-3 py-2 text-xs"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  <div className="text-foreground-secondary">GPS</div>
                  <div className="text-foreground">34.0522, -118.2437</div>
                </div>
                <div className="flex flex-col items-center gap-3 text-foreground-secondary">
                  <MapPin className="w-8 h-8" aria-hidden />
                  <div className="text-xs tracking-wide">MAP VIEW</div>
                  <div
                    className="text-[11px] text-center px-8"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    Route playback isn't wired up in this build. Use the timeline to step through events.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="h-full flex items-center justify-center bg-background p-8">
                {!showVideoFootage ? (
                  <div className="max-w-md text-center">
                    <div className="mb-8">
                      <Volume2 className="w-12 h-12 mx-auto mb-4 text-foreground-secondary" aria-hidden />
                      <div className="text-sm tracking-wide mb-6" style={{ fontFamily: 'var(--font-mono)' }}>
                        AUDIO ONLY
                      </div>
                      <div className="h-16 border border-border bg-surface flex items-center justify-center">
                        <div className="flex gap-0.5 items-end h-8">
                          {Array.from({ length: 40 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-1 bg-primary"
                              style={{ height: `${Math.random() * 100}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-destructive mb-4 tracking-wide">
                      Footage may contain graphic content.
                    </div>
                    <button
                      onClick={() => setShowVideoFootage(true)}
                      className="px-6 py-2 border border-border text-sm tracking-wide hover:bg-surface transition-colors"
                    >
                      DISPLAY VIDEO FOOTAGE
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <video
                      src={`${API_BASE}/api/cases/${resolvedId}/video`}
                      controls
                      preload="metadata"
                      className="max-w-full max-h-full"
                    >
                      <track kind="captions" />
                    </video>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pcr' && (
              <div className="p-6">
                <div className="bg-surface border border-border p-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  <div className="text-xs text-foreground-secondary mb-4">
                    ePCR DOCUMENT / PATIENT CARE REPORT
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="text-foreground-secondary">INCIDENT #</div>
                      <div className="text-foreground">{incident.pcr.incidentNumber}</div>
                      <div className="text-foreground-secondary">UNIT</div>
                      <div className="text-foreground">{incident.pcr.unit}</div>
                      <div className="text-foreground-secondary">CREW</div>
                      <div className="text-foreground">{incident.pcr.crew}</div>
                      <div className="text-foreground-secondary">CHIEF COMPLAINT</div>
                      <div className="text-foreground">{incident.pcr.chiefComplaint}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cad' && (
              <div className="p-6">
                <div className="bg-surface border border-border p-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  <div className="text-xs text-foreground-secondary mb-4">CAD EVENT LOG</div>
                  <div className="space-y-2 text-xs">
                    {incident.cadLog.map((entry, idx) => (
                      <div key={idx} className="flex gap-4">
                        <span className="text-foreground-secondary">{entry.time}</span>
                        <span className="text-foreground">{entry.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Report */}
        <div className="w-[35%] bg-surface overflow-y-auto">
          <div className="p-6 space-y-3">
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

                  {isExpanded && section.content && (
                    <div className="px-4 pb-4 space-y-4">
                      <div className="text-sm leading-relaxed">
                        {section.content}
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
    </div>
  );
}
