// Épisodes d'une série sous forme de médias lisibles, dans l'ordre de visionnage.
import { formatClock, RESUME_MIN_SECONDS, shouldOfferResume } from '@/lib/resume-point';
import type { SeriesDetail, SeriesEpisode, UnifiedMedia } from '@/types/iptv.types';

export function buildEpisodeMedia(series: UnifiedMedia, ep: SeriesEpisode): UnifiedMedia {
  return {
    id: `${series.id}-ep-${ep.id}`,
    xtreamId: Number(ep.id) || series.xtreamId,
    seriesXtreamId: series.xtreamId,
    seriesContentId: series.dbContentId,
    seasonNumber: ep.seasonNum,
    episodeNumber: ep.episodeNum,
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

function sortedEpisodes(detail: SeriesDetail): SeriesEpisode[] {
  return [...detail.seasons]
    .sort((a, b) => a - b)
    .flatMap((season) => [...(detail.episodesBySeason[season] ?? [])].sort((a, b) => a.episodeNum - b.episodeNum));
}

/** Tous les épisodes, saison par saison puis par numéro d'épisode. */
export function listEpisodeMedia(detail: SeriesDetail): UnifiedMedia[] {
  return sortedEpisodes(detail).map((ep) => buildEpisodeMedia(detail.series, ep));
}

export interface ResumePoint {
  item: UnifiedMedia;
  positionSeconds: number;
  /** « S1E3 · 12:34 » */
  label: string;
}

/** Dernier épisode entamé dans l'ordre de visionnage (position de session prioritaire). */
export function findResumeEpisode(
  detail: SeriesDetail,
  sessionPosition: (id: string) => number | undefined
): ResumePoint | null {
  let found: ResumePoint | null = null;
  for (const ep of sortedEpisodes(detail)) {
    const item = buildEpisodeMedia(detail.series, ep);
    const position = sessionPosition(item.id) ?? ep.progressSeconds ?? 0;
    if (shouldOfferResume(position, ep.durationSeconds)) {
      found = { item, positionSeconds: position, label: `S${ep.seasonNum}E${ep.episodeNum} · ${formatClock(position)}` };
    }
  }
  return found;
}

/** « Lire » une série : l'épisode qui suit le dernier terminé, sinon le premier. */
export function nextUnwatchedEpisode(
  detail: SeriesDetail,
  sessionPosition: (id: string) => number | undefined
): UnifiedMedia | null {
  const episodes = sortedEpisodes(detail);
  let start = 0;
  episodes.forEach((ep, index) => {
    const position = sessionPosition(buildEpisodeMedia(detail.series, ep).id) ?? ep.progressSeconds ?? 0;
    const finished = position >= RESUME_MIN_SECONDS && Boolean(ep.durationSeconds) && !shouldOfferResume(position, ep.durationSeconds);
    if (finished) start = index + 1;
  });
  const ep = episodes[start] ?? episodes[0];
  return ep ? buildEpisodeMedia(detail.series, ep) : null;
}

/** Épisode qui suit `currentId` (saison suivante après le dernier), ou null. */
export function nextEpisodeIn(queue: UnifiedMedia[], currentId: string): UnifiedMedia | null {
  const index = queue.findIndex((ep) => ep.id === currentId);
  return index >= 0 && index + 1 < queue.length ? queue[index + 1] : null;
}
