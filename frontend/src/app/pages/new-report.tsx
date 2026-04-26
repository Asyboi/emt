import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2, Upload, X } from 'lucide-react';
import { API_BASE } from '../../data/api';
import { useSavedPcrs } from '../../data/pcr-hooks';
import { getDataSource } from '../../data/source';
import type { Case } from '../../types/backend';

type EpcrSource = 'upload' | 'saved';

const FONT_MONO = 'var(--font-mono)';

const formatSavedAt = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export function NewReport() {
  const navigate = useNavigate();
  const [reportTitle, setReportTitle] = useState('');
  const [epcr, setEpcr] = useState<File | null>(null);
  const [cad, setCad] = useState<File | null>(null);
  const [videos, setVideos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epcrSource, setEpcrSource] = useState<EpcrSource>('upload');
  const [selectedPcrCaseId, setSelectedPcrCaseId] = useState<string>('');

  const isLocal = getDataSource().mode === 'local';
  const {
    pcrs: savedPcrs,
    loading: savedPcrsLoading,
    error: savedPcrsError,
  } = useSavedPcrs();

  const epcrProvided =
    epcrSource === 'upload' ? epcr !== null : selectedPcrCaseId.length > 0;

  const canGenerate =
    !submitting &&
    reportTitle.trim().length > 0 &&
    epcrProvided &&
    (cad !== null || videos.length > 0);

  const handleFileUpload = (
    setter: (file: File | null) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setter(file);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setVideos((prev) => [...prev, ...files]);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
      <div className="flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-[600px]">
          <div className="bg-surface border border-border p-8">
            <h2 className="text-xs tracking-[0.15em] mb-8 text-foreground-secondary" style={{ fontFamily: 'var(--font-sans)' }}>
              NEW INCIDENT REPORT
            </h2>

            <div className="space-y-6">
              {/* Report Title */}
              <div>
                <label className="block text-xs tracking-wide mb-2 text-foreground-secondary">
                  REPORT TITLE
                </label>
                <div className="border border-border bg-background">
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={e => setReportTitle(e.target.value)}
                    placeholder="e.g. M-7 · Rodriguez / Chen · Cardiac Arrest 04-23-2026"
                    className="w-full bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground-secondary/50 focus:ring-0"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* ePCR Source — upload a file OR pick a saved confirmed PCR */}
              <div>
                <label className="block text-xs tracking-wide mb-2 text-foreground-secondary">
                  ePCR SOURCE
                </label>
                <div className="border border-border bg-background">
                  {/* Upload option */}
                  <div className="p-4 border-b border-border">
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                      <input
                        type="radio"
                        name="epcr-source"
                        value="upload"
                        checked={epcrSource === 'upload'}
                        onChange={() => setEpcrSource('upload')}
                        className="accent-primary"
                      />
                      <span
                        className="text-xs tracking-wide"
                        style={{ fontFamily: FONT_MONO }}
                      >
                        UPLOAD ePCR FILE (PDF/XML)
                      </span>
                    </label>

                    <div
                      className={
                        epcrSource === 'upload'
                          ? 'pl-7'
                          : 'pl-7 opacity-40 pointer-events-none'
                      }
                    >
                      {epcr ? (
                        <div className="flex items-center justify-between">
                          <div
                            style={{ fontFamily: FONT_MONO }}
                            className="text-sm"
                          >
                            <div className="text-foreground">{epcr.name}</div>
                            <div className="text-xs text-foreground-secondary">
                              {formatSize(epcr.size)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEpcr(null)}
                            className="p-1 hover:text-destructive transition-colors"
                            aria-label="Remove ePCR file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.xml"
                            onChange={handleFileUpload(setEpcr)}
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

                  {/* Saved-PCR option */}
                  <div className="p-4">
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                      <input
                        type="radio"
                        name="epcr-source"
                        value="saved"
                        checked={epcrSource === 'saved'}
                        onChange={() => setEpcrSource('saved')}
                        className="accent-primary"
                      />
                      <span
                        className="text-xs tracking-wide"
                        style={{ fontFamily: FONT_MONO }}
                      >
                        USE SAVED PCR REPORT
                      </span>
                    </label>

                    <div
                      className={
                        epcrSource === 'saved'
                          ? 'pl-7'
                          : 'pl-7 opacity-40 pointer-events-none'
                      }
                    >
                      {savedPcrsLoading ? (
                        <div
                          className="text-xs text-foreground-secondary"
                          style={{ fontFamily: FONT_MONO }}
                        >
                          Loading saved PCRs…
                        </div>
                      ) : savedPcrsError ? (
                        <div
                          className="text-xs text-destructive"
                          style={{ fontFamily: FONT_MONO }}
                        >
                          Could not load saved PCRs: {savedPcrsError.message}
                        </div>
                      ) : savedPcrs.length === 0 ? (
                        <div
                          className="text-xs text-foreground-secondary"
                          style={{ fontFamily: FONT_MONO }}
                        >
                          No confirmed PCRs yet. Generate one from the dashboard.
                        </div>
                      ) : (
                        <select
                          value={selectedPcrCaseId}
                          onChange={(e) => setSelectedPcrCaseId(e.target.value)}
                          className="w-full bg-background border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                          style={{ fontFamily: FONT_MONO }}
                        >
                          <option value="">— SELECT A PCR —</option>
                          {savedPcrs.map((p) => (
                            <option key={p.case_id} value={p.case_id}>
                              {p.case_id} · {formatSavedAt(p.confirmed_at)}
                              {p.confirmed_by ? ` · ${p.confirmed_by}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* CAD Upload */}
              <div>
                <label className="block text-xs tracking-wide mb-2 text-foreground-secondary">
                  CAD EXPORT (INCLUDES AVL/GPS DATA)
                </label>
                <div className="border border-border bg-background p-4">
                  {cad ? (
                    <div className="flex items-center justify-between">
                      <div style={{ fontFamily: 'var(--font-mono)' }} className="text-sm">
                        <div className="text-foreground">{cad.name}</div>
                        <div className="text-xs text-foreground-secondary">{formatSize(cad.size)}</div>
                      </div>
                      <button
                        onClick={() => setCad(null)}
                        className="p-1 hover:text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        onChange={handleFileUpload(setCad)}
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

              {/* Video Upload */}
              <div>
                <label className="block text-xs tracking-wide mb-2 text-foreground-secondary">
                  VIDEO FOOTAGE (MULTIPLE FILES ALLOWED)
                </label>
                <div className="border border-border bg-background p-4">
                  {videos.length > 0 ? (
                    <div className="space-y-2">
                      {videos.map((video, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div style={{ fontFamily: 'var(--font-mono)' }} className="text-sm">
                            <div className="text-foreground">{video.name}</div>
                            <div className="text-xs text-foreground-secondary">{formatSize(video.size)}</div>
                          </div>
                          <button
                            onClick={() => setVideos(videos.filter((_, i) => i !== idx))}
                            className="p-1 hover:text-destructive transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <label className="block cursor-pointer mt-3 pt-3 border-t border-border">
                        <input
                          type="file"
                          accept="video/*"
                          multiple
                          onChange={handleVideoUpload}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors">
                          <Upload className="w-4 h-4" />
                          <span className="tracking-wide">ADD MORE FILES</span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors">
                        <Upload className="w-4 h-4" />
                        <span className="tracking-wide">CHOOSE FILES</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Dispatch Audio (Disabled) */}
              <div className="opacity-40">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-xs tracking-wide text-foreground-secondary">
                    DISPATCH AUDIO
                  </label>
                  <span
                    className="text-[10px] px-2 py-0.5 border border-border bg-background tracking-wider"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    STRETCH / V2
                  </span>
                </div>
                <div className="border border-border bg-background p-4 cursor-not-allowed">
                  <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                    <Upload className="w-4 h-4" />
                    <span className="tracking-wide">CHOOSE FILE</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div
                className="mt-6 px-4 py-3 border border-destructive/40 bg-destructive/5 text-xs text-destructive"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full mt-8 px-6 py-3 bg-primary text-primary-foreground tracking-wide text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'UPLOADING…' : 'GENERATE REPORT'}
            </button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-foreground-secondary text-center mt-6">
            Missing sources will result in partial reconstruction.
          </p>
        </div>
      </div>
    </div>
  );
}
