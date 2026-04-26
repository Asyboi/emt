import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2, Upload, X } from 'lucide-react';

import { API_BASE } from '../../data/api';
import { createPcrDraft } from '../../data/pcr-api';
import { getDataSource } from '../../data/source';
import type { Case } from '../../types/backend';

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface UploadSlotProps {
  label: string;
  accept: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  hint?: string;
}

function UploadSlot({ label, accept, file, onSelect, hint }: UploadSlotProps) {
  return (
    <div>
      <label className="block text-xs tracking-wide mb-2 text-foreground-secondary">
        {label}
        {hint ? (
          <span className="ml-2 normal-case tracking-normal text-foreground-secondary/60">
            {hint}
          </span>
        ) : null}
      </label>
      <div className="border border-border bg-background p-4">
        {file ? (
          <div className="flex items-center justify-between">
            <div style={{ fontFamily: 'var(--font-mono)' }} className="text-sm">
              <div className="text-foreground">{file.name}</div>
              <div className="text-xs text-foreground-secondary">{formatSize(file.size)}</div>
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="p-1 hover:text-destructive transition-colors"
              aria-label={`Remove ${label}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                if (next) onSelect(next);
              }}
              className="hidden"
            />
            <div className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors">
              <Upload className="w-4 h-4" />
              <span className="tracking-wide">CHOOSE FILE</span>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}

export function PcrNew() {
  const navigate = useNavigate();
  const [video, setVideo] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [cad, setCad] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Need at least one media source — CAD alone isn't enough for a useful draft.
  const canGenerate = !submitting && (video !== null || audio !== null);

  const handleGenerate = async () => {
    setError(null);

    if (getDataSource().mode === 'local') {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border px-8 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="tracking-[0.2em] text-sm hover:text-primary transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          CALYX
        </Link>
        <Link
          to="/archive"
          className="text-sm tracking-wide hover:text-primary transition-colors"
        >
          SAVED REPORTS
        </Link>
      </div>

      {/* Main content */}
      <div className="flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-[600px]">
          <div className="bg-surface border border-border p-8">
            <h2
              className="text-xs tracking-[0.15em] mb-8 text-foreground-secondary"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              GENERATE PCR DRAFT
            </h2>

            <div className="space-y-6">
              <UploadSlot
                label="BODY-CAM VIDEO"
                accept="video/*"
                file={video}
                onSelect={setVideo}
                hint="recommended"
              />

              <UploadSlot
                label="DISPATCH AUDIO"
                accept="audio/*"
                file={audio}
                onSelect={setAudio}
                hint="recommended"
              />

              <UploadSlot
                label="CAD EXPORT"
                accept=".json"
                file={cad}
                onSelect={setCad}
                hint="optional"
              />
            </div>

            {error && (
              <div
                className="mt-6 px-4 py-3 border border-destructive/40 bg-destructive/5 text-xs text-destructive"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full mt-8 px-6 py-3 bg-primary text-primary-foreground tracking-wide text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'UPLOADING…' : 'GENERATE PCR DRAFT'}
            </button>
          </div>

          <p className="text-xs text-foreground-secondary text-center mt-6">
            The AI will draft a PCR from your evidence. You'll review and confirm before it's saved.
          </p>
        </div>
      </div>
    </div>
  );
}
