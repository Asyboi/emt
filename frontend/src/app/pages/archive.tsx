import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { useIncidentList } from '../../data/hooks';
import { isFinalizedLocally } from '../../data/approvals';
import { useSavedPcrs } from '../../data/pcr-hooks';
import { getDataSource } from '../../data/source';
import type { PCRDraft } from '../../types/backend';

type Tab = 'qi' | 'pcr';

// Used in demo / local mode where /api/pcr-drafts is not reachable.
const DEMO_SAVED_PCRS: PCRDraft[] = [
  {
    case_id: 'case_01',
    generated_at: '2026-04-25T15:30:00Z',
    status: 'confirmed',
    video_event_count: 12,
    audio_event_count: 8,
    total_event_count: 20,
    draft_markdown: '',
    unconfirmed_count: 6,
    confirmed_by: 'demo-emt',
    confirmed_at: '2026-04-25T15:42:00Z',
    emt_edits_made: false,
    error: null,
  },
];

function formatConfirmedAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function Archive() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>('qi');
  const [searchQuery, setSearchQuery] = useState('');

  const isDemo = params.get('demo') === '1' || getDataSource().mode === 'local';
  const demoSuffix = isDemo ? '?demo=1' : '';

  const { data: reports, loading, error } = useIncidentList();
  const {
    pcrs: livePcrs,
    loading: pcrLoadingLive,
    error: pcrErrorLive,
  } = useSavedPcrs();

  const pcrs = isDemo ? DEMO_SAVED_PCRS : livePcrs;
  const pcrLoading = isDemo ? false : pcrLoadingLive;
  const pcrError = isDemo ? null : pcrErrorLive;

  const q = searchQuery.toLowerCase();

  // Overlay locally-finalized cases onto the backend status. The backend's
  // `human_reviewed` flag isn't wired up to the UI yet, so the local flag
  // (set by Save Final Report) is what flips a row from DRAFT to FINALIZED.
  const enrichedReports = (reports ?? []).map((r) =>
    isFinalizedLocally(r.id) ? { ...r, status: 'finalized' as const } : r,
  );

  const filteredReports = enrichedReports.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.date.includes(searchQuery) ||
      r.crew.toLowerCase().includes(q)
  );

  const filteredPcrs = pcrs.filter((p) => {
    if (!q) return true;
    return (
      p.case_id.toLowerCase().includes(q) ||
      (p.confirmed_by ?? '').toLowerCase().includes(q) ||
      (p.confirmed_at ?? '').includes(searchQuery)
    );
  });

  const handleReportClick = (id: string, status: 'finalized' | 'draft') => {
    if (status === 'draft') {
      navigate(`/review/${id}`);
    } else {
      navigate(`/finalize/${id}`);
    }
  };

  const handlePcrClick = (caseId: string) => {
    navigate(`/pcr/${caseId}${demoSuffix}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border px-8 py-6 flex items-center justify-between">
        <h1 className="text-lg tracking-wide">SAVED REPORTS</h1>
        <Link
          to={tab === 'pcr' ? '/pcr-new' : '/qi-review'}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-opacity"
        >
          {tab === 'pcr' ? '+ NEW PCR' : '+ NEW REPORT'}
        </Link>
      </div>

      {/* Tabs */}
      <div className="px-8 pt-6">
        <div
          className="flex items-center gap-6 border-b border-border"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <button
            type="button"
            onClick={() => setTab('qi')}
            className={`pb-3 -mb-px text-xs tracking-[0.15em] transition-colors ${
              tab === 'qi'
                ? 'text-primary border-b-2 border-primary'
                : 'text-foreground-secondary hover:text-foreground'
            }`}
            aria-pressed={tab === 'qi'}
          >
            QI REVIEWS
          </button>
          <button
            type="button"
            onClick={() => setTab('pcr')}
            className={`pb-3 -mb-px text-xs tracking-[0.15em] transition-colors ${
              tab === 'pcr'
                ? 'text-primary border-b-2 border-primary'
                : 'text-foreground-secondary hover:text-foreground'
            }`}
            aria-pressed={tab === 'pcr'}
          >
            PCR REPORTS
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-8 py-6">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              tab === 'pcr'
                ? 'SEARCH BY CASE ID, DATE, CONFIRMED BY'
                : 'SEARCH BY ID, DATE, CREW'
            }
            className="w-full bg-transparent border border-border pl-12 pr-4 py-3 text-sm outline-none focus:border-primary transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-8">
        {tab === 'qi' ? (
          <div className="border border-border bg-surface">
            {/* QI table header */}
            <div
              className="grid grid-cols-[200px_150px_1fr_120px] gap-4 px-6 py-3 border-b border-border text-xs tracking-[0.1em] text-foreground-secondary"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              <div>INCIDENT ID</div>
              <div>DATE</div>
              <div>CREW</div>
              <div>STATUS</div>
            </div>

            {/* QI table rows */}
            <div>
              {filteredReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => handleReportClick(report.id, report.status)}
                  className="w-full grid grid-cols-[200px_150px_1fr_120px] gap-4 px-6 py-4 border-b border-border hover:bg-background transition-colors text-left"
                >
                  <div className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {report.id}
                  </div>
                  <div className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {report.date}
                  </div>
                  <div className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {report.crew}
                  </div>
                  <div>
                    <span
                      className={`inline-block px-2 py-1 text-xs tracking-wider ${
                        report.status === 'finalized'
                          ? 'bg-success/10 text-success border border-success/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {report.status === 'finalized' ? 'FINALIZED' : 'DRAFT'}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {loading && (
              <div className="px-6 py-12 text-center text-sm text-foreground-secondary">
                Loading…
              </div>
            )}

            {error && !loading && (
              <div className="px-6 py-12 text-center text-sm text-destructive">
                Failed to load reports: {error.message}
              </div>
            )}

            {!loading && !error && filteredReports.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-foreground-secondary">
                No reports found matching your search.
              </div>
            )}
          </div>
        ) : (
          <div className="border border-border bg-surface">
            {/* PCR table header */}
            <div
              className="grid grid-cols-[180px_180px_140px_90px_110px_90px] gap-4 px-6 py-3 border-b border-border text-xs tracking-[0.1em] text-foreground-secondary"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              <div>CASE ID</div>
              <div>CONFIRMED</div>
              <div>CONFIRMED BY</div>
              <div className="text-right">EVENTS</div>
              <div className="text-right">UNCONFIRMED</div>
              <div>EDITED</div>
            </div>

            {/* PCR table rows */}
            <div>
              {filteredPcrs.map((p) => (
                <button
                  key={p.case_id}
                  onClick={() => handlePcrClick(p.case_id)}
                  className="w-full grid grid-cols-[180px_180px_140px_90px_110px_90px] gap-4 px-6 py-4 border-b border-border hover:bg-background transition-colors text-left"
                >
                  <div className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {p.case_id}
                  </div>
                  <div className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {formatConfirmedAt(p.confirmed_at)}
                  </div>
                  <div className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                    {p.confirmed_by ?? '—'}
                  </div>
                  <div
                    className="text-sm text-right"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {p.total_event_count}
                  </div>
                  <div
                    className="text-sm text-right"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    <span
                      className={
                        p.unconfirmed_count > 0
                          ? 'text-primary'
                          : 'text-foreground-secondary'
                      }
                    >
                      {p.unconfirmed_count}
                    </span>
                  </div>
                  <div>
                    {p.emt_edits_made ? (
                      <span
                        className="inline-block px-2 py-1 text-xs tracking-wider bg-primary/10 text-primary border border-primary/20"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        EDITED
                      </span>
                    ) : (
                      <span
                        className="inline-block px-2 py-1 text-xs tracking-wider text-foreground-secondary"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        —
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {pcrLoading && (
              <div className="px-6 py-12 text-center text-sm text-foreground-secondary">
                Loading…
              </div>
            )}

            {pcrError && !pcrLoading && (
              <div className="px-6 py-12 text-center text-sm text-destructive">
                Failed to load PCR reports: {pcrError.message}
              </div>
            )}

            {!pcrLoading && !pcrError && filteredPcrs.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-foreground-secondary">
                {searchQuery
                  ? 'No PCR reports found matching your search.'
                  : 'No confirmed PCR reports yet. Generate one from the dashboard.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
