// Résolveur universel de lecture TVNest (Xtream, Stalker create_link, M3U & libmpv).
import { XTREAM_CLIENT_USER_AGENT } from '@iptvnator/shared/interfaces';
import type {
  EmbeddedMpvSupport,
  PlayerContentInfo,
  ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { shouldOfferResume } from '@/lib/resume-point';
import { buildXtreamStreamUrl } from '@/services/ipc-catalog.service';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import { fetchXtreamMovieDetail } from '@/services/ipc-series.service';
import type { UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

let cachedMpvSupport: EmbeddedMpvSupport | null = null;

function cleanStalkerCmdUrl(rawCmd: string): string {
  return rawCmd
    .trim()
    .replace(/^(?:ffrt\d*|ffmpeg)\s+/i, '')
    .trim();
}

function needsStalkerCreateLink(rawCmd: string, cleaned: string): boolean {
  if (!rawCmd.trim()) return false;
  if (/^(?:ffrt\d*|ffmpeg)\s+/i.test(rawCmd.trim())) return true;
  if (!/^https?:\/\//i.test(cleaned)) return true;
  return /\/play\/|play_token=|stream=&/i.test(cleaned);
}

// Détecte et prépare le moteur libmpv embarqué (frame-copy WebGL2 ou HWND natif).
export async function probeEmbeddedMpvSupport(
  forceRefresh = false
): Promise<EmbeddedMpvSupport> {
  if (!isElectronRuntime()) {
    return { supported: false, platform: 'web', reason: 'Browser runtime' };
  }
  if (cachedMpvSupport && !cachedMpvSupport.inconclusive && !forceRefresh) {
    return cachedMpvSupport;
  }

  try {
    const support = window.electron.prepareEmbeddedMpv
      ? await window.electron.prepareEmbeddedMpv()
      : await window.electron.getEmbeddedMpvSupport();
    if (!support.inconclusive) {
      cachedMpvSupport = support;
    }
    return support;
  } catch (err) {
    return {
      supported: false,
      platform: window.electron.platform || 'unknown',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function negotiateStalkerToken(
  portalUrl: string,
  macAddress: string,
  serialNumber?: string
): Promise<string | undefined> {
  const hs = await window.electron.stalkerRequest({
    url: portalUrl,
    macAddress,
    serialNumber,
    params: { type: 'stb', action: 'handshake', JsHttpRequest: '1-xml' },
  });
  return (hs as { js?: { token?: string } })?.js?.token;
}

async function resolveStalkerPlayback(
  rawUrl: string,
  kind: UnifiedMedia['kind'],
  playlist?: UnifiedPlaylist | null
): Promise<{
  streamUrl: string;
  cookie?: string;
  authorization?: string;
}> {
  const cleaned = cleanStalkerCmdUrl(rawUrl);
  if (!isElectronRuntime() || !playlist?.macAddress) {
    return { streamUrl: cleaned };
  }

  const cookie = `mac=${encodeURIComponent(playlist.macAddress)}; stb_lang=en; timezone=Europe%2FParis`;
  const portalUrl = playlist.portalUrl || playlist.url || playlist.serverUrl;
  if (!portalUrl) {
    return {
      streamUrl: cleaned,
      cookie,
      authorization: playlist.token ? `Bearer ${playlist.token}` : undefined,
    };
  }

  let token = playlist.token;
  if (!token) {
    token = await negotiateStalkerToken(portalUrl, playlist.macAddress, playlist.serialNumber).catch(
      () => undefined
    );
  }

  if (!needsStalkerCreateLink(rawUrl, cleaned)) {
    return {
      streamUrl: cleaned,
      cookie,
      authorization: token ? `Bearer ${token}` : undefined,
    };
  }

  const requestCreateLink = (activeToken?: string) =>
    window.electron.stalkerRequest({
      url: portalUrl,
      macAddress: playlist.macAddress as string,
      serialNumber: playlist.serialNumber,
      token: activeToken,
      params: {
        type: kind === 'live' ? 'itv' : 'vod',
        action: 'create_link',
        cmd: rawUrl,
        forced_storage: 'undefined',
        disable_ad: '0',
        JsHttpRequest: '1-xml',
      },
    });

  try {
    let response = await requestCreateLink(token);
    if ('stalkerAuthFailure' in response) {
      token = await negotiateStalkerToken(portalUrl, playlist.macAddress, playlist.serialNumber);
      response = await requestCreateLink(token);
    }
    const js = (response as { js?: { cmd?: unknown } })?.js;
    const resolvedUrl =
      js && typeof js.cmd === 'string' && js.cmd.trim()
        ? cleanStalkerCmdUrl(js.cmd)
        : cleaned;
    return {
      streamUrl: resolvedUrl,
      cookie,
      authorization: token ? `Bearer ${token}` : undefined,
    };
  } catch {
    return {
      streamUrl: cleaned,
      cookie,
      authorization: token ? `Bearer ${token}` : undefined,
    };
  }
}

// Résout l'URL finale, l'extension réelle (.mkv/.mp4/.ts/.m3u8), les headers et le point de reprise.
export async function resolveMediaPlayback(
  item: UnifiedMedia,
  playlist?: UnifiedPlaylist | null
): Promise<ResolvedPortalPlayback> {
  let activeItem = item;

  if (
    item.portalKind === 'xtream' &&
    item.kind === 'movie' &&
    item.xtreamId &&
    playlist?.serverUrl &&
    !item.containerExtension
  ) {
    activeItem = await fetchXtreamMovieDetail(playlist, item).catch(() => item);
  }

  let streamUrl = activeItem.streamUrl || '';
  let liveAutoTsUrl: string | undefined;
  let stalkerCookie: string | undefined;
  let stalkerAuth: string | undefined;

  if (
    activeItem.portalKind === 'xtream' &&
    activeItem.kind === 'live' &&
    activeItem.xtreamId &&
    playlist?.serverUrl
  ) {
    streamUrl = buildXtreamStreamUrl(
      playlist,
      activeItem.xtreamId,
      'live',
      'm3u8'
    );
    liveAutoTsUrl = buildXtreamStreamUrl(
      playlist,
      activeItem.xtreamId,
      'live',
      'ts'
    );
  } else if (activeItem.portalKind === 'stalker' && streamUrl) {
    const stalker = await resolveStalkerPlayback(
      streamUrl,
      activeItem.kind,
      playlist
    );
    streamUrl = stalker.streamUrl;
    stalkerCookie = stalker.cookie;
    stalkerAuth = stalker.authorization;
  }

  const userAgent =
    activeItem.userAgent?.trim() ||
    playlist?.userAgent?.trim() ||
    (activeItem.portalKind === 'xtream' ? XTREAM_CLIENT_USER_AGENT : undefined);
  const referer = activeItem.referrer || undefined;
  const headers: Record<string, string> = {};
  if (userAgent) headers['User-Agent'] = userAgent;
  if (referer) headers.Referer = referer;
  if (stalkerCookie) headers.Cookie = stalkerCookie;
  if (stalkerAuth) headers.Authorization = stalkerAuth;

  if (
    isElectronRuntime() &&
    /^https?:\/\//i.test(streamUrl) &&
    (stalkerCookie || stalkerAuth)
  ) {
    window.electron
      .setUserAgent?.(userAgent || null, referer || null, streamUrl, {
        authorization: stalkerAuth || null,
        cookie: stalkerCookie || null,
      })
      .catch(() => {});
  }

  const contentInfo: PlayerContentInfo | undefined =
    activeItem.xtreamId && activeItem.kind !== 'live'
      ? {
          playlistId: activeItem.playlistId,
          contentXtreamId: activeItem.xtreamId,
          contentType: activeItem.kind === 'episode' ? 'episode' : 'vod',
          seriesXtreamId: activeItem.seriesXtreamId,
          seasonNumber: activeItem.seasonNumber,
          episodeNumber: activeItem.episodeNumber,
        }
      : undefined;

  const startTime =
    activeItem.kind !== 'live' &&
    activeItem.progressSeconds !== undefined &&
    shouldOfferResume(activeItem.progressSeconds, activeItem.durationSeconds)
      ? Math.floor(activeItem.progressSeconds)
      : undefined;

  return {
    streamUrl,
    liveAutoTsUrl,
    title: activeItem.title,
    thumbnail: activeItem.posterUrl || activeItem.backdropUrl || null,
    isLive: activeItem.kind === 'live',
    startTime,
    contentInfo,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    userAgent,
    referer,
  };
}
