// Service réel de gestion des playlists M3U/Xtream/Stalker et compteurs SQLite.
import { parse } from 'iptv-playlist-parser';
import type { Playlist } from '@iptvnator/shared/interfaces';
import type {
  PlaylistStreamCounts,
  PortalKind,
  UnifiedPlaylist,
} from '@/types/iptv.types';

const LOCAL_PLAYLISTS_KEY = 'iptvnator.local.playlists.v1';

export function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electron);
}

function inferPortalKind(p: Partial<Playlist>): PortalKind {
  if (p.serverUrl) return 'xtream';
  if (p.macAddress || p.portalUrl) return 'stalker';
  if (p.filePath) return 'm3u-file';
  if (p.url) return 'm3u-url';
  return 'm3u-text';
}

export function mapPlaylistToUnified(
  p: Playlist,
  sqlCounts?: PlaylistStreamCounts
): UnifiedPlaylist {
  const fallbackCount = p.count || p.playlist?.items?.length || 0;
  const totalCount =
    sqlCounts && sqlCounts.total > 0 ? sqlCounts.total : fallbackCount;
  const epgUrl =
    Array.isArray(p.epgUrls) && p.epgUrls.length > 0
      ? p.epgUrls[0]
      : Array.isArray(p.detectedEpgUrls) && p.detectedEpgUrls.length > 0
        ? p.detectedEpgUrls[0]
        : undefined;

  return {
    id: p._id,
    title: p.title || p.filename || 'Playlist sans nom',
    kind: inferPortalKind(p),
    url: p.url || p.portalUrl,
    portalUrl: p.portalUrl || (p.macAddress ? p.url : undefined),
    filePath: p.filePath,
    serverUrl: p.serverUrl,
    username: p.username,
    password: p.password,
    macAddress: p.macAddress,
    serialNumber: p.stalkerSerialNumber,
    token: p.stalkerToken,
    epgUrl,
    userAgent: p.userAgent,
    channelCount: totalCount,
    counts: sqlCounts,
    updatedAt: p.updateDate
      ? new Date(p.updateDate).toLocaleString()
      : p.importDate
        ? new Date(p.importDate).toLocaleDateString()
        : undefined,
    autoRefresh: Boolean(p.autoRefresh),
  };
}

async function readPlaylistMetas(): Promise<Playlist[]> {
  if (!isElectronRuntime()) return [];
  if (window.electron.dbGetAppPlaylistMetas) {
    return (await window.electron.dbGetAppPlaylistMetas()) || [];
  }
  return (await window.electron.dbGetAppPlaylists()) || [];
}

// Charge les playlists avec leurs vrais compteurs SQLite (Live + Films + Séries).
export async function fetchSavedPlaylists(): Promise<UnifiedPlaylist[]> {
  if (isElectronRuntime()) {
    const [metas, countsByPlaylist] = await Promise.all([
      readPlaylistMetas(),
      window.electron.dbGetPlaylistStreamCounts
        ? window.electron.dbGetPlaylistStreamCounts().catch(() => ({}))
        : Promise.resolve({}),
    ]);
    return metas.map((meta) =>
      mapPlaylistToUnified(meta, countsByPlaylist[meta._id])
    );
  }
  const raw = localStorage.getItem(LOCAL_PLAYLISTS_KEY);
  const parsed: Playlist[] = raw ? JSON.parse(raw) : [];
  return parsed.map((p) => mapPlaylistToUnified(p));
}

function saveFallbackPlaylist(playlist: Playlist): void {
  const raw = localStorage.getItem(LOCAL_PLAYLISTS_KEY);
  const list: Playlist[] = raw ? JSON.parse(raw) : [];
  const next = [playlist, ...list.filter((p) => p._id !== playlist._id)];
  localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(next));
}

export function getFallbackRawPlaylist(id: string): Playlist | null {
  const raw = localStorage.getItem(LOCAL_PLAYLISTS_KEY);
  const list: Playlist[] = raw ? JSON.parse(raw) : [];
  return list.find((p) => p._id === id) || null;
}

