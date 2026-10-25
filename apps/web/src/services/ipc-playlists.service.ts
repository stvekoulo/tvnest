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
  if (p.macAddress) return 'stalker';
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

  return {
    id: p._id,
    title: p.title || p.filename || 'Playlist sans nom',
    kind: inferPortalKind(p),
    url: p.url,
    filePath: p.filePath,
    serverUrl: p.serverUrl,
    username: p.username,
    password: p.password,
    macAddress: p.macAddress,
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

// Charge les playlists avec leurs vrais compteurs SQLite (Live + Films + Séries).
export async function fetchSavedPlaylists(): Promise<UnifiedPlaylist[]> {
  if (isElectronRuntime()) {
    const [metas, countsByPlaylist] = await Promise.all([
      window.electron.dbGetAppPlaylists(),
      window.electron.dbGetPlaylistStreamCounts
        ? window.electron.dbGetPlaylistStreamCounts().catch(() => ({}))
        : Promise.resolve({}),
    ]);
    return (metas || []).map((meta) =>
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
