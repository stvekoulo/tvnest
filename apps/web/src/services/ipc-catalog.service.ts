// Service de requêtage SQLite avancé, catégories comptées et temps forts TVNest.
import { isLikelyM3uVod } from '@iptvnator/shared/m3u-utils';
import { stripEmoji } from '@/lib/utils';
import {
  getFallbackRawPlaylist,
  isElectronRuntime,
} from '@/services/ipc-playlists.service';
import type {
  DbCatalogQueryPayload,
  DbCatalogRow,
} from '@/types/electron-ext';
import type {
  CatalogFilterState,
  CatalogSortMode,
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';
import { buildXtreamStreamUrl } from './xtream-stream-url';
export { buildXtreamStreamUrl } from './xtream-stream-url';

const SORT_TO_BACKEND: Record<CatalogSortMode, DbCatalogQueryPayload['sortBy']> = {
  relevance: 'recommended',
  recent: 'added_desc',
  'rating-desc': 'rating_desc',
  'title-asc': 'title_asc',
  'title-desc': 'title_desc',
  'year-desc': 'year_desc',
};

export function mapDbCatalogRow(
  playlist: UnifiedPlaylist,
  row: DbCatalogRow
): UnifiedMedia {
  const isXtream = playlist.kind === 'xtream';
  const streamUrl =
    row.stream_url ||
    (isXtream && row.xtream_id
      ? buildXtreamStreamUrl(playlist, row.xtream_id, row.type)
      : undefined);

  return {
    id: isXtream
      ? `${playlist.id}-${row.type}-${row.xtream_id}`
      : `${playlist.id}-m3u-${row.id}`,
    dbContentId: isXtream ? row.id : undefined,
    xtreamId: row.xtream_id || undefined,
    playlistId: playlist.id,
    playlistTitle: playlist.title,
    portalKind: playlist.kind,
    kind: row.type,
    title: stripEmoji(row.title),
    category: stripEmoji(row.category_name) || row.type.toUpperCase(),
    categoryId: isXtream ? `${row.type}-${row.category_id}` : row.category_name,
    posterUrl: row.poster_url || undefined,
    backdropUrl: row.backdrop_url || row.poster_url || undefined,
    streamUrl,
    tvgId: row.epg_channel_id || undefined,
    tvArchive: row.tv_archive ?? undefined,
    rating: row.rating || undefined,
    year: row.release_year ? String(row.release_year) : undefined,
    addedAt: row.added || undefined,
    isFavorite: Boolean(row.is_favorite),
    userAgent: row.user_agent || playlist.userAgent,
    referrer: row.referrer || undefined,
  };
}

// Charge les catégories SQLite avec leur nombre exact d'éléments par catégorie.
export async function fetchCategoriesWithCounts(
  playlist: UnifiedPlaylist,
  /** Ne garde que les groupes de cette langue ('ALL' = tous). */
  language?: string
): Promise<UnifiedCategory[]> {
  if (isElectronRuntime() && window.electron.dbGetCategoriesWithCounts) {
    const rows = await window.electron.dbGetCategoriesWithCounts(playlist.id, language);
    return (rows || []).map((c) => ({
      id:
        playlist.kind === 'xtream' ? `${c.type}-${c.id}` : String(c.id),
      dbId: typeof c.id === 'number' ? c.id : undefined,
      xtreamId: c.xtream_id,
      name: stripEmoji(c.name),
      rawName: c.name,
      type: c.type,
      count: c.stream_count,
      hidden: Boolean(c.hidden),
    }));
  }
  const fallback = await loadFallbackM3uCatalog(playlist);
  return fallback.categories;
}

// Charge les sélections de la page d'accueil avec jaquettes valides depuis SQLite.
export async function fetchDashboardHighlights(
  playlist: UnifiedPlaylist,
  preferLanguage?: string
): Promise<{
  spotlight: UnifiedMedia[];
  liveChannels: UnifiedMedia[];
  recentMovies: UnifiedMedia[];
  recentSeries: UnifiedMedia[];
  favorites: UnifiedMedia[];
  continueWatching: UnifiedMedia[];
}> {
  if (isElectronRuntime() && window.electron.dbGetDashboardHighlights) {
    const res = await window.electron.dbGetDashboardHighlights(
      playlist.id,
      preferLanguage
    );
    const mapList = (rows: DbCatalogRow[]) =>
      (rows || []).map((r) => mapDbCatalogRow(playlist, r));
    const recentVod = mapList(res.recentVod);
    return {
      spotlight: mapList(res.spotlight),
      liveChannels: mapList(res.featuredLive),
      recentMovies: recentVod.filter((m) => m.kind === 'movie'),
      recentSeries: recentVod.filter((m) => m.kind === 'series'),
      favorites: mapList(res.favorites),
      continueWatching: mapList(res.recentlyViewed),
    };
  }

  const { items } = await loadFallbackM3uCatalog(playlist);
  return {
    spotlight: items.filter((i) => Boolean(i.posterUrl)).slice(0, 12),
    liveChannels: items.filter((i) => i.kind === 'live').slice(0, 24),
    recentMovies: items.filter((i) => i.kind === 'movie').slice(0, 24),
    recentSeries: items.filter((i) => i.kind === 'series').slice(0, 24),
    favorites: items.filter((i) => i.isFavorite).slice(0, 24),
    continueWatching: [],
  };
}

// Exécute une recherche/filtrage multicritère dans SQLite avec pagination rapide.
export async function queryFilteredCatalog(
  playlist: UnifiedPlaylist,
  options: {
    type: 'live' | 'movie' | 'series' | 'all';
    // Le backend filtre par nom de groupe (`cat.name`), pour Xtream comme pour M3U.
    categoryName: string | null;
    filters: CatalogFilterState;
    onlyRecent?: boolean;
    preferLanguage?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  items: UnifiedMedia[];
  total: number;
  years: string[];
  tookMs: number;
}> {
  const {
    type,
    categoryName,
    filters,
    onlyRecent,
    preferLanguage,
    limit = 180,
    offset = 0,
  } = options;

  if (isElectronRuntime() && window.electron.dbQueryCatalog) {
    const payload: DbCatalogQueryPayload = {
      playlistId: playlist.id,
      type,
      categoryName: categoryName || undefined,
      search: filters.search,
      language: filters.language,
      quality: filters.quality,
      minRating: filters.minRating,
      year: filters.year,
      onlyFavorites: filters.onlyFavorites,
      onlyHistory: onlyRecent,
      hasCatchup: filters.hasCatchup,
      hasEpg: filters.hasEpg,
      preferredLanguage: preferLanguage,
      sortBy: SORT_TO_BACKEND[filters.sortBy],
      limit,
      offset,
    };
    const res = await window.electron.dbQueryCatalog(payload);
    return {
      items: (res.items || []).map((r) => mapDbCatalogRow(playlist, r)),
      total: res.total || 0,
      years: [],
      tookMs: res.tookMs || 0,
    };
  }

  const start = performance.now();
  const { items } = await loadFallbackM3uCatalog(playlist);
  const q = filters.search.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (type !== 'all' && it.kind !== type) return false;
    if (categoryName && it.categoryId !== categoryName) return false;
    if (filters.onlyFavorites && !it.isFavorite) return false;
    if (q && !`${it.title} ${it.category}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    years: [],
    tookMs: Math.round(performance.now() - start),
  };
}

async function loadFallbackM3uCatalog(playlist: UnifiedPlaylist): Promise<{
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
      return {
        id: `${playlist.id}-m3u-${idx}`,
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
        isFavorite: favSet.has(it.url || `${playlist.id}-${idx}`),
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

// Recherche dans toutes les sources de la base (Live, Films, Séries), sans filtre de langue
// ni de groupe : utilisée par la recherche lancée depuis l'Accueil.
export async function searchAllSources(
  playlists: UnifiedPlaylist[],
  query: string,
  limitPerSource = 60
): Promise<UnifiedMedia[]> {
  const filters: CatalogFilterState = {
    search: query,
    language: 'ALL',
    quality: 'ALL',
    minRating: 0,
    year: '',
    onlyFavorites: false,
    hasCatchup: false,
    hasEpg: false,
    sortBy: 'relevance',
  };
  const perSource = await Promise.all(
    playlists.map((pl) =>
      queryFilteredCatalog(pl, { type: 'all', categoryName: null, filters, limit: limitPerSource })
        .then((res) => res.items)
        .catch(() => [] as UnifiedMedia[])
    )
  );
  return perSource.flat();
}
