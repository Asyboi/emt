import { useEffect, useRef } from 'react';
import type { SimulationEvent, MapMode } from './types';

interface EventCalloutsProps {
  event: SimulationEvent;
  anchor: { x: number; y: number } | null;
  containerSize: { w: number; h: number };
  mode: MapMode;
  // Case bodycam video URL. When set, the left card renders an actual <video>
  // seeked to `event.timestamp`. When undefined (no case video available), the
  // card falls back to the original placeholder.
  caseVideoUrl?: string;
  onConfirm: (eventId: string) => void;
  onSkip: () => void;
  onDismiss: () => void;
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    icon: '⚠️',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    icon: '🔔',
  },
  info: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    icon: 'ℹ️',
  },
} as const;

// Matches the Mapbox dark-v11 road color so leader lines blend in as if drawn
// on the streets themselves.
const LINE_COLOR = '#8a8a8a';

const CARD_W = 260;
const CARD_H = 180;
const GAP_X = 70; // horizontal offset from anchor to inner card edge
const GAP_Y = 60; // vertical offset from anchor up to card bottom edge

export function EventCallouts({
  event,
  anchor,
  containerSize,
  mode,
  caseVideoUrl,
  onConfirm,
  onSkip,
  onDismiss,
}: EventCalloutsProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // When the active event changes, seek the video to event.timestamp and play.
  // Browsers won't let us seek before metadata loads, so wait on `loadedmetadata`
  // when the video isn't ready yet.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const seekAndPlay = () => {
      try {
        v.currentTime = event.timestamp;
      } catch {
        // some browsers throw if duration isn't known yet — loadedmetadata retry below
      }
      // muted autoplay is allowed by default in modern browsers
      v.play().catch(() => {
        // user gesture required — leave the video paused on the seeked frame
      });
    };
    if (v.readyState >= 1 /* HAVE_METADATA */) {
      seekAndPlay();
    } else {
      const onMeta = () => {
        seekAndPlay();
        v.removeEventListener('loadedmetadata', onMeta);
      };
      v.addEventListener('loadedmetadata', onMeta);
      return () => v.removeEventListener('loadedmetadata', onMeta);
    }
  }, [event.id, event.timestamp]);

  if (!anchor || !containerSize.w) return null;
  const s = SEVERITY_STYLES[event.severity];

  // Cards sit diagonally above the anchor — video to the upper-left, description
  // to the upper-right — so the leader lines come off at the top-left and
  // top-right angles of the event point.
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(v, hi));

  const videoLeft = clamp(
    anchor.x - GAP_X - CARD_W,
    16,
    containerSize.w - CARD_W - 16
  );
  const descLeft = clamp(anchor.x + GAP_X, 16, containerSize.w - CARD_W - 16);
  const cardTop = clamp(anchor.y - GAP_Y - CARD_H, 16, containerSize.h - CARD_H - 16);

  // Leader lines terminate at the inner-bottom corner of each card (closest to
  // the anchor), so the line visually connects the corner to the event point.
  const videoLineFrom = { x: videoLeft + CARD_W, y: cardTop + CARD_H };
  const descLineFrom = { x: descLeft, y: cardTop + CARD_H };

  return (
    <>
      {/* Leader lines — full-bleed SVG behind the cards */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={containerSize.w}
        height={containerSize.h}
        style={{ overflow: 'visible' }}
      >
        <line
          x1={videoLineFrom.x}
          y1={videoLineFrom.y}
          x2={anchor.x}
          y2={anchor.y}
          stroke={LINE_COLOR}
          strokeWidth={1.5}
          strokeOpacity={0.85}
          strokeDasharray="4 3"
        />
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={descLineFrom.x}
          y2={descLineFrom.y}
          stroke={LINE_COLOR}
          strokeWidth={1.5}
          strokeOpacity={0.85}
          strokeDasharray="4 3"
        />
        <circle
          cx={anchor.x}
          cy={anchor.y}
          r={3}
          fill={LINE_COLOR}
          fillOpacity={0.9}
        />
      </svg>

      {/* Video card — left */}
      <div
        className="absolute rounded-xl overflow-hidden shadow-2xl border border-border"
        style={{
          left: videoLeft,
          top: cardTop,
          width: CARD_W,
          height: CARD_H,
          background: '#000',
        }}
      >
        {caseVideoUrl ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={caseVideoUrl}
              muted
              playsInline
              preload="metadata"
              controls
              className="w-full h-full object-cover"
            />
            <div
              className="absolute top-2 left-2 text-[10px] tracking-wider px-2 py-0.5 rounded font-mono"
              style={{
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
              }}
            >
              t={event.timestamp}s
            </div>
          </div>
        ) : (
          <div
            className={`relative w-full h-full flex flex-col items-center justify-center ${s.bg}`}
            style={{ background: 'var(--surface)' }}
          >
            <div className="text-4xl mb-2">{s.icon}</div>
            <div className="text-xs text-foreground-secondary text-center px-4 font-mono">
              {event.videoUrl.split('/').pop()}
            </div>
            <div className="text-xs text-foreground-secondary mt-1 font-mono">
              t={event.timestamp}s
            </div>
            <div
              className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded"
              style={{
                background: 'var(--border)',
                color: 'var(--foreground-secondary)',
              }}
            >
              VIDEO PLACEHOLDER
            </div>
          </div>
        )}
      </div>

      {/* Description card — right */}
      <div
        className="absolute rounded-xl overflow-hidden shadow-2xl border border-border p-4 flex flex-col justify-between"
        style={{
          left: descLeft,
          top: cardTop,
          width: CARD_W,
          height: CARD_H,
          background: 'var(--surface)',
        }}
      >
        <div>
          <div
            className={`text-xs font-semibold uppercase tracking-wider mb-1 ${s.text}`}
          >
            {event.severity} · {event.label}
          </div>
          <p className="text-sm text-foreground leading-relaxed">{event.finding}</p>
          {mode === 'emt-review' && event.pcrLine && (
            <div
              className="mt-2 p-2 rounded text-xs text-foreground-secondary font-mono"
              style={{ background: 'var(--background)' }}
            >
              PCR: {event.pcrLine}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {mode === 'emt-review' ? (
            <>
              <button
                onClick={() => onConfirm(event.id)}
                className="flex-1 bg-success text-white text-xs py-2 rounded-lg font-medium"
              >
                ✓ Confirm
              </button>
              <button
                onClick={onSkip}
                className="flex-1 text-xs py-2 rounded-lg font-medium border border-border text-foreground-secondary"
              >
                Skip
              </button>
            </>
          ) : (
            <button
              onClick={onDismiss}
              className="flex-1 text-xs py-2 rounded-lg font-medium border border-border text-foreground-secondary"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
