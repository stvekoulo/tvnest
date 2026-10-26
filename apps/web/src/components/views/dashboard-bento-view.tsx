// Accueil Bento TVNest : sélections SQLite réelles, affiches résilientes et mini-lecteur.
import { ChevronLeft, ChevronRight, History, Maximize2, Pause, Play, Radio } from 'lucide-react';
import { useState } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { Button } from '@/components/motion/button/base';
import { Switch } from '@/components/motion/switch';
import { PlayerSlot } from '@/components/player/player-host';
import { DashboardHeroRow, EmptyOnboardingState } from '@/components/views/dashboard-hero-row';
import { MediaRailSection } from '@/components/views/media-rail-section';
import type { DashboardHighlightsState } from '@/hooks/use-catalog-query';
import type { UiLanguage } from '@/lib/i18n';
import { isSameWatchItem } from '@/lib/resume-point';
import type {
  AppSection,
  EpgProgram,
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

interface DashboardBentoViewProps {
  playlists: UnifiedPlaylist[];
  activePlaylist: UnifiedPlaylist | null;
  categories: UnifiedCategory[];
  highlights: DashboardHighlightsState;
  fallbackItems: UnifiedMedia[];
  activeMedia: UnifiedMedia | null;
  isPlaying: boolean;
  onSetPlaying: (v: boolean) => void;
  suppressPreviewPlayer: boolean;
  autoplay: boolean;
  onToggleAutoplay: (v: boolean) => void;
  epgByChannel: Record<string, EpgProgram | null>;
  uiLanguage: UiLanguage;
  onPlay: (item: UnifiedMedia, expand?: boolean) => void;
  onOpenDetail: (item: UnifiedMedia) => void;
  onToggleFavorite: (item: UnifiedMedia) => void;
  onOpenAddSource: () => void;
  onNavigateCategory: (cat: UnifiedCategory) => void;
  onNavigateSection: (sec: AppSection) => void;
  onExpandTheater: () => void;
}

const KIND_LABEL: Record<UnifiedMedia['kind'], string> = {
  live: 'Direct',
  movie: 'Film',
  series: 'Série',
  episode: 'Épisode',
};

export function DashboardBentoView({
  playlists,
  activePlaylist,
  categories,
  highlights,
  fallbackItems,
  activeMedia,
  isPlaying,
  onSetPlaying,
  suppressPreviewPlayer,
  autoplay,
  onToggleAutoplay,
  epgByChannel,
  uiLanguage,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  onOpenAddSource,
  onNavigateCategory,
  onNavigateSection,
  onExpandTheater,
}: DashboardBentoViewProps) {
  const [pickIdx, setPickIdx] = useState(0);

  if (playlists.length === 0) {
    return <EmptyOnboardingState onOpenAddSource={onOpenAddSource} />;
  }

  const open = (item: UnifiedMedia, expand: boolean) =>
    item.kind === 'series' ? onOpenDetail(item) : onPlay(item, expand);

  const spotlight = highlights.spotlight.length > 0 ? highlights.spotlight : fallbackItems.slice(0, 8);
  const pickPool = highlights.favorites.length > 0 ? highlights.favorites : spotlight;
  const pickCount = Math.max(1, pickPool.length);
  const pickItem = pickPool[pickIdx % pickCount];
  // « Reprendre » = média en cours, sinon dernier élément réellement regardé (historique).
  const resumeItem = activeMedia || highlights.continueWatching[0] || null;
  // Média en cours : sa ligne d'historique porte la progression mise à jour en direct.
  const progressOf =
    (activeMedia && highlights.continueWatching.find((r) => isSameWatchItem(r, activeMedia))) || resumeItem;
  const resumeProgress =
    progressOf?.progressSeconds && progressOf.durationSeconds
      ? Math.min(100, (progressOf.progressSeconds / progressOf.durationSeconds) * 100)
      : null;
  // Une seule ligne de 5 par rangée.
  const vodRow = (highlights.recentMovies.length > 0 ? highlights.recentMovies : fallbackItems).slice(0, 5);
  const seriesRow = highlights.recentSeries.slice(0, 5);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-5 sm:space-y-10 sm:px-6 sm:py-7 lg:px-8">
      <DashboardHeroRow
        spotlight={spotlight}
        categories={categories}
        totalStreamCount={activePlaylist?.channelCount || fallbackItems.length}
        onSelectCat={onNavigateCategory}
        onPlay={onPlay}
        onOpenDetail={onOpenDetail}
        onToggleFavorite={onToggleFavorite}
        onNavigateSection={onNavigateSection}
        uiLanguage={uiLanguage}
      />

      {/* Rangée centrale : Reprendre (5) + Favoris (3) + Mini-lecteur (4) */}
      <div className="grid grid-cols-12 gap-5">
        {resumeItem ? (
          <button
            type="button"
            onClick={() => open(resumeItem, true)}
            className="group relative col-span-12 h-[220px] overflow-hidden rounded-[28px] border border-border bg-black p-6 text-left text-white shadow-lg sm:h-[240px] lg:col-span-5"
          >
            <MediaArtwork
              src={resumeItem.backdropUrl || resumeItem.posterUrl}
              title={resumeItem.title}
              kind={resumeItem.kind}
              className="absolute inset-0 h-full w-full bg-black opacity-60"
              imgClassName="transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/30" />

            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {activeMedia && isPlaying ? 'En cours de lecture' : 'Reprendre'}
                </span>
                <h3 className="mt-1.5 truncate font-display text-lg font-bold">{resumeItem.title}</h3>
                <p className="truncate text-xs text-zinc-300">{resumeItem.category}</p>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Play className="size-3.5 fill-current text-white" /> Ouvrir en mode Cinéma
                  </span>
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {KIND_LABEL[resumeItem.kind]}
                  </span>
                </div>
                {resumeProgress !== null ? (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white" style={{ width: `${resumeProgress}%` }} />
                  </div>
                ) : null}
              </div>
            </div>
          </button>
        ) : (
          <div className="col-span-12 flex h-[220px] flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-border bg-card p-6 text-center sm:h-[240px] lg:col-span-5">
            <History className="size-6 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Aucune lecture récente</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Lancez une chaîne, un film ou un épisode : vous le retrouverez ici pour reprendre.
            </p>
          </div>
        )}

        {/* Favoris (ou suggestions si aucun favori) */}
        <div className="col-span-12 flex h-[240px] flex-col justify-between rounded-[28px] border border-border bg-card p-6 md:col-span-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {highlights.favorites.length > 0 ? 'Vos favoris' : 'À découvrir'}
            </h3>
            {pickPool.length > 1 ? (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  aria-label="Précédent"
                  onClick={() => setPickIdx((p) => (p - 1 + pickCount) % pickCount)}
                  className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-elevated text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Suivant"
                  onClick={() => setPickIdx((p) => (p + 1) % pickCount)}
                  className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-elevated text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            ) : null}
          </div>

          {pickItem ? (
            <>
              <div className="my-auto py-2">
                <p className="line-clamp-2 text-sm font-bold text-foreground">{pickItem.title}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{pickItem.category}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Favori</span>
                  <Switch
                    checked={Boolean(pickItem.isFavorite)}
                    onCheckedChange={() => onToggleFavorite(pickItem)}
                    ariaLabel="Favori"
                  />
                </div>
                <Button size="sm" variant="primary" onClick={() => open(pickItem, false)} className="w-full">
                  <Play className="size-3 fill-current" />
                  {pickItem.kind === 'series' ? 'Voir les épisodes' : 'Lire en aperçu'}
                </Button>
              </div>
            </>
          ) : null}
        </div>

        {/* Mini-lecteur (désactivé si le mode Cinéma ou une fiche est ouverte) */}
        <div className="relative col-span-12 h-[240px] overflow-hidden rounded-[28px] border border-border bg-black text-white md:col-span-7 lg:col-span-4">
          {activeMedia && !suppressPreviewPlayer ? (
            <>
              <PlayerSlot />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60" />
              <div className="absolute inset-x-5 top-4 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {isPlaying ? 'En lecture' : 'En pause'}
                  </span>
                  <p className="truncate text-xs font-bold">{activeMedia.title}</p>
                </div>
                <Switch checked={autoplay} onCheckedChange={onToggleAutoplay} ariaLabel="Lecture automatique" />
              </div>
              <div className="absolute inset-x-5 bottom-4 flex items-center justify-between">
                <button
                  type="button"
                  aria-label={isPlaying ? 'Pause' : 'Lecture'}
                  onClick={() => onSetPlaying(!isPlaying)}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-white text-black shadow"
                >
                  {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
                </button>
                <button
                  type="button"
                  onClick={onExpandTheater}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 text-[11px] font-medium backdrop-blur-md hover:bg-white/20"
                >
                  <Maximize2 className="size-3.5" /> Cinéma
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <Radio className="size-6 text-zinc-500" />
              <p className="text-xs font-semibold text-zinc-200">Aperçu direct</p>
              <p className="max-w-xs text-[11px] text-zinc-500">
                Lancez une chaîne Live ou un film pour l’afficher ici.
              </p>
            </div>
          )}
        </div>
      </div>

      {vodRow.length > 0 ? (
        <MediaRailSection
          title="Films à l’affiche"
          onSeeAll={() => onNavigateSection('movies')}
          items={vodRow}
          epgByChannel={epgByChannel}
          onPlay={(item) => onPlay(item, true)}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />
      ) : null}

      {seriesRow.length > 0 ? (
        <MediaRailSection
          title="Séries populaires"
          onSeeAll={() => onNavigateSection('series')}
          items={seriesRow}
          epgByChannel={epgByChannel}
          onPlay={(item) => onOpenDetail(item)}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />
      ) : null}
    </div>
  );
}
