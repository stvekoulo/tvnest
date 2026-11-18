// Sauvegarde et lecture de la progression de visionnage (lecteur intégré, MPV et VLC).
import type { PlaybackPositionData } from '@iptvnator/shared/interfaces';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { UnifiedMedia } from '@/types/iptv.types';

const SAVE_EVERY_SECONDS = 5;
export const WATCH_PROGRESS_EVENT = 'tvnest:watch-progress';

export interface WatchProgressDetail {
  item: UnifiedMedia;
  positionSeconds: number;
  durationSeconds: number;
}

interface WatchSession {
  savedAt: number;
  pending: WatchProgressDetail | null;
  last: number;
  confirmed: boolean;
}

const watchSessions = new Map<string, WatchSession>();

// Position enregistrée en base d'un film ou d'un épisode Xtream (null si inconnue).
export async function fetchSavedPlaybackPosition(
  item: UnifiedMedia
): Promise<{ positionSeconds: number; durationSeconds?: number } | null> {
  if (
    !isElectronRuntime() ||
    !item.xtreamId ||
    (item.kind !== 'movie' && item.kind !== 'episode')
  ) {
    return null;
  }
  const saved = await window.electron
    .dbGetPlaybackPosition(
      item.playlistId,
      item.xtreamId,
      item.kind === 'episode' ? 'episode' : 'vod'
    )
    .catch(() => null);
  return saved
    ? {
        positionSeconds: saved.positionSeconds,
        durationSeconds: saved.durationSeconds,
      }
    : null;
}

// Efface la position enregistrée d'un film ou épisode lorsque l'utilisateur choisit « Recommencer ».
export async function clearSavedPlaybackPosition(
  item: UnifiedMedia
): Promise<void> {
  watchSessions.delete(item.id);
  if (
    !isElectronRuntime() ||
    !item.xtreamId ||
    (item.kind !== 'movie' && item.kind !== 'episode')
  ) {
    return;
  }
  await window.electron
    .dbClearPlaybackPosition?.(
      item.playlistId,
      item.xtreamId,
      item.kind === 'episode' ? 'episode' : 'vod'
    )
    .catch(() => {});
}

function writeWatchProgress(detail: WatchProgressDetail): void {
  const { item, positionSeconds, durationSeconds } = detail;
  if (!item.xtreamId || item.kind === 'live' || !(durationSeconds > 0)) return;
  window.electron
    .dbSavePlaybackPosition(item.playlistId, {
      contentXtreamId: item.xtreamId,
      contentType: item.kind === 'episode' ? 'episode' : 'vod',
      seriesXtreamId: item.seriesXtreamId,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
      positionSeconds: Math.floor(positionSeconds),
      durationSeconds: Math.floor(durationSeconds),
    })
    .then(() =>
      window.dispatchEvent(new CustomEvent(WATCH_PROGRESS_EVENT, { detail }))
    )
    .catch(() => {});
}

/** Appelé à chaque nouvelle position du lecteur ; n'écrit en base que si nécessaire. */
export function recordMediaWatchProgress(
  item: UnifiedMedia,
  positionSeconds: number,
  durationSeconds: number
): void {
  if (!isElectronRuntime() || !(positionSeconds > 0)) return;
  const detail = { item, positionSeconds, durationSeconds };
  let session = watchSessions.get(item.id);
  if (!session) {
    const contentId = item.dbContentId ?? item.seriesContentId;
    if (contentId) {
      window.electron
        .dbAddRecentItem(contentId, item.playlistId, item.backdropUrl)
        .catch(() => {});
    }
    session = {
      savedAt: Number.NEGATIVE_INFINITY,
      pending: null,
      last: positionSeconds,
      confirmed: false,
    };
    watchSessions.set(item.id, session);
  }
  if (!session.confirmed) {
    const step = positionSeconds - session.last;
    session.last = positionSeconds;
    if (!(step > 0 && step <= 3)) return;
    session.confirmed = true;
  }
  if (Math.abs(positionSeconds - session.savedAt) < SAVE_EVERY_SECONDS) {
    session.pending = detail;
    return;
  }
  session.savedAt = positionSeconds;
  session.pending = null;
  writeWatchProgress(detail);
}

/** Position remontée par MPV / VLC (toutes les 5 s). */
export function saveExternalPlaybackProgress(update: PlaybackPositionData): void {
  const {
    playlistId,
    contentXtreamId,
    contentType,
    positionSeconds,
    durationSeconds,
  } = update;
  if (
    !playlistId ||
    !contentXtreamId ||
    !(positionSeconds >= 5) ||
    !durationSeconds
  ) {
    return;
  }
  const item: UnifiedMedia = {
    id: `${playlistId}-${contentType}-${contentXtreamId}`,
    playlistId,
    portalKind: 'xtream',
    kind: contentType === 'episode' ? 'episode' : 'movie',
    xtreamId: contentXtreamId,
    seriesXtreamId: update.seriesXtreamId,
    seasonNumber: update.seasonNumber,
    episodeNumber: update.episodeNumber,
    title: '',
    category: '',
  };
  writeWatchProgress({ item, positionSeconds, durationSeconds });
}

/** Écrit la dernière position non sauvegardée ; `end` clôt la séance (pause exclue). */
export function flushMediaWatchProgress(mediaId: string, end = false): void {
  const session = watchSessions.get(mediaId);
  if (!session) return;
  if (session.pending && session.confirmed) {
    session.savedAt = session.pending.positionSeconds;
    writeWatchProgress(session.pending);
    session.pending = null;
  }
  if (end) watchSessions.delete(mediaId);
}
