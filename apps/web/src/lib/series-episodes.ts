// Épisodes d'une série sous forme de médias lisibles, dans l'ordre de visionnage.
import type { SeriesDetail, SeriesEpisode, UnifiedMedia } from '@/types/iptv.types';

export function buildEpisodeMedia(series: UnifiedMedia, ep: SeriesEpisode): UnifiedMedia {
  return {
    id: `${series.id}-ep-${ep.id}`,
    xtreamId: Number(ep.id) || series.xtreamId,
    playlistId: series.playlistId,
    playlistTitle: series.playlistTitle,
    portalKind: series.portalKind,
    kind: 'episode',
    title: `${series.title} · S${ep.seasonNum}E${ep.episodeNum} — ${ep.title}`,
    category: series.category,
    posterUrl: ep.posterUrl || series.posterUrl,
    backdropUrl: ep.posterUrl || series.backdropUrl,
    streamUrl: ep.streamUrl,
    containerExtension: ep.containerExtension,
    duration: ep.duration,
    plot: ep.plot,
    progressSeconds: ep.progressSeconds,
    durationSeconds: ep.durationSeconds,
  };
}

/** Tous les épisodes, saison par saison puis par numéro d'épisode. */
export function listEpisodeMedia(detail: SeriesDetail): UnifiedMedia[] {
  return [...detail.seasons]
    .sort((a, b) => a - b)
    .flatMap((season) =>
      [...(detail.episodesBySeason[season] ?? [])]
        .sort((a, b) => a.episodeNum - b.episodeNum)
        .map((ep) => buildEpisodeMedia(detail.series, ep))
    );
}

/** Épisode qui suit `currentId` (saison suivante après le dernier), ou null. */
export function nextEpisodeIn(queue: UnifiedMedia[], currentId: string): UnifiedMedia | null {
  const index = queue.findIndex((ep) => ep.id === currentId);
  return index >= 0 && index + 1 < queue.length ? queue[index + 1] : null;
}
