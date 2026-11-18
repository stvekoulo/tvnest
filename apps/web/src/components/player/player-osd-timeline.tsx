// Barre de progression temporelle accessible au clavier pour l'OSD TVNest Cinema.

export function formatPlayerTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

interface PlayerOsdTimelineProps {
  position: number;
  duration: number;
  onSeekTo: (sec: number) => void;
  onSeekBy: (delta: number) => void;
}

export function PlayerOsdTimeline({
  position,
  duration,
  onSeekTo,
  onSeekBy,
}: PlayerOsdTimelineProps) {
  const progressPct =
    duration > 0 ? Math.min(100, (position / duration) * 100) : 100;

  return (
    <div className="mb-2.5 flex items-center gap-3">
      <span className="w-14 text-right font-mono text-[11px] tabular-nums text-zinc-300">
        {formatPlayerTime(position)}
      </span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, Math.floor(duration))}
        aria-valuenow={Math.floor(position)}
        aria-valuetext={`${formatPlayerTime(position)} sur ${formatPlayerTime(duration)}`}
        onClick={(e) => {
          if (!duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width)
          );
          onSeekTo(ratio * duration);
        }}
        onKeyDown={(e) => {
          if (!duration) return;
          const step = e.shiftKey ? 60 : 10;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeekBy(-step);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeekBy(step);
          } else if (e.key === 'Home') {
            e.preventDefault();
            onSeekTo(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            onSeekTo(duration);
          }
        }}
        className="group relative flex h-4 flex-1 cursor-pointer items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover:h-2">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <span className="w-14 font-mono text-[11px] tabular-nums text-zinc-400">
        {formatPlayerTime(duration)}
      </span>
    </div>
  );
}
