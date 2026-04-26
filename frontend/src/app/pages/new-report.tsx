import { useState } from 'react';
import { useNavigate } from 'react-router';
import { API_BASE } from '../../data/api';
import { useSavedPcrs } from '../../data/pcr-hooks';
import { getDataSource } from '../../data/source';
import type { Case } from '../../types/backend';
import {
  Aside,
  ClassificationBanner,
  FieldFootnote,
  FieldHint,
  FileChip,
  FilingError,
  FilingFooter,
  FilingPage,
  FONT_MONO,
  FONT_SANS,
  MultiFileSlot,
  Section,
  SingleFileSlot,
  TitleBlock,
  useFilingSerial,
  type AsideBlockItem,
  type ChecklistItem,
  type MetaItem,
} from '../components/filing';

type EpcrSource = 'upload' | 'saved';

const formatSavedAt = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const ASIDE_BLOCKS: AsideBlockItem[] = [
  {
    label: 'PRELIMINARY NOTE',
    body: 'The filing is treated as a single canonical record for the incident. Once submitted it is processed end-to-end before reviewer hand-off.',
  },
  {
    label: 'CHAIN OF CUSTODY',
    body: 'Uploaded media is stored alongside the case and is never reused across cases. Each exhibit is timestamped on receipt.',
  },
  {
    label: 'WHAT IS REQUIRED',
    body: 'A filing identifier, a Patient Care Report (uploaded or referenced), and at least one corroborating exhibit (CAD, video, or audio).',
  },
  {
    label: 'WHAT IS NOT',
    body: 'Personally-identifying information beyond what already exists in the narrative — addresses, names, MRNs are read but never indexed.',
  },
];

