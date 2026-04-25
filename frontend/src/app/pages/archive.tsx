import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search } from 'lucide-react';

interface SavedReport {
  id: string;
  date: string;
  crew: string;
  status: 'finalized' | 'draft';
}

export function Archive() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const reports: SavedReport[] = [
    { id: 'INC-2026-04-0231', date: '2026-04-12', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'finalized' },
    { id: 'INC-2026-04-0228', date: '2026-04-11', crew: 'M-3 / WILLIAMS, KIM', status: 'finalized' },
    { id: 'INC-2026-04-0224', date: '2026-04-10', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'draft' },
    { id: 'INC-2026-04-0219', date: '2026-04-09', crew: 'M-5 / MARTINEZ, PATEL', status: 'finalized' },
    { id: 'INC-2026-04-0215', date: '2026-04-08', crew: 'M-3 / WILLIAMS, KIM', status: 'finalized' },
    { id: 'INC-2026-04-0211', date: '2026-04-07', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'finalized' },
    { id: 'INC-2026-04-0207', date: '2026-04-06', crew: 'M-4 / THOMPSON, LEE', status: 'finalized' },
    { id: 'INC-2026-04-0203', date: '2026-04-05', crew: 'M-5 / MARTINEZ, PATEL', status: 'draft' },
    { id: 'INC-2026-04-0198', date: '2026-04-04', crew: 'M-3 / WILLIAMS, KIM', status: 'finalized' },
    { id: 'INC-2026-04-0194', date: '2026-04-03', crew: 'M-7 / RODRIGUEZ, CHEN', status: 'finalized' },
  ];

  const filteredReports = reports.filter(
    (r) =>
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.date.includes(searchQuery) ||
      r.crew.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReportClick = (report: SavedReport) => {
    if (report.status === 'draft') {
      navigate(`/review/${report.id}`);
    } else {
      navigate(`/finalize/${report.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border px-8 py-6 flex items-center justify-between">
        <h1 className="text-lg tracking-wide">SAVED REPORTS</h1>
        <Link
          to="/"
          className="px-5 py-2.5 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-opacity"
        >
          + NEW REPORT
        </Link>
      </div>

      {/* Search bar */}
      <div className="px-8 py-6">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH BY ID, DATE, CREW"
            className="w-full bg-transparent border border-border pl-12 pr-4 py-3 text-sm outline-none focus:border-primary transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-8">
        <div className="border border-border bg-surface">
          {/* Table header */}
          <div
            className="grid grid-cols-[200px_150px_1fr_120px] gap-4 px-6 py-3 border-b border-border text-xs tracking-[0.1em] text-foreground-secondary"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            <div>INCIDENT ID</div>
            <div>DATE</div>
            <div>CREW</div>
            <div>STATUS</div>
          </div>

          {/* Table rows */}
          <div>
            {filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() => handleReportClick(report)}
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

          {filteredReports.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-foreground-secondary">
              No reports found matching your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
