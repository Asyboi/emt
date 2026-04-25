import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronDown, ChevronRight, Circle, MapPin, Video, FileText, List, Volume2 } from 'lucide-react';

type SectionStatus = 'draft' | 'edited' | 'approved';

interface ReportSection {
  id: number;
  title: string;
  status: SectionStatus;
  content: string;
  citations: number[];
}

type ViewTab = 'map' | 'video' | 'pcr' | 'cad';

interface TimelineEvent {
  time: string;
  label: string;
  category: 'cad' | 'gps' | 'video' | 'pcr' | 'vitals';
}

export function Review() {
  const { incidentId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ViewTab>('map');
  const [expandedSection, setExpandedSection] = useState(1);
  const [showVideoFootage, setShowVideoFootage] = useState(false);
  const [keyMomentsOnly, setKeyMomentsOnly] = useState(true);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set(['cad', 'gps', 'video', 'pcr', 'vitals']));
  const [selectedEvent, setSelectedEvent] = useState<string>('14:32');

  const [sections, setSections] = useState<ReportSection[]>([
    {
      id: 1,
      title: 'INCIDENT SUMMARY',
      status: 'draft',
      content: 'OHCA arrest of 67-year-old male at residential address. Initial rhythm VF, converted to NSR after single defibrillation at 200J. ROSC achieved at 14:38, 6 minutes post-arrest. Patient transported to Regional Medical Center with ongoing ventilatory support and hemodynamic monitoring.',
      citations: [1, 2, 4],
    },
    {
      id: 2,
      title: 'TIMELINE RECONSTRUCTION',
      status: 'draft',
      content: '',
      citations: [],
    },
    {
      id: 3,
      title: 'PCR DOCUMENTATION CHECK',
      status: 'draft',
      content: '',
      citations: [],
    },
    {
      id: 4,
      title: 'PROTOCOL COMPLIANCE REVIEW',
      status: 'draft',
      content: '',
      citations: [],
    },
    {
      id: 5,
      title: 'KEY CLINICAL DECISIONS',
      status: 'draft',
      content: '',
      citations: [],
    },
    {
      id: 6,
      title: 'COMMUNICATION / SCENE MANAGEMENT',
      status: 'draft',
      content: '',
      citations: [],
    },
    {
      id: 7,
      title: 'STRENGTHS',
      status: 'draft',
      content: '',
      citations: [],
    },
    {
      id: 8,
      title: 'AREAS FOR IMPROVEMENT',
      status: 'draft',
      content: '',
      citations: [],
    },
    {
      id: 9,
      title: 'RECOMMENDED FOLLOW-UP',
      status: 'draft',
      content: '',
      citations: [],
    },
  ]);

  const timelineEvents: TimelineEvent[] = [
    { time: '14:32', label: 'DISPATCH / CARDIAC ARREST', category: 'cad' },
    { time: '14:33', label: 'EN ROUTE M-7', category: 'gps' },
    { time: '14:36', label: 'ON SCENE', category: 'gps' },
    { time: '14:37', label: 'INITIAL RHYTHM VF', category: 'pcr' },
    { time: '14:37', label: 'DEFIB 200J', category: 'pcr' },
    { time: '14:38', label: 'ROSC ACHIEVED', category: 'pcr' },
    { time: '14:38', label: 'BP 98/64', category: 'vitals' },
    { time: '14:42', label: 'TRANSPORTING', category: 'gps' },
    { time: '14:48', label: 'ARRIVAL REGIONAL MC', category: 'cad' },
  ];

  const getStatusTag = (status: SectionStatus) => {
    switch (status) {
      case 'draft':
        return <span className="text-foreground-secondary">[DRAFT]</span>;
      case 'edited':
        return <span className="text-primary">[EDITED]</span>;
      case 'approved':
        return <span className="text-success">[APPROVED]</span>;
    }
  };

  const toggleSection = (id: number) => {
    setExpandedSection(expandedSection === id ? 0 : id);
  };

  const approveSection = (id: number) => {
    setSections(sections.map(s =>
      s.id === id ? { ...s, status: 'approved' } : s
    ));
  };

  const allApproved = sections.every(s => s.status === 'approved');

  const toggleTrack = (track: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev);
      if (next.has(track)) {
        next.delete(track);
      } else {
        next.add(track);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4" style={{ fontFamily: 'var(--font-mono)' }}>
          <span className="text-sm">{incidentId || 'INC-2026-04-0231'}</span>
          <span className="text-foreground-secondary text-sm">/</span>
          <span className="text-sm text-foreground-secondary">2026-04-12 14:32</span>
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
            onClick={() => navigate(`/finalize/${incidentId}`)}
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
            {['CAD EVENTS', 'GPS PATH', 'VIDEO SEGMENTS', 'PCR ENTRIES', 'VITALS'].map((track) => {
              const trackKey = track.toLowerCase().split(' ')[0];
              const isExpanded = expandedTracks.has(trackKey);
              const trackEvents = timelineEvents.filter(e => e.category === trackKey);

              return (
                <div key={track}>
                  <button
                    onClick={() => toggleTrack(trackKey)}
                    className="w-full flex items-center gap-2 py-1 text-[11px] tracking-wider text-foreground-secondary hover:text-foreground transition-colors"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {track}
                  </button>
                  {isExpanded && (
                    <div className="ml-5 mt-1 space-y-2">
                      {trackEvents.map((event, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedEvent(event.time)}
                          className={`w-full flex items-start gap-2 py-1.5 px-2 text-left text-[11px] transition-colors ${
                            selectedEvent === event.time
                              ? 'bg-primary/10 border-l-2 border-primary -ml-[2px]'
                              : 'hover:bg-background/50'
                          }`}
                        >
                          <Circle className="w-2 h-2 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-mono text-foreground-secondary">{event.time}</div>
                            <div className="font-mono text-foreground">{event.label}</div>
                          </div>
                        </button>
                      ))}
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
          <div className="border-b border-border flex" style={{ fontFamily: 'var(--font-mono)' }}>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-3 text-xs tracking-wider transition-colors relative ${
                activeTab === 'map' ? 'text-foreground' : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              MAP
              {activeTab === 'map' && <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-4 py-3 text-xs tracking-wider transition-colors relative ${
                activeTab === 'video' ? 'text-foreground' : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              VIDEO
              {activeTab === 'video' && <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab('pcr')}
              className={`px-4 py-3 text-xs tracking-wider transition-colors relative ${
                activeTab === 'pcr' ? 'text-foreground' : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              PCR SOURCE
              {activeTab === 'pcr' && <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab('cad')}
              className={`px-4 py-3 text-xs tracking-wider transition-colors relative ${
                activeTab === 'cad' ? 'text-foreground' : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              CAD LOG
              {activeTab === 'cad' && <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-primary" />}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'map' && (
              <div className="h-full relative bg-[#E8E7E3] flex items-center justify-center">
                <div className="absolute top-4 right-4 bg-surface border border-border px-3 py-2 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                  <div className="text-foreground-secondary">GPS</div>
                  <div className="text-foreground">34.0522, -118.2437</div>
                </div>
                <div className="flex flex-col items-center gap-3 text-foreground-secondary">
                  <MapPin className="w-8 h-8" />
                  <div className="text-xs tracking-wide">MAP VIEW</div>
                  <div className="text-[11px] text-center px-8" style={{ fontFamily: 'var(--font-mono)' }}>
                    Route visualization with unit tracking
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="h-full flex items-center justify-center bg-background p-8">
                {!showVideoFootage ? (
                  <div className="max-w-md text-center">
                    <div className="mb-8">
                      <Volume2 className="w-12 h-12 mx-auto mb-4 text-foreground-secondary" />
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
                    <div className="text-center">
                      <Video className="w-12 h-12 mx-auto mb-4 text-white/50" />
                      <div className="text-white/50 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                        VIDEO PLAYER
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pcr' && (
              <div className="p-6">
                <div className="bg-surface border border-border p-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  <div className="text-xs text-foreground-secondary mb-4">ePCR DOCUMENT / PATIENT CARE REPORT</div>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="text-foreground-secondary">INCIDENT #</div>
                      <div className="text-foreground">2026-041201</div>
                      <div className="text-foreground-secondary">UNIT</div>
                      <div className="text-foreground">M-7</div>
                      <div className="text-foreground-secondary">CREW</div>
                      <div className="text-foreground">RODRIGUEZ, CHEN</div>
                      <div className="text-foreground-secondary">CHIEF COMPLAINT</div>
                      <div className="text-foreground">CARDIAC ARREST</div>
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
                    <div className="flex gap-4">
                      <span className="text-foreground-secondary">14:32:18</span>
                      <span className="text-foreground">DISPATCH M-7 / CARDIAC ARREST / 1247 MAPLE AVE</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-foreground-secondary">14:33:42</span>
                      <span className="text-foreground">M-7 EN ROUTE</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-foreground-secondary">14:36:01</span>
                      <span className="text-foreground">M-7 ON SCENE</span>
                    </div>
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
                          <sup key={idx} className="text-primary mx-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
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