export function NewReport() {
  const navigate = useNavigate();
  const [reportTitle, setReportTitle] = useState('');
  const [epcr, setEpcr] = useState<File | null>(null);
  const [cad, setCad] = useState<File | null>(null);
  const [videos, setVideos] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epcrSource, setEpcrSource] = useState<EpcrSource>('upload');
  const [selectedPcrCaseId, setSelectedPcrCaseId] = useState<string>('');

  const filing = useFilingSerial('QI');
  const isLocal = getDataSource().mode === 'local';
  const {
    pcrs: savedPcrs,
    loading: savedPcrsLoading,
    error: savedPcrsError,
  } = useSavedPcrs();

  const epcrProvided =
    epcrSource === 'upload' ? epcr !== null : selectedPcrCaseId.length > 0;

  const hasMedia = cad !== null || videos.length > 0 || audio !== null;
  const hasTitle = reportTitle.trim().length > 0;

  const canGenerate = !submitting && hasTitle && epcrProvided && hasMedia;

  const exhibitsAttached =
    (epcrProvided ? 1 : 0) +
    (cad ? 1 : 0) +
    (videos.length > 0 ? 1 : 0) +
    (audio ? 1 : 0);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setVideos((prev) => [...prev, ...files]);
  };

  const handleGenerate = async () => {
    setError(null);
    if (isLocal) {
      navigate('/processing/case_01');
      return;
    }
    if (epcrSource === 'upload' && !epcr) {
      setError('ePCR file is required.');
      return;
    }
    if (epcrSource === 'saved' && !selectedPcrCaseId) {
      setError('Select a saved PCR.');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', reportTitle);
      if (epcrSource === 'upload' && epcr) {
        form.append('epcr', epcr);
      } else if (epcrSource === 'saved' && selectedPcrCaseId) {
        form.append('pcr_source_case_id', selectedPcrCaseId);
      }
      if (cad) form.append('cad', cad);
      videos.forEach((v) => form.append('videos', v));
      if (audio) form.append('audio', audio);
      const res = await fetch(`${API_BASE}/api/cases`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Upload failed (${res.status})`);
      }
      const newCase: Case = await res.json();
      navigate(`/processing/${newCase.case_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setSubmitting(false);
    }
  };

  const meta: MetaItem[] = [
    { label: 'FILING SERIAL', value: filing.serial, strong: true },
    { label: 'OPENED', value: filing.pretty },
    { label: 'REVIEWING AGENCY', value: '—' },
    { label: 'STATUS', value: 'DRAFT · UNFILED', accent: true },
  ];

  const checklist: ChecklistItem[] = [
    { done: hasTitle, label: 'Title set' },
    { done: epcrProvided, label: 'PCR attached' },
    { done: hasMedia, label: '≥1 exhibit' },
  ];

  return (
    <FilingPage>
      <ClassificationBanner
        classification="OFFICIAL · QUALITY-IMPROVEMENT REVIEW"
        formCode="FORM QI-1 · INTAKE"
      />

      <TitleBlock
        meta={meta}
        headline={
          <>
            Quality Incident
            <br />
            Filing
          </>
        }
        subtitle={
          <>
            Submit the source materials for a single emergency response. The
            system reconciles the patient care narrative against dispatch,
            body-cam, and CAD records and returns a reviewer-ready case packet
            for the QI committee.
          </>
        }
      />

      <div
        className="grid gap-x-12 gap-y-10"
        style={{ gridTemplateColumns: 'minmax(0, 2.4fr) minmax(0, 1fr)' }}
      >
        <div className="min-w-0 flex flex-col gap-12">
          <Section
            num="01"
            kind="REQUIRED"
            title="Filing identifier"
            description="Used in the case index and on every page of the resulting review packet."
          >
            <CaseTitleInput value={reportTitle} onChange={setReportTitle} />
          </Section>

          <Section
            num="02"
            kind="REQUIRED"
            title="Patient Care Report"
            description="Submit the canonical narrative either as a fresh document or by referencing a confirmed PCR already in the archive."
          >
            <EpcrSourcePicker
              source={epcrSource}
              onSourceChange={setEpcrSource}
              file={epcr}
              onFile={setEpcr}
              pcrs={savedPcrs}
              loading={savedPcrsLoading}
              err={savedPcrsError}
              selectedPcrCaseId={selectedPcrCaseId}
              onSelectPcr={setSelectedPcrCaseId}
            />
          </Section>

          <Section
            num="03"
            kind="EXHIBIT"
            title="Computer-Aided Dispatch export"
            description="JSON record from the CAD system. Provides authoritative timestamps that anchor the reconciled timeline."
          >
            <SingleFileSlot
              file={cad}
              onSelect={setCad}
              accept=".json,.txt,application/json"
              placeholder="Select CAD export…"
              tag="cad.json"
            />
          </Section>

          <Section
            num="04"
            kind="EXHIBIT"
            title="Body-cam footage"
            description="Multiple files allowed. Combined visual record reconstructs interventions and bystander positioning."
          >
            <MultiFileSlot
              files={videos}
              onAdd={handleVideoUpload}
              onRemove={(idx) => setVideos(videos.filter((_, i) => i !== idx))}
              accept="video/*"
              emptyCta="Choose body-cam clips"
              emptyHint="multiple files allowed · video/*"
              appendLabel="Append clip"
            />
          </Section>

          <Section
            num="05"
            kind="EXHIBIT"
            title="Dispatch audio"
            description="Single file (MP3 / WAV / M4A). Transcribed and aligned with CAD events to surface verbal protocol calls."
          >
            <SingleFileSlot
              file={audio}
              onSelect={setAudio}
              accept=".mp3,.wav,.m4a,audio/*"
              placeholder="Select audio recording…"
              tag="dispatch.{mp3|wav|m4a}"
            />
          </Section>

          {error && <FilingError message={error} />}
        </div>

        <Aside blocks={ASIDE_BLOCKS} />
      </div>

      <FilingFooter
        attachedCount={exhibitsAttached}
        totalCount={4}
        checklist={checklist}
        canSubmit={canGenerate}
        submitting={submitting}
        primaryLabel="File for review"
        busyLabel="Filing…"
        onSubmit={handleGenerate}
      />
    </FilingPage>
  );
}

// ── Page-specific inputs ─────────────────────────────────────────────────────

function CaseTitleInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <FieldHint>FILING TITLE</FieldHint>
      <div
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--foreground)',
          background: 'var(--surface)',
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="M-7 · Rodriguez / Chen · Cardiac Arrest 04-23-2026"
          style={{
            width: '100%',
            background: 'transparent',
            border: 0,
            outline: 'none',
            padding: '18px 4px',
            fontFamily: FONT_MONO,
            fontSize: 16,
            letterSpacing: '0.01em',
            color: 'var(--foreground)',
          }}
        />
      </div>
      <FieldFootnote>
        Recommended convention: unit · crew · chief complaint · date.
      </FieldFootnote>
    </label>
  );
}

