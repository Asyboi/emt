import { Eye, EyeOff, FileVideo } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TimelineMarker } from "@/components/TimelineMarker";
import { cn } from "@/lib/cn";
import type { Finding } from "@/types/schemas";

interface VideoPaneProps {
  videoUrl: string | null;
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string) => void;
  seekTarget?: { ts: number; nonce: number } | null;
}

export function VideoPane({
  videoUrl,
  findings,
  selectedFindingId,
  onSelectFinding,
  seekTarget,
}: VideoPaneProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [hasVideo, setHasVideo] = useState(false);
  const [blurred, setBlurred] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!selectedFindingId || !videoRef.current || !hasVideo) return;
    const finding = findings.find((f) => f.finding_id === selectedFindingId);
    if (!finding) return;
    try {
      videoRef.current.currentTime = finding.evidence_timestamp_seconds;
    } catch {
      // ignore seek errors before metadata loaded
    }
  }, [selectedFindingId, findings, hasVideo]);

  useEffect(() => {
    if (!seekTarget || !videoRef.current || !hasVideo) return;
    try {
      videoRef.current.currentTime = seekTarget.ts;
    } catch {
      // ignore seek errors before metadata loaded
    }
  }, [seekTarget, hasVideo]);

  const fallbackDuration =
    findings.length > 0
      ? Math.max(...findings.map((f) => f.evidence_timestamp_seconds)) + 60
      : 600;
  const effectiveDuration = duration > 0 ? duration : fallbackDuration;
  const showOverlay = blurred && !revealed && hasVideo;

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <FileVideo className="h-4 w-4" />
          Body-cam
        </h2>
        <button
          type="button"
          onClick={() => {
            setBlurred((v) => !v);
            setRevealed(false);
          }}
          className={cn(
            "inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors",
            blurred
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
          )}
          title="Trauma-content blur"
        >
          {blurred ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {blurred ? "Blur on" : "Blur off"}
        </button>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              preload="metadata"
              className={cn(
                "w-full h-full transition-[filter] duration-200",
                showOverlay && "blur-2xl scale-110",
              )}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration || 0);
                setHasVideo(true);
              }}
              onError={() => setHasVideo(false)}
            />
            {showOverlay && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-medium hover:bg-black/30 transition-colors"
              >
                <span className="px-3 py-1.5 rounded-md bg-white/10 border border-white/30 backdrop-blur-sm">
                  Click to reveal graphic content
                </span>
              </button>
            )}
            {!hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                Video unavailable
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-400 text-sm flex flex-col items-center gap-2 p-6">
            <FileVideo className="h-8 w-8" />
            <span>No video for this case</span>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs text-gray-500 mb-1.5 flex justify-between">
          <span>Findings timeline</span>
          <span className="font-mono">
            {Math.floor(effectiveDuration / 60)}:
            {String(Math.floor(effectiveDuration % 60)).padStart(2, "0")}
          </span>
        </div>
        <div className="relative h-6 rounded bg-gray-100 border border-gray-200">
          {findings.map((finding) => (
            <TimelineMarker
              key={finding.finding_id}
              finding={finding}
              durationSeconds={effectiveDuration}
              isSelected={finding.finding_id === selectedFindingId}
              onSelect={onSelectFinding}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-red-500" /> Critical
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-amber-500" /> Concern
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-blue-500" /> Info
          </span>
        </div>
      </div>
    </div>
  );
}
