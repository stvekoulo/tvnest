// Service système Electron : préférences, langues MPV, EPG, téléchargements et fenêtre.
import { buildMpvLanguageArgs } from '@/lib/i18n';
import { resolveMediaPlayback } from '@/services/ipc-playback.service';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { ExternalPlayerSession } from '@iptvnator/shared/interfaces';
import type {
  AppPreferences,
  ElectronDownloadItem,
  ElectronRecordingItem,
  EpgProgram,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

const PREFS_KEY = 'tvnest.preferences.v1';
const LEGACY_PREFS_KEY = 'iptvnator.preferences.v1';

export function loadPreferences(): AppPreferences {
  const raw =
    localStorage.getItem(PREFS_KEY) ?? localStorage.getItem(LEGACY_PREFS_KEY);
  const defaults: AppPreferences = {
    uiLanguage: 'fr',
    preferredContentLanguage: 'ALL',
    autoFilterByLanguage: false,
    mpvPlayerPath: '',
    vlcPlayerPath: '',
    defaultPlayer: 'builtin',
    embeddedMpvEnabled: true,
    epgUrls: [],
    userAgent: '',
    autoplay: true,
    parentalLockEnabled: false,
    autoUpdate: true,
    sourceRefreshDays: 0,
    startupFullscreen: false,
  };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  if (!isElectronRuntime()) return;

  const mpvPlayerArguments = buildMpvLanguageArgs(
    prefs.preferredContentLanguage
  );

  await Promise.all([
    prefs.mpvPlayerPath
      ? window.electron.setMpvPlayerPath(prefs.mpvPlayerPath)
      : Promise.resolve(),
    prefs.vlcPlayerPath
      ? window.electron.setVlcPlayerPath(prefs.vlcPlayerPath)
      : Promise.resolve(),
    window.electron.setUserAgent(prefs.userAgent || null),
    window.electron.setParentalLockState(prefs.parentalLockEnabled),
    window.electron
      .updateSettings({
        mpvPlayerArguments,
        embeddedMpvFrameCopy: prefs.embeddedMpvEnabled,
        startupWindowMode: prefs.startupFullscreen ? 'fullscreen' : 'normal',
      })
      .catch(() => {}),
  ]);
}

export function controlNativeWindow(
  action: 'minimize' | 'maximize' | 'close'
): void {
  if (!isElectronRuntime()) return;
  if (action === 'minimize') window.electron.minimizeWindow();
  else if (action === 'maximize') window.electron.toggleMaximizeWindow();
  else window.electron.closeWindow();
}

// Ouvre un flux dans MPV ou VLC externe avec résolution complète TVNest.
export async function launchExternalPlayer(
  player: 'mpv' | 'vlc',
  item: UnifiedMedia,
  playlist?: UnifiedPlaylist | null
): Promise<ExternalPlayerSession> {
  if (!isElectronRuntime()) {
    throw new Error('Lecteur externe disponible uniquement sous TVNest Desktop');
  }
  const resolved = await resolveMediaPlayback(item, playlist);
  if (!resolved.streamUrl) {
    throw new Error('URL de flux introuvable pour ce média');
  }

  const fn =
    player === 'mpv' ? window.electron.openInMpv : window.electron.openInVlc;
  return fn(
    resolved.streamUrl,
    resolved.title,
    resolved.thumbnail || '',
    resolved.userAgent,
    resolved.referer,
    resolved.origin,
    resolved.contentInfo,
    resolved.startTime,
    resolved.headers
  );
}

// Position enregistrée en base d'un film ou d'un épisode Xtream (null si inconnue).
export async function fetchSavedPlaybackPosition(
  item: UnifiedMedia
): Promise<{ positionSeconds: number; durationSeconds?: number } | null> {
  if (!isElectronRuntime() || !item.xtreamId || (item.kind !== 'movie' && item.kind !== 'episode')) {
    return null;
  }
  const saved = await window.electron
    .dbGetPlaybackPosition(item.playlistId, item.xtreamId, item.kind === 'episode' ? 'episode' : 'vod')
    .catch(() => null);
  return saved ? { positionSeconds: saved.positionSeconds, durationSeconds: saved.durationSeconds } : null;
}

export async function syncEpgUrls(urls: string[]): Promise<void> {
  if (!isElectronRuntime() || urls.length === 0) return;
  const res = await window.electron.fetchEpg(urls);
  // Le backend signale un échec dans le résultat, sans rejeter la promesse.
  if (res && res.success === false) {
    throw new Error(res.message || 'Téléchargement XMLTV impossible');
  }
}

// Clé de recherche EPG d'une chaîne : tvg-id, sinon son nom (même règle que le backend).
export function epgKeyOf(item: { tvgId?: string; title: string }): string {
  return item.tvgId || item.title;
}

export async function fetchEpgChannelIcons(
  keys: string[]
): Promise<Record<string, string | null>> {
  if (!isElectronRuntime() || keys.length === 0 || !window.electron.getEpgChannelMetadata) {
    return {};
  }
  const meta = await window.electron.getEpgChannelMetadata(Array.from(new Set(keys)));
  const out: Record<string, string | null> = {};
  for (const [key, m] of Object.entries(meta || {})) out[key] = m?.iconUrl ?? null;
  return out;
}

export async function fetchEpgCoverage(
  keys: string[],
  fromMs: number,
  toMs: number
): Promise<Set<string>> {
  if (!isElectronRuntime() || keys.length === 0 || !window.electron.getEpgProgramCoverage) {
    return new Set();
  }
  const covered = await window.electron.getEpgProgramCoverage({
    channelIds: Array.from(new Set(keys)).slice(0, 2000),
    fromMs,
    toMs,
  });
  return new Set(covered || []);
}

export async function importLocalXmltvFile(): Promise<string | null> {
  if (!isElectronRuntime()) return null;
  const path = await window.electron.openEpgFileDialog();
  if (path) {
    await window.electron.fetchEpg([path]);
  }
  return path;
}

export async function fetchCurrentEpgForChannels(
  channelIds: string[]
): Promise<Record<string, EpgProgram | null>> {
  if (!isElectronRuntime() || channelIds.length === 0) return {};
  const unique = Array.from(new Set(channelIds.filter(Boolean))).slice(0, 200);
  if (unique.length === 0) return {};
  return window.electron.getCurrentProgramsBatch(unique);
}

export async function fetchChannelSchedule(
  channelId: string
): Promise<EpgProgram[]> {
  if (!isElectronRuntime() || !channelId) return [];
  return window.electron.getChannelPrograms(channelId);
}

export async function searchEpgGuide(query: string): Promise<EpgProgram[]> {
  if (!isElectronRuntime() || !query.trim()) return [];
  return window.electron.searchEpgPrograms(query.trim(), 60);
}

export async function recordMediaWatchProgress(
  item: UnifiedMedia,
  positionSeconds: number,
  durationSeconds: number
): Promise<void> {
  if (!isElectronRuntime()) return;
  if (item.dbContentId) {
    await window.electron.dbAddRecentItem(
      item.dbContentId,
      item.playlistId,
      item.backdropUrl
    );
  }
  if (item.xtreamId && durationSeconds > 0 && item.kind !== 'live') {
    await window.electron.dbSavePlaybackPosition(item.playlistId, {
      contentXtreamId: item.xtreamId,
      contentType: item.kind === 'episode' ? 'episode' : 'vod',
      positionSeconds: Math.floor(positionSeconds),
      durationSeconds: Math.floor(durationSeconds),
    });
  }
}

export async function startVodDownload(
  item: UnifiedMedia,
  playlist?: UnifiedPlaylist | null
): Promise<void> {
  if (!isElectronRuntime()) return;
  const resolved = await resolveMediaPlayback(item, playlist);
  if (!resolved.streamUrl) return;
  const downloadFolder = await window.electron.downloadsGetDefaultFolder();
  await window.electron.downloadsStart({
    playlistId: item.playlistId,
    xtreamId: item.xtreamId || Date.now(),
    contentType: item.kind === 'episode' ? 'episode' : 'vod',
    title: item.title,
    url: resolved.streamUrl,
    posterUrl: item.posterUrl,
    downloadFolder,
    playlistName: item.playlistTitle,
    playlistType: item.portalKind === 'stalker' ? 'stalker' : 'xtream',
    headers: {
      userAgent: resolved.userAgent,
      referer: resolved.referer,
    },
  });
}

export async function getDownloadsAndRecordings(): Promise<{
  downloads: ElectronDownloadItem[];
  recordings: ElectronRecordingItem[];
}> {
  if (!isElectronRuntime()) return { downloads: [], recordings: [] };
  const [downloads, recordings] = await Promise.all([
    window.electron.downloadsGetList(),
    window.electron.recordingsGetList
      ? window.electron.recordingsGetList()
      : Promise.resolve([]),
  ]);
  return { downloads: downloads || [], recordings: recordings || [] };
}
