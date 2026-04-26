import { Link } from 'react-router';

const FONT_MONO = 'var(--font-mono)';

interface Entry {
  n: string;
  audience: string;
  label: string;
  tagline: string;
  body: string;
  inputs: string[];
  output: { label: string; description: string };
  open: string;
  sample: string;
  sampleAria: string;
}

const ENTRIES: Entry[] = [
  {
    n: '01',
    audience: 'FOR ADMINISTRATORS',
    label: 'QI REVIEW',
    tagline: 'Reviewer-ready case files in minutes',
    body: 'Pulls every signal from a finished call into one reconciled record. Cross-checks the ePCR against dispatch audio, body-cam footage, and CAD timestamps to surface gaps in care, protocol deviations, and documentation conflicts. Hands your QI committee a structured packet with timeline, findings, and recommendations already drafted.',
    inputs: ['ePCR document', 'CAD record', 'Body-cam video', 'Dispatch audio'],
    output: {
      label: 'OUTPUT',
      description: 'Reconciled timeline, protocol compliance check, discrepancy findings, and clinical recommendations.',
    },
    open: '/qi-review',
    sample: '/processing/case_01?demo=1',
    sampleAria: 'Run QI Review with local sample data',
  },
  {
    n: '02',
    audience: 'FOR EMTS',
    label: 'PCR GENERATOR',
    tagline: 'Stop typing reports from scratch',
    body: 'Watches the body-cam, listens to dispatch, and reads the CAD record so you do not have to. Produces a structured Patient Care Report draft with every claim marked confirmed or unconfirmed, then steps you through a quick review where you accept, edit, or reject each line. Confirmed reports save back to your archive ready for handoff.',
    inputs: ['Body-cam video', 'Dispatch audio', 'CAD record'],
    output: {
      label: 'OUTPUT',
      description: 'A first-pass PCR with sourced events, vitals, and narrative for you to confirm or revise.',
    },
    open: '/pcr-new',
    sample: '/pcr-draft/case_01?demo=1',
    sampleAria: 'View PCR Generator with local sample data',
  },
];

function DashboardCard({ entry }: { entry: Entry }) {
  return (
    <div className="relative flex flex-col border border-border bg-background overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--foreground) 1px, transparent 1px)',
          backgroundSize: '48px 100%',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 w-px h-12 bg-foreground/20"
        style={{ top: '-1px', right: '32px' }}
      />

      <div className="relative flex items-center justify-between px-10 pt-8 pb-6 border-b border-border">
        <div
          className="flex items-center gap-3 text-[11px] tracking-[0.18em] text-foreground-secondary"
          style={{ fontFamily: FONT_MONO }}
        >
          <span style={{ color: 'var(--primary-strong)', fontWeight: 600 }}>
            {entry.n}
          </span>
          <span className="block h-px w-6 bg-foreground-secondary/60" aria-hidden />
          <span>{entry.audience}</span>
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-hidden
        >
          <span className="block w-1.5 h-1.5 rounded-full bg-foreground/30" />
          <span className="block w-1.5 h-1.5 rounded-full bg-foreground/30" />
          <span className="block w-1.5 h-1.5 rounded-full bg-foreground/30" />
        </div>
      </div>

      <div className="relative px-10 pt-10 pb-8">
        <h3
          className="text-[26px] tracking-[0.1em] text-foreground mb-4"
          style={{ fontFamily: FONT_MONO, fontWeight: 600 }}
        >
          {entry.label}
        </h3>
        <p
          className="text-[13px] tracking-[0.04em] text-foreground-secondary mb-6 italic"
          style={{ fontFamily: FONT_MONO }}
        >
          {entry.tagline}
        </p>
        <p className="text-[15px] leading-[1.65] text-foreground-secondary max-w-[52ch]">
          {entry.body}
        </p>
      </div>

      <div className="relative px-10 pb-8">
        <div
          className="flex items-center gap-3 text-[10.5px] tracking-[0.2em] text-foreground-secondary mb-4"
          style={{ fontFamily: FONT_MONO }}
        >
          <span>INPUTS</span>
          <span className="block flex-1 h-px bg-border" aria-hidden />
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 list-none m-0 p-0">
          {entry.inputs.map((input, idx) => (
            <li
              key={input}
              className="flex items-baseline gap-3 text-[13px] text-foreground"
            >
              <span
                className="text-[10.5px] tracking-[0.16em] text-foreground-secondary tabular-nums"
                style={{ fontFamily: FONT_MONO }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span>{input}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative px-10 pb-10 flex-1">
        <div
          className="flex items-center gap-3 text-[10.5px] tracking-[0.2em] text-foreground-secondary mb-4"
          style={{ fontFamily: FONT_MONO }}
        >
          <span>{entry.output.label}</span>
          <span className="block flex-1 h-px bg-border" aria-hidden />
        </div>
        <p className="text-[13.5px] leading-[1.6] text-foreground">
          {entry.output.description}
        </p>
      </div>

      <div className="relative mt-auto border-t border-border">
        <div className="grid grid-cols-2">
          <Link
            to={entry.open}
            className="group flex items-center justify-between gap-3 px-10 py-6 text-[11px] tracking-[0.2em] text-foreground hover:bg-foreground hover:text-background transition-colors border-r border-border"
            style={{ fontFamily: FONT_MONO, fontWeight: 600 }}
          >
            <span>OPEN</span>
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
          <Link
            to={entry.sample}
            className="group flex items-center justify-between gap-3 px-10 py-6 text-[11px] tracking-[0.2em] text-foreground-secondary hover:text-foreground transition-colors"
            style={{ fontFamily: FONT_MONO }}
            aria-label={entry.sampleAria}
          >
            <span>TRY DEMO</span>
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  return (
    <div className="h-full overflow-hidden bg-background flex items-center justify-center px-10">
      <div className="w-full max-w-[1320px] flex flex-col">
        <div
          className="flex items-center gap-3 text-[11px] tracking-[0.18em] text-foreground-secondary mb-8"
          style={{ fontFamily: FONT_MONO }}
        >
          <span className="block h-px w-6 bg-foreground-secondary/60" aria-hidden />
          DASHBOARD
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-24">
          {ENTRIES.map((e) => (
            <DashboardCard key={e.n} entry={e} />
          ))}
        </div>
      </div>
    </div>
  );
}
