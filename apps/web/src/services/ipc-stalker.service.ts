// Service dédié aux portails Stalker / Ministra (adresse MAC, genres et chaînes Live TV).
import type { Playlist } from '@iptvnator/shared/interfaces';
import {
  isElectronRuntime,
  mapPlaylistToUnified,
} from '@/services/ipc-playlists.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

async function fetchStalkerLiveCatalog(
  portalUrl: string,
  mac: string,
  serialNumber?: string
): Promise<{ token?: string; items: NonNullable<Playlist['playlist']>['items'] }> {
  const hs = await window.electron.stalkerRequest({
    url: portalUrl,
    macAddress: mac,
    serialNumber,
    params: { type: 'stb', action: 'handshake', JsHttpRequest: '1-xml' },
  });
  if ('portalRequestFailure' in hs || 'stalkerAuthFailure' in hs) {
    throw new Error('Connexion Stalker refusée : vérifiez l’adresse du portail et la MAC.');
  }
  const token = (hs as { js?: { token?: string } })?.js?.token;

  const [genresRes, chRes] = await Promise.all([
    window.electron
      .stalkerRequest({
        url: portalUrl,
        macAddress: mac,
        serialNumber,
        token,
        params: { type: 'itv', action: 'get_genres', JsHttpRequest: '1-xml' },
      })
      .catch(() => null),
    window.electron.stalkerRequest({
      url: portalUrl,
      macAddress: mac,
      serialNumber,
      token,
      params: { type: 'itv', action: 'get_all_channels', JsHttpRequest: '1-xml' },
    }),
  ]);

  const genreList =
    (genresRes as { js?: Array<Record<string, unknown>> | { data?: Array<Record<string, unknown>> } } | null)
      ?.js;
  const rawGenres = Array.isArray(genreList)
    ? genreList
    : Array.isArray(genreList?.data)
      ? genreList.data
      : [];
  const genreById = new Map<string, string>();
  for (const g of rawGenres) {
    const gid = String(g.id ?? '').trim();
    const gtitle = String(g.title ?? g.name ?? '').trim();
    if (gid && gtitle && gid !== '*') genreById.set(gid, gtitle);
  }

  const rawList =
    (chRes as { js?: { data?: Array<Record<string, unknown>> } })?.js?.data || [];

  const items = rawList.map((ch, idx) => {
    const rawCmd = String(ch.cmd || '').trim();
    const genreTitle =
      genreById.get(String(ch.tv_genre_id ?? '').trim()) || 'Stalker TV';
    return {
      name: String(ch.name || `Channel ${idx + 1}`),
      url: rawCmd,
      tvg: {
        id: String(ch.xmltv_id || ch.id || ''),
        name: String(ch.name || ''),
        logo: String(ch.logo || ''),
        url: '',
        rec: '',
      },
      group: { title: genreTitle },
      http: { referrer: '', 'user-agent': '' },
      line: idx + 1,
      raw: '',
      timeshift: '',
      catchup: { type: '', days: '', source: '' },
    };
  });

  return { token, items };
}

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
  const { token, items } = await fetchStalkerLiveCatalog(cleanUrl, mac);

  const now = new Date().toISOString();
  const playlistObj: Playlist = {
    _id: id,
    title: params.title.trim() || cleanUrl,
    url: cleanUrl,
    portalUrl: cleanUrl,
    macAddress: mac,
    stalkerToken: token,
    count: items.length,
    importDate: now,
    lastUsage: now,
    autoRefresh: false,
    playlist: {
      header: { attrs: {}, raw: '#EXTM3U' },
      items,
    },
  };

  await window.electron.dbUpsertAppPlaylist(playlistObj);
  return mapPlaylistToUnified(playlistObj);
}

export async function refreshStalkerPortal(playlist: UnifiedPlaylist): Promise<number> {
  const portalUrl = playlist.portalUrl || playlist.url;
  if (!isElectronRuntime() || !portalUrl || !playlist.macAddress) return 0;
  const { token, items } = await fetchStalkerLiveCatalog(
    portalUrl,
    playlist.macAddress,
    playlist.serialNumber
  );
  const existing = await window.electron.dbGetAppPlaylist?.(playlist.id).catch(() => null);
  const now = new Date().toISOString();
  const updated: Playlist = {
    ...(existing || {
      _id: playlist.id,
      title: playlist.title,
      importDate: now,
      lastUsage: now,
      autoRefresh: Boolean(playlist.autoRefresh),
    }),
    _id: playlist.id,
    title: playlist.title,
    url: portalUrl,
    portalUrl,
    macAddress: playlist.macAddress,
    stalkerToken: token,
    count: items.length,
    updateDate: Date.now(),
    playlist: {
      header: { attrs: {}, raw: '#EXTM3U' },
      items,
    },
  };
  await window.electron.dbUpsertAppPlaylist(updated);
  return items.length;
}
