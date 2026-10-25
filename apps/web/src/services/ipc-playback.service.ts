// Résolveur universel de lecture TVNest (Xtream, Stalker create_link, M3U & libmpv).
import { XTREAM_CLIENT_USER_AGENT } from '@iptvnator/shared/interfaces';
import type {
  EmbeddedMpvSupport,
  PlayerContentInfo,
  ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
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

async function resolveStalkerStreamUrl(
  rawUrl: string,
  kind: UnifiedMedia['kind'],
  playlist?: UnifiedPlaylist | null
): Promise<string> {
  const cleaned = cleanStalkerCmdUrl(rawUrl);
  if (
    !isElectronRuntime() ||
    !playlist?.macAddress ||
    (!rawUrl.startsWith('ff') && cleaned.startsWith('http') && !cleaned.includes('play/live.php'))
  ) {
    return cleaned;
  }

  const portalUrl = playlist.url || playlist.serverUrl;
  if (!portalUrl) return cleaned;

  try {
    const response = await window.electron.stalkerRequest({
      url: portalUrl,
      macAddress: playlist.macAddress,
      serialNumber: playlist.serialNumber,
      token: playlist.token,
      params: {
        type: kind === 'live' ? 'itv' : 'vod',
        action: 'create_link',
        cmd: rawUrl,
        forced_storage: 'undefined',
        disable_ad: '0',
        JsHttpRequest: '1-xml',
      },
    });
    const js = (response as { js?: { cmd?: unknown } })?.js;
    if (js && typeof js.cmd === 'string' && js.cmd.trim()) {
      return cleanStalkerCmdUrl(js.cmd);
    }
  } catch {
    return cleaned;
  }
  return cleaned;
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
    streamUrl = await resolveStalkerStreamUrl(
      streamUrl,
      activeItem.kind,
      playlist
    );
  }

  const userAgent =
    activeItem.userAgent?.trim() ||
    playlist?.userAgent?.trim() ||
    (activeItem.portalKind === 'xtream' ? XTREAM_CLIENT_USER_AGENT : undefined);
  const referer = activeItem.referrer || undefined;
  const headers: Record<string, string> = {};
  if (userAgent) headers['User-Agent'] = userAgent;
  if (referer) headers.Referer = referer;

  const contentInfo: PlayerContentInfo | undefined =
    activeItem.xtreamId && activeItem.kind !== 'live'
      ? {
          playlistId: activeItem.playlistId,
          contentXtreamId: activeItem.xtreamId,
          contentType: activeItem.kind === 'episode' ? 'episode' : 'vod',
        }
      : undefined;

  const startTime =
    activeItem.kind !== 'live' &&
    activeItem.progressSeconds &&
    activeItem.progressSeconds > 5
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
