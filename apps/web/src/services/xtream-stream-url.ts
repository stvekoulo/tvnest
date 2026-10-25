import { normalizeXtreamServerUrl } from '@iptvnator/shared/interfaces';
import type { StreamKind, UnifiedPlaylist } from '@/types/iptv.types';

/** Keep playback URLs aligned with the API's server and credential normalization. */
export function buildXtreamStreamUrl(
  playlist: UnifiedPlaylist,
  streamId: number,
  kind: StreamKind,
  ext?: string
): string {
  const base = normalizeXtreamServerUrl(playlist.serverUrl || '');
  const username = encodeURIComponent((playlist.username || '').trim());
  const password = encodeURIComponent((playlist.password || '').trim());
  const extension = ext || (kind === 'live' ? 'm3u8' : 'mp4');
  const route = kind === 'live' ? 'live' : kind === 'movie' ? 'movie' : 'series';
  return `${base}/${route}/${username}/${password}/${streamId}.${extension}`;
}
