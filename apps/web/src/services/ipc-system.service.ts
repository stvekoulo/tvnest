// Service système Electron : préférences, lecteurs externes, téléchargements et fenêtre.
import { buildMpvLanguageArgs } from '@/lib/i18n';
import { resolveMediaPlayback } from '@/services/ipc-playback.service';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type {
  ElectronBridgeDownloadHeaders,
  ExternalPlayerSession,
} from '@iptvnator/shared/interfaces';
import type {
  AppPreferences,
  ElectronDownloadItem,
  ElectronRecordingItem,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

export {
  epgKeyOf,
  fetchChannelSchedule,
  fetchCurrentEpgForChannels,
  fetchEpgChannelIcons,
  fetchEpgCoverage,
  importLocalXmltvFile,
  searchEpgGuide,
  syncEpgUrls,
} from './ipc-epg.service';

export {
  clearSavedPlaybackPosition,
  fetchSavedPlaybackPosition,
  flushMediaWatchProgress,
  recordMediaWatchProgress,
  saveExternalPlaybackProgress,
  WATCH_PROGRESS_EVENT,
  type WatchProgressDetail,
} from './ipc-watch-progress.service';

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

  const mpvArgsRaw = buildMpvLanguageArgs(prefs.preferredContentLanguage);
  const mpvPlayerArguments = typeof mpvArgsRaw === 'string' ? mpvArgsRaw : '';
  const embeddedMpvExtraOptions = mpvPlayerArguments
    .split(/\s+/)
    .filter((part) => part.startsWith('--'))
    .map((part) => part.slice(2))
    .join('\n');

  await Promise.all([
    window.electron.setMpvPlayerPath(prefs.mpvPlayerPath || ''),
    window.electron.setVlcPlayerPath(prefs.vlcPlayerPath || ''),
    window.electron.setUserAgent(prefs.userAgent || null),
    window.electron.setParentalLockState(prefs.parentalLockEnabled),
    window.electron
      .updateSettings({
        mpvPlayerArguments,
        embeddedMpvExtraOptions,
        parentalLockEnabled: prefs.parentalLockEnabled,
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

  const contentId = item.dbContentId ?? item.seriesContentId;
  if (contentId) {
    window.electron
      .dbAddRecentItem(contentId, item.playlistId, item.backdropUrl)
      .catch(() => {});
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

export async function startVodDownload(
  item: UnifiedMedia,
  playlist?: UnifiedPlaylist | null
): Promise<void> {
  if (!isElectronRuntime()) {
    throw new Error('Téléchargement disponible uniquement sous TVNest Desktop');
  }
  const resolved = await resolveMediaPlayback(item, playlist);
  if (!resolved.streamUrl) {
    throw new Error('URL de téléchargement introuvable pour ce média');
  }
  const downloadFolder = await window.electron.downloadsGetDefaultFolder();
  const headers: ElectronBridgeDownloadHeaders = {};
  if (resolved.userAgent) headers.userAgent = resolved.userAgent;
  if (resolved.referer) headers.referer = resolved.referer;
  if (resolved.origin) headers.origin = resolved.origin;

  const res = await window.electron.downloadsStart({
    playlistId: item.playlistId,
    xtreamId: item.xtreamId || Date.now(),
    contentType: item.kind === 'episode' ? 'episode' : 'vod',
    title: item.title,
    url: resolved.streamUrl,
    posterUrl: item.posterUrl,
    downloadFolder,
    playlistName: item.playlistTitle,
    playlistType: item.portalKind,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  if (res && !res.success && res.error) {
    throw new Error(res.error);
  }
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
