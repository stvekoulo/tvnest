// Service des fiches détaillées Films & Séries Xtream et favoris SQLite.
import { buildXtreamStreamUrl } from '@/services/ipc-catalog.service';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type {
  SeriesDetail,
  SeriesEpisode,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

const vodDetailCache = new Map<string, UnifiedMedia>();

// Réponse get_series_info gardée pour la session : rouvrir une série est instantané.
// ponytail: cache en mémoire ; à persister en SQLite si les réouvertures après
// redémarrage restent lentes sur certains serveurs.
const seriesInfoCache = new Map<string, SeriesInfoPayload>();
const SERIES_INFO_TIMEOUT_MS = 25_000;
// Les positions viennent de la base : si elle est occupée (import d'une source), la fiche
// s'affiche sans reprise plutôt que d'attendre.
const POSITIONS_TIMEOUT_MS = 3_000;

type SeriesInfoPayload = {
  info?: Record<string, unknown>;
  episodes?: Record<string, Array<Record<string, unknown>>>;
} | null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// Enrichit la fiche complète d'un film Xtream (get_vod_info + position de reprise).
export async function fetchXtreamMovieDetail(
  playlist: UnifiedPlaylist,
  movie: UnifiedMedia
): Promise<UnifiedMedia> {
  if (!isElectronRuntime() || !movie.xtreamId || !playlist.serverUrl) {
    return movie;
  }

  const cacheKey = `${playlist.id}:${movie.xtreamId}`;
  const [res, pos] = await Promise.all([
    vodDetailCache.has(cacheKey)
      ? Promise.resolve(null)
      : withTimeout(
          window.electron.xtreamRequest({
            url: playlist.serverUrl,
            params: {
              username: playlist.username || '',
              password: playlist.password || '',
              action: 'get_vod_info',
              vod_id: String(movie.xtreamId),
            },
          }),
          SERIES_INFO_TIMEOUT_MS,
          'timeout'
        ).catch(() => null),
    withTimeout(
      window.electron.dbGetPlaybackPosition(playlist.id, movie.xtreamId, 'vod'),
      POSITIONS_TIMEOUT_MS,
      'timeout'
    ).catch(() => null),
  ]);

  const cached = vodDetailCache.get(cacheKey);
  if (cached && !res) {
    return {
      ...cached,
      isFavorite: movie.isFavorite,
      progressSeconds: pos?.positionSeconds ?? cached.progressSeconds,
      durationSeconds: pos?.durationSeconds ?? cached.durationSeconds,
    };
  }

  const payload =
    res && 'payload' in res
      ? (res.payload as {
          info?: Record<string, unknown>;
          movie_data?: Record<string, unknown>;
        } | null)
      : null;

  const info = payload?.info || {};
  const movieData = payload?.movie_data || {};
  const ext = String(
    movieData.container_extension || movie.containerExtension || 'mp4'
  );
  const directSource =
    typeof movieData.direct_source === 'string' &&
    movieData.direct_source.startsWith('http')
      ? movieData.direct_source
      : null;
  const backdropCandidate = Array.isArray(info.backdrop_path)
    ? info.backdrop_path[0]
    : info.backdrop_path || info.cover_big || info.movie_image;

  const enriched: UnifiedMedia = {
    ...movie,
    containerExtension: ext,
    streamUrl:
      directSource ||
      buildXtreamStreamUrl(playlist, movie.xtreamId, 'movie', ext),
    posterUrl:
      (info.movie_image ? String(info.movie_image) : undefined) ||
      (info.cover_big ? String(info.cover_big) : undefined) ||
      movie.posterUrl,
    backdropUrl: backdropCandidate
      ? String(backdropCandidate)
      : movie.backdropUrl || movie.posterUrl,
    plot:
      (info.plot ? String(info.plot) : undefined) ||
      (info.description ? String(info.description) : undefined) ||
      movie.plot,
    cast:
      (info.cast ? String(info.cast) : undefined) ||
      (info.actors ? String(info.actors) : undefined) ||
      movie.cast,
    director: info.director ? String(info.director) : movie.director,
    genre: info.genre ? String(info.genre) : movie.genre,
    duration: info.duration ? String(info.duration) : movie.duration,
    rating: info.rating ? String(info.rating) : movie.rating,
    year:
      (info.releasedate ? String(info.releasedate).slice(0, 4) : undefined) ||
      (info.releaseDate ? String(info.releaseDate).slice(0, 4) : undefined) ||
      movie.year,
    youtubeTrailer: info.youtube_trailer
      ? String(info.youtube_trailer)
      : undefined,
    progressSeconds: pos?.positionSeconds ?? movie.progressSeconds,
    durationSeconds: pos?.durationSeconds ?? movie.durationSeconds,
  };

  vodDetailCache.set(cacheKey, enriched);
  return enriched;
}

// Charge les saisons et épisodes réels d'une série Xtream Codes.
export async function fetchXtreamSeriesDetail(
  playlist: UnifiedPlaylist,
  series: UnifiedMedia
): Promise<SeriesDetail> {
  if (!isElectronRuntime() || !series.xtreamId || !playlist.serverUrl) {
    return { series, seasons: [], episodesBySeason: {} };
  }

  const cacheKey = `${playlist.id}:${series.xtreamId}`;
  const serverUrl = playlist.serverUrl;
  const loadInfo = async (): Promise<SeriesInfoPayload> => {
    const cached = seriesInfoCache.get(cacheKey);
    if (cached) return cached;
    const res = await withTimeout(
      window.electron.xtreamRequest({
        url: serverUrl,
        params: {
          username: playlist.username || '',
          password: playlist.password || '',
          action: 'get_series_info',
          series_id: String(series.xtreamId),
        },
      }),
      SERIES_INFO_TIMEOUT_MS,
      'Le serveur IPTV met trop de temps à répondre.'
    );
    if (!('payload' in res)) {
      const message = (res as { message?: string }).message;
      throw new Error(message || 'Le serveur IPTV a refusé la demande.');
    }
    const payload = res.payload as SeriesInfoPayload;
    seriesInfoCache.set(cacheKey, payload);
    return payload;
  };

  const [payload, positions] = await Promise.all([
    loadInfo(),
    withTimeout(
      window.electron.dbGetSeriesPlaybackPositions(playlist.id, series.xtreamId),
      POSITIONS_TIMEOUT_MS,
      'positions'
    ).catch(() => []),
  ]);

  const posMap = new Map(
    (positions || []).map((p) => [p.contentXtreamId, p])
  );

  const episodesObj = payload?.episodes || {};
  const seasons: number[] = [];
  const episodesBySeason: Record<number, SeriesEpisode[]> = {};

  for (const [seasonKey, epList] of Object.entries(episodesObj)) {
    const sNum = Number(seasonKey);
    if (!Number.isFinite(sNum) || !Array.isArray(epList)) continue;
    seasons.push(sNum);
    episodesBySeason[sNum] = epList.map((ep, idx) => {
      const epId = Number(ep.id || idx + 1);
      const ext = String(ep.container_extension || 'mp4');
      const info = (ep.info || {}) as Record<string, unknown>;
      const pos = posMap.get(epId);
      return {
        id: String(epId),
        episodeNum: Number(ep.episode_num || idx + 1),
        seasonNum: sNum,
        title: String(ep.title || `Épisode ${idx + 1}`),
        containerExtension: ext,
        streamUrl: buildXtreamStreamUrl(playlist, epId, 'series', ext),
        duration: info.duration ? String(info.duration) : undefined,
        plot: info.plot ? String(info.plot) : undefined,
        posterUrl: info.movie_image
          ? String(info.movie_image)
          : series.posterUrl,
        rating: info.rating ? String(info.rating) : undefined,
        progressSeconds: pos?.positionSeconds,
        durationSeconds: pos?.durationSeconds,
      };
    });
  }

  seasons.sort((a, b) => a - b);
  const info = payload?.info || {};
  const enrichedSeries: UnifiedMedia = {
    ...series,
    plot: info.plot ? String(info.plot) : series.plot,
    cast: info.cast ? String(info.cast) : series.cast,
    director: info.director ? String(info.director) : series.director,
    genre: info.genre ? String(info.genre) : series.genre,
    year: info.releaseDate ? String(info.releaseDate).slice(0, 4) : series.year,
    rating: info.rating ? String(info.rating) : series.rating,
    backdropUrl:
      Array.isArray(info.backdrop_path) && info.backdrop_path[0]
        ? String(info.backdrop_path[0])
        : series.backdropUrl || series.posterUrl,
  };

  return { series: enrichedSeries, seasons, episodesBySeason };
}

// Bascule réellement un favori dans SQLite (Xtream ou M3U).
export async function toggleMediaFavoriteInDb(
  item: UnifiedMedia
): Promise<boolean> {
  const nextState = !item.isFavorite;
  if (!isElectronRuntime()) return nextState;

  if (item.portalKind === 'xtream' && item.dbContentId) {
    if (nextState) {
      await window.electron.dbAddFavorite(
        item.dbContentId,
        item.playlistId,
        item.backdropUrl
      );
    } else {
      await window.electron.dbRemoveFavorite(item.dbContentId, item.playlistId);
    }
    return nextState;
  }

  if (item.streamUrl) {
    const full = await window.electron.dbGetAppPlaylist(item.playlistId);
    if (full) {
      const current = new Set<string>(
        Array.isArray(full.favorites) ? (full.favorites as string[]) : []
      );
      if (nextState) current.add(item.streamUrl);
      else current.delete(item.streamUrl);
      await window.electron.dbUpdatePlaylist(item.playlistId, {
        favorites: Array.from(current),
      });
    }
  }
  return nextState;
}