export async function addM3uPlaylistByUrl(
  url: string,
  title: string,
  userAgent?: string
): Promise<UnifiedPlaylist> {
  if (isElectronRuntime()) {
    const fetched = await window.electron.fetchPlaylistByUrl(
      url.trim(),
      title.trim() || undefined,
      userAgent ? { userAgent } : undefined
    );
    await window.electron.dbUpsertAppPlaylist(fetched);
    return mapPlaylistToUnified(fetched);
  }

  const res = await fetch(url.trim());
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} lors du téléchargement M3U`);
  }
  const content = await res.text();
  return addM3uPlaylistFromText(content, title || url, url);
}

export async function addM3uPlaylistFromFileDialog(): Promise<UnifiedPlaylist | null> {
  if (!isElectronRuntime()) {
    throw new Error('Ouvrez TVNest Desktop pour accéder aux fichiers locaux');
  }
  const opened = await window.electron.openPlaylistFromFile();
  if (!opened) return null;
  await window.electron.dbUpsertAppPlaylist(opened);
  return mapPlaylistToUnified(opened);
}

// Importe un fichier .m3u/.m3u8 transmis par l'OS (double-clic ou argument CLI).
export async function importM3uPlaylistFromFilePath(
  filePath: string,
  fileName?: string
): Promise<UnifiedPlaylist> {
  if (!isElectronRuntime()) {
    throw new Error('Ouvrez TVNest Desktop pour accéder aux fichiers locaux');
  }
  const cleanTitle = (fileName || filePath.split(/[\\/]/).pop() || 'Playlist M3U')
    .replace(/\.(m3u8?|pls)$/i, '')
    .trim();
  const loaded = await window.electron.updatePlaylistFromFilePath(
    filePath,
    cleanTitle || 'Playlist M3U'
  );
  await window.electron.dbUpsertAppPlaylist(loaded);
  return mapPlaylistToUnified(loaded);
}

export async function addM3uPlaylistFromText(
  rawText: string,
  title: string,
  sourceUrl?: string
): Promise<UnifiedPlaylist> {
  const parsed = parse(rawText);
  const now = new Date().toISOString();
  const playlistObj: Playlist = {
    _id: crypto.randomUUID(),
    title: title.trim() || 'Playlist M3U',
    count: parsed.items.length,
    importDate: now,
    lastUsage: now,
    autoRefresh: false,
    url: sourceUrl,
    playlist: parsed,
  };

  if (isElectronRuntime()) {
    await window.electron.dbUpsertAppPlaylist(playlistObj);
  } else {
    saveFallbackPlaylist(playlistObj);
  }
  return mapPlaylistToUnified(playlistObj);
}

export async function removeSavedPlaylist(playlistId: string): Promise<void> {
  if (isElectronRuntime()) {
    await window.electron.dbDeletePlaylist(playlistId);
    return;
  }
  const raw = localStorage.getItem(LOCAL_PLAYLISTS_KEY);
  const list: Playlist[] = raw ? JSON.parse(raw) : [];
  localStorage.setItem(
    LOCAL_PLAYLISTS_KEY,
    JSON.stringify(list.filter((p) => p._id !== playlistId))
  );
}

// Dernière actualisation automatique réussie de chaque source (horodatage ms, par id).
const SOURCE_REFRESH_LOG_KEY = 'tvnest.sources.lastRefresh.v1';

function readSourceRefreshLog(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SOURCE_REFRESH_LOG_KEY) || '{}');
  } catch {
    return {};
  }
}

export function markSourcesRefreshed(ids: string[], at = Date.now()): void {
  const log = readSourceRefreshLog();
  for (const id of ids) log[id] = at;
  localStorage.setItem(SOURCE_REFRESH_LOG_KEY, JSON.stringify(log));
}

// Date de dernière actualisation : journal local, sinon date de mise à jour ou d'import.
export async function fetchSourceRefreshTimes(): Promise<Record<string, number>> {
  if (!isElectronRuntime()) return {};
  const log = readSourceRefreshLog();
  const metas = await readPlaylistMetas();
  const out: Record<string, number> = {};
  for (const p of metas) {
    const rawDate = p.updateDate ?? p.importDate;
    const fromMeta =
      typeof rawDate === 'number' ? rawDate : Date.parse(String(rawDate ?? ''));
    out[p._id] = log[p._id] ?? (Number.isFinite(fromMeta) ? fromMeta : 0);
  }
  return out;
}

// Re-télécharge des playlists M3U (URL ou fichier) depuis leur source ; renvoie les ids réussis.
export async function refreshM3uPlaylists(ids: string[]): Promise<string[]> {
  if (!isElectronRuntime() || ids.length === 0) return [];
  const fullRows = window.electron.dbGetAppPlaylist
    ? await Promise.all(ids.map((id) => window.electron.dbGetAppPlaylist(id)))
    : ((await window.electron.dbGetAppPlaylists()) || []).filter((p) =>
        ids.includes(p._id)
      );
  const targets = fullRows.filter(
    (p): p is Playlist => Boolean(p && !p.macAddress && !p.portalUrl && (p.url || p.filePath))
  );
  if (targets.length === 0) return [];
  const res = await window.electron.autoUpdatePlaylists(targets);
  for (const p of res.playlists) await window.electron.dbUpsertAppPlaylist(p);
  return res.playlists.map((p) => p._id);
}
