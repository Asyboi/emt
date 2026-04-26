interface PlaybackControlsProps {
  isPlaying: boolean;
  progress: number;
  simTime: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function PlaybackControls({
  isPlaying,
  progress,
  simTime,
  onPlay,
  onPause,
  onReset,
}: PlaybackControlsProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-72">
      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${progress * 100}%`,
            background: 'var(--primary)',
          }}
        />
      </div>

      <div
        className="flex items-center gap-3 rounded-full px-4 py-2 border border-border"
        style={{ background: 'var(--surface)' }}
      >
        <button
          onClick={onReset}
          className="text-foreground-secondary hover:text-foreground text-sm transition-colors"
          title="Reset"
        >
          ↺
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
          style={{
            background: 'var(--primary)',
            color: 'white',
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span className="text-xs text-foreground-secondary font-mono w-20 text-center">
          {formatTime(simTime)}
        </span>
      </div>
    </div>
  );
}
