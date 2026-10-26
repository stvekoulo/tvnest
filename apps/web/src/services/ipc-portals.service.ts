// Service dédié aux portails Xtream Codes et Stalker (MAC) via IPC Electron et SQLite.
import type { Playlist } from '@iptvnator/shared/interfaces';
import {
  isElectronRuntime,
  mapPlaylistToUnified,
} from '@/services/ipc-playlists.service';
import { checkXtreamAccount, requestXtream } from '@/services/xtream-request.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

// Connecte un portail Xtream Codes et synchronise ses catégories et flux dans SQLite.
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
  const cleanServer = params.serverUrl.trim().replace(/\/$/, '');
  const creds = {
    username: params.username.trim(),
    password: params.password.trim(),
  };

  // Vérification réelle du compte (identifiants, abonnement) avant de créer la source.
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

// Synchronise Live, Films VOD et Séries d'un portail Xtream dans SQLite.
export async function syncXtreamPortalToDb(
  playlistId: string,
  serverUrl: string,
  creds: { username: string; password: string }
): Promise<number> {
  const sections = XTREAM_SECTIONS;

  let total = 0;
  for (const sec of sections) {
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
    }
  }
  return total;
}

// Réimporte le catalogue d'un portail Xtream existant en conservant favoris, historique et
// groupes masqués. `saveContent` ignore une source déjà remplie : il faut vider puis réimporter.
export async function refreshXtreamPortal(playlist: UnifiedPlaylist): Promise<number> {
  if (!isElectronRuntime() || !playlist.serverUrl) return 0;
  const creds = { username: playlist.username || '', password: playlist.password || '' };
  const request = (action: string) => requestXtream(playlist.serverUrl as string, { ...creds, action });

  // 1. Tout télécharger d'abord : en cas d'échec réseau, le catalogue actuel reste intact.
  const fetched = await Promise.all(
    XTREAM_SECTIONS.map(async (sec) => {
      const [categories, streams] = await Promise.all([request(sec.catAction), request(sec.streamAction)]);
      if (!Array.isArray(categories) || !Array.isArray(streams)) {
        throw new Error(`Réponse incomplète du serveur IPTV (${sec.dbStreamType}).`);
      }
      return { sec, categories, streams };
    })
  );

  // 2. Vider l'ancien contenu en récupérant les données de l'utilisateur, puis réimporter.
  const backup = await window.electron.dbDeleteXtreamContent(playlist.id);
  if (!backup.success) throw new Error('Impossible de remplacer le catalogue Xtream');
  let total = 0;
  for (const { sec, categories, streams } of fetched) {
    const hidden = backup.hiddenCategories
      .filter((h) => h.categoryType === sec.dbCatType)
      .map((h) => h.xtreamId);
    await window.electron.dbSaveCategories(playlist.id, categories, sec.dbCatType, hidden);
    const saved = await window.electron.dbSaveContent(playlist.id, streams, sec.dbStreamType);
    total += saved.count || streams.length;
  }
  // 3. Rattacher favoris et historique au nouveau contenu.
  await window.electron.dbRestoreXtreamUserData(playlist.id, backup.favorites, backup.recentlyViewed);
  return total;
}

// Connecte un portail Stalker (MAC Address) via IPC Electron.
export async function addStalkerPortal(params: {
  title: string;
  portalUrl: string;
  macAddress: string;
}): Promise<UnifiedPlaylist> {
  if (!isElectronRuntime()) {
    throw new Error('La connexion Stalker Portal requiert le moteur Electron');
  }
  const id = crypto.randomUUID();
  const cleanUrl = params.portalUrl.trim();
  const mac = params.macAddress.trim().toUpperCase();

  const hs = await window.electron.stalkerRequest({
    url: cleanUrl,
    macAddress: mac,
    params: { type: 'stb', action: 'handshake' },
  });
  const token = (hs as { js?: { token?: string } })?.js?.token;

  const chRes = await window.electron.stalkerRequest({
    url: cleanUrl,
    macAddress: mac,
    token,
    params: { type: 'itv', action: 'get_all_channels' },
  });
  const rawList =
    (chRes as { js?: { data?: Array<Record<string, unknown>> } })?.js?.data ||
    [];

  const now = new Date().toISOString();
  const playlistObj: Playlist = {
    _id: id,
    title: params.title.trim() || cleanUrl,
    portalUrl: cleanUrl,
    macAddress: mac,
    count: rawList.length,
    importDate: now,
    lastUsage: now,
    autoRefresh: false,
    playlist: {
      header: { attrs: {}, raw: '#EXTM3U' },
      items: rawList.map((ch, idx) => ({
        name: String(ch.name || `Channel ${idx + 1}`),
        url: String(ch.cmd || '').replace(/^ffmpeg\s+/i, ''),
        tvg: {
          id: String(ch.xmltv_id || ''),
          name: String(ch.name || ''),
          logo: String(ch.logo || ''),
          url: '',
          rec: '',
        },
        group: { title: 'Stalker TV' },
        http: { referrer: '', 'user-agent': '' },
        line: idx + 1,
        raw: '',
        timeshift: '',
        catchup: { type: '', days: '', source: '' },
      })),
    },
  };

  await window.electron.dbUpsertAppPlaylist(playlistObj);
  return mapPlaylistToUnified(playlistObj);
}
