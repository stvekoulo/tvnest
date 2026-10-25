// En-tête supérieur de l'OSD TVNest Cinema (infos flux, stats, lecteurs externes, fermeture).
import { Activity, ExternalLink, Tv, X } from 'lucide-react';
import type { EmbeddedMpvStreamStats } from '@iptvnator/shared/interfaces';
import { Button } from '@/components/motion/button/base';
import { TvNestLogo } from '@/components/shell/tvnest-logo';
import type { PlayerEngineKind } from '@/hooks/use-tvnest-player';
import { cn } from '@/lib/utils';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { UnifiedMedia } from '@/types/iptv.types';

interface PlayerOsdHeaderProps {
  media: UnifiedMedia;
  docked?: boolean;
  engine: PlayerEngineKind;
  resolution: string | null;
  stats?: EmbeddedMpvStreamStats;
  showStats: boolean;
  onToggleStats: () => void;
  onOpenExternal: (player: 'mpv' | 'vlc') => void;
  onClose?: () => void;
}

export function PlayerOsdHeader({
  media,
  docked = false,
  engine,
  resolution,
  stats,
  showStats,
  onToggleStats,
  onOpenExternal,
  onClose,
}: PlayerOsdHeaderProps) {
  const isLive = media.kind === 'live';

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center justify-between gap-3 px-5 pt-4',
        docked ? 'pb-2' : 'bg-gradient-to-b from-black/85 via-black/40 to-transparent pb-8'
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <TvNestLogo size="xs" />
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            Direct
          </span>
        ) : null}
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-white">
            {media.title}
          </h4>
          <p className="truncate text-[11px] text-zinc-300">
            {media.category}
            {stats?.videoCodec ? ` · ${stats.videoCodec.toUpperCase()}` : ''}
            {resolution ? ` · ${resolution}` : ''}
          </p>
        </div>
        <span className="hidden rounded-md border border-white/40 bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white sm:inline-block">
          {engine === 'libmpv' ? 'LIBMPV' : engine.toUpperCase()}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleStats}
          title="Statistiques du flux"
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-full border text-white transition-colors',
            showStats
              ? 'border-white/40 bg-white/30'
              : 'border-white/15 bg-black/50 hover:bg-white/15'
          )}
        >
          <Activity className="size-3.5" />
        </button>

        {isElectronRuntime() ? (
          <>
            <Button
              size="sm"
              variant="glass"
              onClick={() => onOpenExternal('mpv')}
              className="h-8 px-3 text-[11px]"
            >
              <Tv className="size-3.5" />
              MPV
            </Button>
            <Button
              size="sm"
              variant="glass"
              onClick={() => onOpenExternal('vlc')}
              className="h-8 px-3 text-[11px]"
            >
              <ExternalLink className="size-3.5" />
              VLC
            </Button>
          </>
        ) : null}

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Fermer (Échap)"
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-white/20"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
