// Service dédié aux portails Xtream Codes et Stalker (MAC) via IPC Electron et SQLite.
import { normalizeXtreamServerUrl, type Playlist } from '@iptvnator/shared/interfaces';
import {
  isElectronRuntime,
  mapPlaylistToUnified,
} from '@/services/ipc-playlists.service';
import { checkXtreamAccount, requestXtream } from '@/services/xtream-request.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

export { addStalkerPortal, refreshStalkerPortal } from './ipc-stalker.service';

export async function addXtreamPortal(params: {
  title: string;
  serverUrl: string;
  username: string;
  password: string;
}): Promise<UnifiedPlaylist> {
  if (!isElectronRuntime()) {
    throw new Error('La connexion Xtream Codes requiert le moteur Electron');
  }

  const id = crypto.randomUUID();
  let cleanServer: string;
  try {
    cleanServer = normalizeXtreamServerUrl(params.serverUrl);
  } catch {
    throw new Error('Adresse du serveur invalide : saisissez-la sous la forme http://serveur:port.');
  }
  const creds = {
    username: params.username.trim(),
    password: params.password.trim(),
  };

  await checkXtreamAccount(cleanServer, creds);

  await window.electron.dbCreatePlaylist({
    id,
    name: params.title.trim() || cleanServer,
    serverUrl: cleanServer,
    username: creds.username,
    password: creds.password,
    type: 'xtream',
  });

  const now = new Date().toISOString();
  const appMeta: Playlist = {
    _id: id,
    title: params.title.trim() || cleanServer,
    serverUrl: cleanServer,
    username: creds.username,
    password: creds.password,
    importDate: now,
    lastUsage: now,
    count: 0,
    autoRefresh: false,
  };

  const totalCount = await syncXtreamPortalToDb(id, cleanServer, creds);
  appMeta.count = totalCount;
  await window.electron.dbUpsertAppPlaylist(appMeta);
  return mapPlaylistToUnified(appMeta);
}

const XTREAM_SECTIONS = [
  {
    catAction: 'get_live_categories',
    streamAction: 'get_live_streams',
    dbCatType: 'live',
    dbStreamType: 'live',
  },
  {
    catAction: 'get_vod_categories',
    streamAction: 'get_vod_streams',
    dbCatType: 'movies',
    dbStreamType: 'movie',
  },
  {
    catAction: 'get_series_categories',
    streamAction: 'get_series',
    dbCatType: 'series',
    dbStreamType: 'series',
  },
] as const;

export async function syncXtreamPortalToDb(
  playlistId: string,
  serverUrl: string,
  creds: { username: string; password: string }
): Promise<number> {
  let total = 0;
  for (const sec of XTREAM_SECTIONS) {
    const [catRes, streamRes] = await Promise.all([
      window.electron.xtreamRequest({
        url: serverUrl,
        params: { ...creds, action: sec.catAction },
      }),
      window.electron.xtreamRequest({
        url: serverUrl,
        params: { ...creds, action: sec.streamAction },
      }),
    ]);

    if ('payload' in catRes && Array.isArray(catRes.payload)) {
      await window.electron.dbSaveCategories(
        playlistId,
        catRes.payload,
        sec.dbCatType
      );
    }
    if ('payload' in streamRes && Array.isArray(streamRes.payload)) {
      const saved = await window.electron.dbSaveContent(
        playlistId,
        streamRes.payload,
        sec.dbStreamType
      );
      total += saved.count || streamRes.payload.length;
      await window.electron.dbSetAppState?.(
        `xtream-import-status:${playlistId}:${sec.dbStreamType}`,
        'completed'
      );
    }
  }
  return total;
}

export async function refreshXtreamPortal(playlist: UnifiedPlaylist): Promise<number> {
  if (!isElectronRuntime() || !playlist.serverUrl) return 0;
  const creds = { username: playlist.username || '', password: playlist.password || '' };
  const request = (action: string) => requestXtream(playlist.serverUrl as string, { ...creds, action });

  const fetched = await Promise.all(
    XTREAM_SECTIONS.map(async (sec) => {
      const [categories, streams, existingCats] = await Promise.all([
        request(sec.catAction),
        request(sec.streamAction),
        window.electron.dbGetAllCategories
          ? window.electron.dbGetAllCategories(playlist.id, sec.dbCatType).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (!Array.isArray(categories) || !Array.isArray(streams)) {
        throw new Error(`Réponse incomplète du serveur IPTV (${sec.dbStreamType}).`);
      }
      const locked = existingCats
        .filter((c) => Boolean(c.locked))
        .map((c) => c.xtream_id);
      return { sec, categories, streams, locked };
    })
  );

  const backup = await window.electron.dbDeleteXtreamContent(playlist.id);
  if (!backup.success) throw new Error('Impossible de remplacer le catalogue Xtream');
  let total = 0;
  for (const { sec, categories, streams, locked } of fetched) {
    const hidden = backup.hiddenCategories
      .filter((h) => h.categoryType === sec.dbCatType)
      .map((h) => h.xtreamId);
    await window.electron.dbSaveCategories(playlist.id, categories, sec.dbCatType, hidden, locked);
    const saved = await window.electron.dbSaveContent(playlist.id, streams, sec.dbStreamType);
    total += saved.count || streams.length;
    await window.electron.dbSetAppState?.(
      `xtream-import-status:${playlist.id}:${sec.dbStreamType}`,
      'completed'
    );
  }
  await window.electron.dbRestoreXtreamUserData(playlist.id, backup.favorites, backup.recentlyViewed);
  await window.electron.dbUpdatePlaylist?.(playlist.id, {
    count: total,
    updateDate: Date.now(),
  });
  return total;
}
