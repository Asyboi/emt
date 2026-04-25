import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Upload, X } from 'lucide-react';

interface UploadedFile {
  name: string;
  size: number;
}

export function NewReport() {
  const navigate = useNavigate();
  const [reportTitle, setReportTitle] = useState('');
  const [epcr, setEpcr] = useState<UploadedFile | null>(null);
  const [cad, setCad] = useState<UploadedFile | null>(null);
  const [videos, setVideos] = useState<UploadedFile[]>([]);

  const canGenerate = reportTitle.trim().length > 0 && epcr && (cad || videos.length > 0);

  const handleFileUpload = (
    setter: (file: UploadedFile | null) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setter({ name: file.name, size: file.size });
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setVideos(prev => [...prev, ...files.map(f => ({ name: f.name, size: f.size }))]);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleGenerate = () => {
    navigate('/processing');
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

              {/* ePCR Upload */}
              <div>
                <label className="block text-xs tracking-wide mb-2 text-foreground-secondary">
                  ePCR FILE (PDF/XML)
                </label>
                <div className="border border-border bg-background p-4">
                  {epcr ? (
                    <div className="flex items-center justify-between">
                      <div style={{ fontFamily: 'var(--font-mono)' }} className="text-sm">
                        <div className="text-foreground">{epcr.name}</div>
                        <div className="text-xs text-foreground-secondary">{formatSize(epcr.size)}</div>
                      </div>
                      <button
                        onClick={() => setEpcr(null)}
                        className="p-1 hover:text-destructive transition-colors"
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

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full mt-8 px-6 py-3 bg-primary text-primary-foreground tracking-wide text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              GENERATE REPORT
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