import { Link, useNavigate } from 'react-router';
import { ClipboardCheck, FileText, Play } from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();

  const handleDemo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/processing/case_01?demo=1');
  };

  const handlePcrDemo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/pcr-draft/case_01?demo=1');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border px-8 py-4 flex items-center justify-between">
        <h1 className="tracking-[0.2em] text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
          CALYX
        </h1>
        <Link
          to="/archive"
          className="text-sm tracking-wide hover:text-primary transition-colors"
        >
          SAVED REPORTS
        </Link>
      </div>

      {/* Main content */}
      <div className="flex items-start justify-center pt-24 px-4">
        <div className="w-full max-w-[900px]">
          <h2
            className="text-xs tracking-[0.15em] mb-8 text-foreground-secondary"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            DASHBOARD
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to="/qi-review"
              className="group relative bg-surface border border-border p-10 flex flex-col justify-between min-h-[280px] hover:border-primary transition-colors"
            >
              <div>
                <ClipboardCheck className="w-10 h-10 text-primary mb-6" strokeWidth={1.5} />
                <h3
                  className="text-2xl tracking-wide mb-3 text-foreground"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  QI Review
                </h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">
                  Reconstruct an incident from ePCR, CAD, and video. Reconcile timeline,
                  check protocols, and produce a reviewer-ready case review.
                </p>
              </div>
              <div className="flex items-end justify-between mt-8 gap-4">
                <div
                  className="text-xs tracking-[0.15em] text-foreground-secondary group-hover:text-primary transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  OPEN →
                </div>
                <button
                  type="button"
                  onClick={handleDemo}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background hover:border-primary hover:text-primary transition-colors text-[10px] tracking-[0.15em] text-foreground-secondary"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  aria-label="Run QI Review with local sample data"
                >
                  <Play className="w-3 h-3" strokeWidth={1.8} />
                  DEMO
                </button>
              </div>
            </Link>

            <Link
              to="/pcr-new"
              className="group relative bg-surface border border-border p-10 flex flex-col justify-between min-h-[280px] hover:border-primary transition-colors"
            >
              <div>
                <FileText className="w-10 h-10 text-primary mb-6" strokeWidth={1.5} />
                <h3
                  className="text-2xl tracking-wide mb-3 text-foreground"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  PCR Generator
                </h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">
                  Draft a structured Patient Care Report from body-cam, dispatch audio,
                  and CAD evidence. Review, edit, and confirm before saving.
                </p>
              </div>
              <div className="flex items-end justify-between mt-8 gap-4">
                <div
                  className="text-xs tracking-[0.15em] text-foreground-secondary group-hover:text-primary transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  OPEN →
                </div>
                <button
                  type="button"
                  onClick={handlePcrDemo}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background hover:border-primary hover:text-primary transition-colors text-[10px] tracking-[0.15em] text-foreground-secondary"
                  style={{ fontFamily: 'var(--font-mono)' }}
                  aria-label="View PCR Generator with local sample data"
                >
                  <Play className="w-3 h-3" strokeWidth={1.8} />
                  DEMO
                </button>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
