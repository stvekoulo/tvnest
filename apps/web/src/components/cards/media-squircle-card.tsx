// Carte média Squircle TVNest avec affiche résiliente, EPG et ouverture de fiche dédiée.
import { Heart, Info, Play, Star } from 'lucide-react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { ActionSwapIcon } from '@/components/motion/action-swap';
import { cn } from '@/lib/utils';
import type { EpgProgram, UnifiedMedia } from '@/types/iptv.types';

interface MediaSquircleCardProps {
  item: UnifiedMedia;
  epg?: EpgProgram | null;
  active?: boolean;
  onPlay: () => void;
  onOpenDetail?: () => void;
  onToggleFavorite: () => void;
}

export function MediaSquircleCard({
  item,
  epg,
  active,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
}: MediaSquircleCardProps) {
  const isLive = item.kind === 'live';
  const hasDetailPage = !isLive && Boolean(onOpenDetail);
  const progressPct =
    item.progressSeconds && item.durationSeconds && item.durationSeconds > 0
      ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
      : 0;

  return (
    // Survol en CSS plutôt qu'en composant animé : une grille de 140 cartes se rend bien plus
    // vite quand on change de rubrique.
    <div
      onClick={() => (hasDetailPage ? onOpenDetail?.() : onPlay())}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-[22px] border bg-card transition-[transform,border-color] duration-200 ease-out hover:-translate-y-[3px] motion-reduce:hover:translate-y-0',
        active
          ? 'border-primary/70 ring-1 ring-primary/35'
          : 'border-border hover:border-primary/40'
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden bg-elevated',
          isLive ? 'aspect-video' : 'aspect-[2/3]'
        )}
      >
        <MediaArtwork
          src={item.posterUrl}
          title={item.title}
          kind={item.kind}
          fit={isLive ? 'contain' : 'cover'}
          className="h-full w-full"
          imgClassName="group-hover:scale-105"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-80 transition-opacity group-hover:opacity-95" />

        {/* Badges supérieurs */}
        <div className="absolute inset-x-2.5 top-2.5 z-10 flex items-center justify-between gap-1.5">
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              Direct
            </span>
          ) : item.rating && Number(item.rating) > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
              <Star className="size-2.5 fill-current" />
              {Number(item.rating).toFixed(1)}
            </span>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label="Basculer favori"
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full border backdrop-blur-md transition-colors',
              item.isFavorite
                ? 'border-white/40 bg-white/20 text-white'
                : 'border-white/15 bg-black/55 text-white/80 opacity-0 group-hover:opacity-100 hover:text-white'
            )}
          >
            <ActionSwapIcon value={item.isFavorite ? 'fav' : 'idle'} className="size-3.5">
              <Heart className={cn('size-3.5', item.isFavorite && 'fill-current')} />
            </ActionSwapIcon>
          </button>
        </div>

        {/* Actions rapides au survol */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            title={item.kind === 'series' ? 'Ouvrir les saisons' : 'Lire maintenant'}
            className="flex size-11 items-center justify-center rounded-full bg-white text-black shadow-lg shadow-black/40 transition-transform hover:scale-105"
          >
            <Play className="ml-0.5 size-4 fill-white" />
          </button>
          {hasDetailPage ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail?.();
              }}
              title="Fiche détaillée"
              className="flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white backdrop-blur-md hover:bg-black"
            >
              <Info className="size-4" />
            </button>
          ) : null}
        </div>

        {progressPct > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
          </div>
        ) : null}
      </div>

      {/* Métadonnées inférieures */}
      <div className="flex flex-1 flex-col justify-between gap-1 p-3">
        <h5 className="line-clamp-1 text-xs font-semibold text-foreground" title={item.title}>
          {item.title}
        </h5>
        {epg ? (
          <p className="line-clamp-1 text-[11px] font-medium text-primary">{epg.title}</p>
        ) : (
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{item.category}</span>
            {item.year ? <span className="shrink-0 font-mono text-[10px]">{item.year}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}