function EpcrSourcePicker({
  source,
  onSourceChange,
  file,
  onFile,
  pcrs,
  loading,
  err,
  selectedPcrCaseId,
  onSelectPcr,
}: {
  source: EpcrSource;
  onSourceChange: (s: EpcrSource) => void;
  file: File | null;
  onFile: (f: File | null) => void;
  pcrs: { case_id: string; confirmed_at: string | null; confirmed_by: string | null }[];
  loading: boolean;
  err: { message: string } | null;
  selectedPcrCaseId: string;
  onSelectPcr: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}
    >
      <SourceCard
        active={source === 'upload'}
        onSelect={() => onSourceChange('upload')}
        index="A"
        label="Upload ePCR file"
        sublabel="PDF or XML — direct from the writer"
      >
        <div
          style={
            source === 'upload' ? {} : { opacity: 0.35, pointerEvents: 'none' }
          }
        >
          {file ? (
            <FileChip
              name={file.name}
              size={file.size}
              onRemove={() => onFile(null)}
            />
          ) : (
            <SimpleDropTarget
              accept=".pdf,.xml"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (next) onFile(next);
              }}
            />
          )}
        </div>
      </SourceCard>

      <SourceCard
        active={source === 'saved'}
        onSelect={() => onSourceChange('saved')}
        index="B"
        label="Reference confirmed PCR"
        sublabel="Already filed in the archive"
      >
        <div
          style={
            source === 'saved' ? {} : { opacity: 0.35, pointerEvents: 'none' }
          }
        >
          {loading ? (
            <SourceMessage>Loading saved PCRs…</SourceMessage>
          ) : err ? (
            <SourceMessage tone="danger">
              Could not load saved PCRs: {err.message}
            </SourceMessage>
          ) : pcrs.length === 0 ? (
            <SourceMessage>
              No confirmed PCRs yet. File one through the PCR generator to
              reference it here.
            </SourceMessage>
          ) : (
            <select
              value={selectedPcrCaseId}
              onChange={(e) => onSelectPcr(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                outline: 'none',
                padding: '12px 14px',
                fontFamily: FONT_MONO,
                fontSize: 13,
                letterSpacing: '0.02em',
                color: 'var(--foreground)',
              }}
            >
              <option value="">— SELECT FROM ARCHIVE —</option>
              {pcrs.map((p) => (
                <option key={p.case_id} value={p.case_id}>
                  {p.case_id} · {formatSavedAt(p.confirmed_at)}
                  {p.confirmed_by ? ` · ${p.confirmed_by}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </SourceCard>
    </div>
  );
}

function SourceCard({
  active,
  onSelect,
  index,
  label,
  sublabel,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  index: string;
  label: string;
  sublabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: active ? 'var(--surface)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'var(--foreground)' : 'var(--border)',
        padding: '18px 20px 22px',
        transition: 'border-color 180ms ease, background 180ms ease',
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          width: '100%',
          marginBottom: 18,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 18,
            height: 18,
            border: `1px solid ${active ? 'var(--primary-strong)' : 'var(--border)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)',
          }}
        >
          {active && (
            <span
              style={{
                width: 8,
                height: 8,
                background: 'var(--primary-strong)',
              }}
            />
          )}
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--foreground-secondary)',
            minWidth: 16,
          }}
        >
          {index}
        </span>
        <span
          style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}
        >
          <span
            style={{
              fontFamily: FONT_SANS,
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--foreground)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: 'var(--foreground-secondary)',
              letterSpacing: '0.04em',
            }}
          >
            {sublabel}
          </span>
        </span>
      </button>

      {children}
    </div>
  );
}

function SimpleDropTarget({
  accept,
  onChange,
}: {
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: 'var(--background)',
        border: '1px dashed var(--border)',
        cursor: 'pointer',
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: '0.06em',
        color: 'var(--foreground-secondary)',
        transition: 'border-color 160ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLLabelElement).style.borderColor =
          'var(--foreground)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLLabelElement).style.borderColor =
          'var(--border)';
      }}
    >
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <span>Choose file · {accept}</span>
    </label>
  );
}

function SourceMessage({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11.5,
        lineHeight: 1.55,
        color:
          tone === 'danger'
            ? 'var(--destructive)'
            : 'var(--foreground-secondary)',
        padding: '10px 0',
      }}
    >
      {children}
    </div>
  );
}
