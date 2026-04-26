import { Link } from 'react-router';

const FONT_MONO = 'var(--font-mono)';

const ENTRIES = [
  {
    n: '01',
    label: 'QI REVIEW',
    body: 'Reconstruct an incident from ePCR, CAD, and video. Reconcile timeline, check protocols, produce a reviewer-ready case review.',
    open: '/qi-review',
    sample: '/processing/case_01?demo=1',
    sampleAria: 'Run QI Review with local sample data',
  },
  {
    n: '02',
    label: 'PCR GENERATOR',
    body: 'Draft a structured Patient Care Report from body-cam, dispatch audio, and CAD evidence. Review, edit, confirm.',
    open: '/pcr-new',
    sample: '/pcr-draft/case_01?demo=1',
    sampleAria: 'View PCR Generator with local sample data',
  },
];

export function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-10 py-4 flex items-center justify-between">
        <h1
          className="tracking-[0.2em] text-sm"
          style={{ fontFamily: FONT_MONO }}
        >
          CALYX
        </h1>
        <Link
          to="/archive"
          className="text-[11px] tracking-[0.16em] text-foreground-secondary hover:text-foreground transition-colors"
          style={{ fontFamily: FONT_MONO }}
        >
          SAVED REPORTS →
        </Link>
      </div>

      <div className="mx-auto max-w-[920px] px-10 pt-32 pb-24">
        <div
          className="flex items-center gap-3 text-[11px] tracking-[0.18em] text-foreground-secondary mb-10"
          style={{ fontFamily: FONT_MONO }}
        >
          <span className="block h-px w-6 bg-foreground-secondary/60" aria-hidden />
          DASHBOARD
        </div>

        <h2 className="text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-[-0.02em] mb-20 max-w-[14ch]">
          Two workflows.{' '}
          <span className="text-foreground-secondary">Pick one.</span>
        </h2>

        <ul className="border-t border-border list-none p-0 m-0">
          {ENTRIES.map((e) => (
            <li
              key={e.n}
              className="grid grid-cols-[64px_1fr_auto] gap-x-10 py-10 border-b border-border items-baseline"
            >
              <span
                className="text-[11px] tracking-[0.18em] text-foreground-secondary self-start pt-1"
                style={{ fontFamily: FONT_MONO }}
              >
                {e.n}
              </span>

              <div>
                <div
                  className="text-[13px] tracking-[0.12em] text-foreground mb-3"
                  style={{ fontFamily: FONT_MONO, fontWeight: 600 }}
                >
                  {e.label}
                </div>
                <p className="text-[15px] leading-[1.55] text-foreground-secondary max-w-[58ch]">
                  {e.body}
                </p>
                <Link
                  to={e.sample}
                  className="inline-block mt-5 text-[10.5px] tracking-[0.18em] text-foreground-secondary hover:text-foreground transition-colors"
                  style={{ fontFamily: FONT_MONO }}
                  aria-label={e.sampleAria}
                >
                  · TRY WITH SAMPLE DATA
                </Link>
              </div>

              <Link
                to={e.open}
                className="self-center text-[11px] tracking-[0.18em] text-foreground hover:text-primary transition-colors whitespace-nowrap"
                style={{ fontFamily: FONT_MONO }}
              >
                OPEN →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
