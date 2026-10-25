// Page dédiée pleine largeur pour la fiche détaillée d'un Film ou d'une Série (sans modal).
import { ArrowLeft, Calendar, Clock, Star, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { Button } from '@/components/motion/button/base';
import { Loader } from '@/components/motion/loader';
import { PlayerSlot } from '@/components/player/player-host';
import { MediaDetailActions } from '@/components/views/media-detail-actions';
import { SeriesEpisodesPanel } from '@/components/views/series-episodes-panel';
import { t, type UiLanguage } from '@/lib/i18n';
import { listEpisodeMedia } from '@/lib/series-episodes';
import type { SeriesDetail, UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

interface MediaDetailViewProps {
  media: UnifiedMedia;
  seriesDetail: SeriesDetail | null;
  loading: boolean;
  playlist?: UnifiedPlaylist | null;
  uiLanguage: UiLanguage;
  theaterOpen: boolean;
  /** Média du lecteur unique de l'application (affiché ici en lecture intégrée). */
  activeMedia: UnifiedMedia | null;
  onBack: () => void;
  onPlayInline: (item: UnifiedMedia) => void;
  onStopPlayback: () => void;
  onOpenExternal: (player: 'mpv' | 'vlc', item: UnifiedMedia) => void;
  onPlayTheater: (item: UnifiedMedia) => void;
  onToggleFavorite: (item: UnifiedMedia) => void;
  onDownload: (item: UnifiedMedia) => Promise<void>;
}

function formatResumeTime(seconds?: number): string {
  if (!seconds || seconds < 10) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MediaDetailView({
  media,
  seriesDetail,
  loading,
  playlist,
  uiLanguage,
  theaterOpen,
  activeMedia,
  onBack,
  onPlayInline,
  onStopPlayback,
  onOpenExternal,
  onPlayTheater,
  onToggleFavorite,
  onDownload,
}: MediaDetailViewProps) {
  // La lecture intégrée utilise le lecteur unique de l'application : passer en plein écran
  // puis revenir ne recharge pas le flux.
  const [inlineActive, setInlineActive] = useState(false);
  const inlineMedia = inlineActive ? activeMedia : null;

  useEffect(() => {
    setInlineActive(false);
  }, [media.id]);

  // Lecture arrêtée (croix du lecteur) : la fiche réaffiche son en-tête.
  useEffect(() => {
    if (!activeMedia) setInlineActive(false);
  }, [activeMedia]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !theaterOpen && !document.fullscreenElement) {
        if (inlineMedia) {
          setInlineActive(false);
          onStopPlayback();
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inlineMedia, theaterOpen, onBack, onStopPlayback]);

  const startInlinePlayback = (target: UnifiedMedia) => {
    setInlineActive(true);
    onPlayInline(target);
  };

  const resolvePlayTarget = (): UnifiedMedia | null => {
    if (media.kind !== 'series') return media;
    if (!seriesDetail || seriesDetail.seasons.length === 0) return null;
    return listEpisodeMedia(seriesDetail)[0] ?? null;
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          {t(uiLanguage, 'backToCatalog')}
        </Button>
        {loading ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader variant="dots" size={18} /> Synchronisation des métadonnées...
          </span>
        ) : null}
      </div>

      {/* Scène Hero ou Lecteur intégré TVNest Cinema */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-xl">
        {inlineMedia ? (
          <div className="aspect-video max-h-[68vh] w-full bg-black">
            <PlayerSlot compact={false} />
          </div>
        ) : (
          <div className="relative min-h-[380px] p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-0">
              <MediaArtwork
                src={media.backdropUrl || media.posterUrl}
                title={media.title}
                kind={media.kind}
                className="h-full w-full opacity-35 dark:opacity-30"
                imgClassName="blur-[2px] scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/55" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            </div>

            <div className="relative z-10 flex flex-col gap-7 md:flex-row md:items-end">
              <div className="aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-[22px] border border-border shadow-2xl sm:w-52">
                <MediaArtwork
                  src={media.posterUrl}
                  title={media.title}
                  kind={media.kind}
                  monogramSize="lg"
                  className="h-full w-full"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="rounded-full bg-primary/15 px-3 py-1 uppercase tracking-wider text-primary">
                    {media.kind === 'series' ? 'Série' : 'Film VOD'}
                  </span>
                  <span className="rounded-full border border-border bg-elevated px-3 py-1 text-muted-foreground">
                    {media.category}
                  </span>
                  {media.containerExtension ? (
                    <span className="rounded-full border border-border bg-elevated px-2.5 py-1 font-mono uppercase text-foreground">
                      {media.containerExtension}
                    </span>
                  ) : null}
                  {media.rating && Number(media.rating) > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2.5 py-1 text-foreground dark:text-foreground">
                      <Star className="size-3 fill-current" /> {Number(media.rating).toFixed(1)}
                    </span>
                  ) : null}
                  {media.year ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Calendar className="size-3.5" /> {media.year}
                    </span>
                  ) : null}
                  {media.duration ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3.5" /> {media.duration}
                    </span>
                  ) : null}
                </div>

                <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  {media.title}
                </h1>

                {media.genre ? <p className="text-xs font-medium text-primary">{media.genre}</p> : null}

                <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {media.plot ||
                    'Flux direct prêt à la lecture universelle via TVNest Cinema (libmpv / HLS / MPEG-TS).'}
                </p>

                {media.cast || media.director ? (
                  <div className="grid max-w-3xl grid-cols-1 gap-2 rounded-2xl border border-border bg-elevated p-3.5 text-xs sm:grid-cols-2">
                    {media.cast ? (
                      <p className="line-clamp-2 text-muted-foreground">
                        <Users className="mr-1.5 inline size-3.5 text-primary" />
                        <span className="font-semibold text-foreground">Distribution : </span>
                        {media.cast}
                      </p>
                    ) : null}
                    {media.director ? (
                      <p className="truncate text-muted-foreground">
                        <span className="font-semibold text-foreground">Réalisation : </span>
                        {media.director}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <MediaDetailActions
                  media={media}
                  playlist={playlist}
                  uiLanguage={uiLanguage}
                  resumeLabel={formatResumeTime(media.progressSeconds)}
                  onPlayInline={() => {
                    const target = resolvePlayTarget();
                    if (target) startInlinePlayback(target);
                  }}
                  onPlayTheater={() => {
                    const target = resolvePlayTarget();
                    if (target) onPlayTheater(target);
                  }}
                  onToggleFavorite={() => onToggleFavorite(media)}
                  onDownload={() => onDownload(media)}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {media.kind === 'series' && seriesDetail ? (
        <SeriesEpisodesPanel
          detail={seriesDetail}
          playlist={playlist}
          onPlayEpisode={(ep, theater) => (theater ? onPlayTheater(ep) : startInlinePlayback(ep))}
          onDownloadEpisode={onDownload}
          onOpenExternal={onOpenExternal}
        />
      ) : null}
    </div>
  );
}
