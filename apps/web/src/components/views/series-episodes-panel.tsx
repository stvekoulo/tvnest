// Panneau des saisons et épisodes réels d'une série sur la page dédiée TVNest.
import { Download, Play, Tv } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { Button } from '@/components/motion/button/base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/motion/tabs';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import { buildEpisodeMedia } from '@/lib/series-episodes';
import type {
  SeriesDetail,
  SeriesEpisode,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

interface SeriesEpisodesPanelProps {
  detail: SeriesDetail;
  playlist?: UnifiedPlaylist | null;
  onPlayEpisode: (epMedia: UnifiedMedia, expandTheater?: boolean) => void;
  onDownloadEpisode: (epMedia: UnifiedMedia) => void;
  onOpenExternal: (player: 'mpv' | 'vlc', epMedia: UnifiedMedia) => void;
}

export function SeriesEpisodesPanel({
  detail,
  playlist,
  onPlayEpisode,
  onDownloadEpisode,
  onOpenExternal,
}: SeriesEpisodesPanelProps) {
  const [season, setSeason] = useState<string>(String(detail.seasons[0] ?? 1));

  useEffect(() => {
    if (detail.seasons.length > 0) {
      setSeason(String(detail.seasons[0]));
    }
  }, [detail.series.id, detail.seasons]);

  if (detail.seasons.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        Aucun épisode retourné par le serveur pour cette série.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Tabs value={season} onValueChange={setSeason}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-bold text-foreground">
            Saisons & Épisodes ({detail.seasons.length})
          </h3>
          <TabsList className="max-w-full overflow-x-auto">
            {detail.seasons.map((s) => (
              <TabsTrigger key={s} value={String(s)}>
                Saison {s} ({detail.episodesBySeason[s]?.length || 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {detail.seasons.map((s) => {
          const episodes = detail.episodesBySeason[s] || [];
          return (
            <TabsContent key={s} value={String(s)} className="mt-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {episodes.map((ep) => {
                  const epMedia = buildEpisodeMedia(detail.series, ep);
                  const pct =
                    ep.progressSeconds && ep.durationSeconds && ep.durationSeconds > 0
                      ? Math.min(100, Math.round((ep.progressSeconds / ep.durationSeconds) * 100))
                      : 0;

                  return (
                    <div
                      key={ep.id}
                      className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
                    >
                      <div
                        onClick={() => onPlayEpisode(epMedia, false)}
                        className="relative aspect-video w-36 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border"
                      >
                        <MediaArtwork
                          src={ep.posterUrl || detail.series.posterUrl}
                          title={ep.title}
                          kind="episode"
                          monogramSize="sm"
                          className="h-full w-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Play className="ml-0.5 size-3.5 fill-white" />
                          </span>
                        </div>
                        {pct > 0 ? (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                            E{String(ep.episodeNum).padStart(2, '0')}
                          </span>
                          <p className="truncate text-xs font-semibold text-foreground">
                            {ep.title}
                          </p>
                        </div>
                        {ep.plot ? (
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {ep.plot}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] text-muted-foreground">
                          <span className="uppercase">{ep.containerExtension}</span>
                          {ep.duration ? <span>· {ep.duration}</span> : null}
                          {ep.progressSeconds ? (
                            <span className="text-primary">
                              · Reprise {Math.floor(ep.progressSeconds / 60)}m
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => onPlayEpisode(epMedia, false)}
                        >
                          <Play className="size-3.5 fill-current" />
                          Lire
                        </Button>
                        {isElectronRuntime() ? (
                          <>
                            <Button
                              size="icon-sm"
                              variant="secondary"
                              title="Ouvrir dans MPV"
                              onClick={() => onOpenExternal('mpv', epMedia)}
                            >
                              <Tv className="size-3.5" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="secondary"
                              title="Télécharger l'épisode"
                              onClick={() => onDownloadEpisode(epMedia)}
                            >
                              <Download className="size-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
