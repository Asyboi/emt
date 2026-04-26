import { useState } from 'react';
import { useNavigate } from 'react-router';

import { API_BASE } from '../../data/api';
import { createPcrDraft } from '../../data/pcr-api';
import { getDataSource } from '../../data/source';
import type { Case } from '../../types/backend';
import {
  Aside,
  ClassificationBanner,
  FilingError,
  FilingFooter,
  FilingPage,
  Section,
  SingleFileSlot,
  TitleBlock,
  useFilingSerial,
  type AsideBlockItem,
  type ChecklistItem,
  type MetaItem,
} from '../components/filing';

const ASIDE_BLOCKS: AsideBlockItem[] = [
  {
    label: 'WHAT THIS DOES',
    body: 'The system reads your evidence end-to-end and drafts a structured PCR. You then step through the draft, accept or correct each line, and confirm before it lands in the archive.',
  },
  {
    label: 'EVIDENCE PROVENANCE',
    body: 'Every claim in the draft is paired with the source frame, transcript line, or CAD entry it came from. Anything the model could not verify is flagged [UNCONFIRMED] for you to fill in.',
  },
  {
    label: 'WHAT WE NEED',
    body: 'At least one of body-cam video or dispatch audio. CAD strengthens the timeline but is not strictly required for a draft.',
  },
  {
    label: 'WHAT WE DON\u2019T',
    body: 'No filing identifier — the case ID is assigned automatically. No manual narrative — the draft is generated, not transcribed.',
  },
];

export function PcrNew() {
  const navigate = useNavigate();
  const [video, setVideo] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [cad, setCad] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filing = useFilingSerial('PCR');
  const isLocal = getDataSource().mode === 'local';

  // Need at least one media source — CAD alone isn't enough for a useful draft.
  const hasPrimaryMedia = video !== null || audio !== null;
  const canGenerate = !submitting && hasPrimaryMedia;

  const exhibitsAttached =
    (video ? 1 : 0) + (audio ? 1 : 0) + (cad ? 1 : 0);

  const handleGenerate = async () => {
    setError(null);

    if (isLocal) {
      navigate('/pcr-draft/case_01?demo=1');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      if (video) form.append('videos', video);
      if (audio) form.append('audio', audio);
      if (cad) form.append('cad', cad);

      const res = await fetch(`${API_BASE}/api/cases`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Upload failed (${res.status})`);
      }
      const newCase: Case = await res.json();
      await createPcrDraft(newCase.case_id);
      navigate(`/pcr-draft/${newCase.case_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setSubmitting(false);
    }
  };

  const meta: MetaItem[] = [
    { label: 'DRAFT SERIAL', value: filing.serial, strong: true },
    { label: 'OPENED', value: filing.pretty },
    { label: 'ATTENDING EMT', value: '—' },
    {
      label: 'STATUS',
      value: hasPrimaryMedia ? 'READY · NOT FILED' : 'PENDING SOURCES',
      accent: hasPrimaryMedia,
    },
  ];

  const checklist: ChecklistItem[] = [
    { done: video !== null, label: 'Body-cam' },
    { done: audio !== null, label: 'Dispatch audio' },
    { done: cad !== null, label: 'CAD record' },
  ];

  return (
    <FilingPage>
      <ClassificationBanner
        classification="OFFICIAL · PATIENT CARE REPORT"
        formCode="FORM PCR-1 · DRAFT INTAKE"
      />

      <TitleBlock
        meta={meta}
        headline={
          <>
            Patient Care
            <br />
            Report Draft
          </>
        }
        subtitle={
          <>
            Hand the system the evidence from the call. It returns a structured
            PCR draft with every claim sourced to a video frame, transcript
            line, or CAD entry — for you to review, correct, and confirm before
            it joins the archive.
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
            kind="EXHIBIT"
            title="Body-cam footage"
            description="Single clip per filing. The visual record drives intervention timestamps and bystander positioning."
          >
            <SingleFileSlot
              file={video}
              onSelect={setVideo}
              accept="video/*"
              placeholder="Select body-cam clip…"
              tag="bodycam.* · video/*"
            />
          </Section>

          <Section
            num="02"
            kind="EXHIBIT"
            title="Dispatch audio"
            description="MP3 / WAV / M4A. Transcribed and aligned with CAD events to surface verbal protocol calls and timing."
          >
            <SingleFileSlot
              file={audio}
              onSelect={setAudio}
              accept=".mp3,.wav,.m4a,audio/*"
              placeholder="Select dispatch audio…"
              tag="dispatch.{mp3|wav|m4a}"
            />
          </Section>

          <Section
            num="03"
            kind="OPTIONAL"
            title="Computer-Aided Dispatch export"
            description="JSON record from the CAD system. Anchors the draft to authoritative timestamps and unit movements when present."
          >
            <SingleFileSlot
              file={cad}
              onSelect={setCad}
              accept=".json,application/json"
              placeholder="Select CAD export…"
              tag="cad.json"
            />
          </Section>

          {error && <FilingError message={error} />}
        </div>

        <Aside blocks={ASIDE_BLOCKS} />
      </div>

      <FilingFooter
        attachedCount={exhibitsAttached}
        totalCount={3}
        checklist={checklist}
        canSubmit={canGenerate}
        submitting={submitting}
        primaryLabel="Draft the report"
        busyLabel="Drafting…"
        onSubmit={handleGenerate}
      />
    </FilingPage>
  );
}
