// Catalogue M3U de secours hors runtime Electron (mode navigateur local).
import { isLikelyM3uVod } from '@iptvnator/shared/m3u-utils';
import { stripEmoji } from '@/lib/utils';
import { getFallbackRawPlaylist } from '@/services/ipc-playlists.service';
import type {
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

function hashFallbackKey(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 1) || 1;
}

export async function loadFallbackM3uCatalog(playlist: UnifiedPlaylist): Promise<{
  categories: UnifiedCategory[];
  items: UnifiedMedia[];
}> {
  const full = getFallbackRawPlaylist(playlist.id);
  const rawItems = (full?.playlist?.items || []) as Array<{
    name?: string;
    url?: string;
    tvg?: { id?: string; logo?: string };
    group?: { title?: string };
    http?: { 'user-agent'?: string; referrer?: string };
  }>;
  const favSet = new Set<string>(
    Array.isArray(full?.favorites) ? (full.favorites as string[]) : []
  );
  const catCounts = new Map<
    string,
    { type: 'live' | 'movie'; count: number }
  >();
  const items: UnifiedMedia[] = rawItems
    .filter((it) => Boolean(it?.url && it?.name))
    .map((it, idx) => {
      const cat = it.group?.title?.trim() || 'Non classé';
      const kind: 'live' | 'movie' = isLikelyM3uVod({
        url: it.url || '',
        radio: 'false',
      })
        ? 'movie'
        : 'live';
      const prev = catCounts.get(cat);
      catCounts.set(cat, { type: kind, count: (prev?.count || 0) + 1 });
      const keyHash = hashFallbackKey(`${it.url}|${it.tvg?.id || ''}|${it.name}`);
      return {
        id: `${playlist.id}-m3u-${keyHash}`,
        playlistId: playlist.id,
        playlistTitle: playlist.title,
        portalKind: playlist.kind,
        kind,
        title: stripEmoji(it.name) || `Flux ${idx + 1}`,
        category: stripEmoji(cat),
        categoryId: cat,
        posterUrl: it.tvg?.logo || undefined,
        backdropUrl: it.tvg?.logo || undefined,
        streamUrl: it.url,
        tvgId: it.tvg?.id || undefined,
        isFavorite: Boolean(
          (it.url && favSet.has(it.url)) ||
            (it.tvg?.id && favSet.has(it.tvg.id))
        ),
        userAgent: it.http?.['user-agent'] || playlist.userAgent,
        referrer: it.http?.referrer || undefined,
      };
    });

  const categories: UnifiedCategory[] = Array.from(catCounts.entries()).map(
    ([name, meta]) => ({
      id: name,
      name: stripEmoji(name),
      rawName: name,
      type: meta.type,
      count: meta.count,
    })
  );
  return { categories, items };
}
