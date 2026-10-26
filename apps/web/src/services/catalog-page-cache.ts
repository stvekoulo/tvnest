// Première page de chaque rubrique gardée en mémoire : revenir sur Live TV, Films ou Séries
// est immédiat, la page est ensuite rafraîchie en arrière-plan si elle a plus de 30 s.
import { queryFilteredCatalog } from '@/services/ipc-catalog.service';
import type { AppSection, CatalogFilterState, UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

export const CATALOG_PAGE_SIZE = 140;
export const CATALOG_PAGE_FRESH_MS = 30_000;

export interface CatalogPage {
  items: UnifiedMedia[];
  total: number;
  years: string[];
  tookMs: number;
}

type PageRequest = Parameters<typeof queryFilteredCatalog>[1];

const pages = new Map<string, { at: number; page: CatalogPage }>();

export function sectionQueryType(section: AppSection): 'live' | 'movie' | 'series' | 'all' {
  if (section === 'live' || section === 'epg') return 'live';
  if (section === 'movies') return 'movie';
  if (section === 'series') return 'series';
  return 'all';
}

/** Requête de la première page d'une rubrique : la même pour l'affichage et le préchargement. */
export function buildPageRequest(
  section: AppSection,
  filters: CatalogFilterState,
  categoryName: string | null,
  preferLanguage: string
): PageRequest {
  return {
    type: sectionQueryType(section),
    categoryName,
    filters: { ...filters, onlyFavorites: section === 'favorites' ? true : filters.onlyFavorites },
    onlyRecent: section === 'history',
    preferLanguage,
    limit: section === 'epg' ? 240 : CATALOG_PAGE_SIZE,
    offset: 0,
  };
}

export function pageKey(playlistId: string, request: PageRequest): string {
  return JSON.stringify([playlistId, request]);
}

export function readCachedPage(key: string): { at: number; page: CatalogPage } | undefined {
  return pages.get(key);
}

export function storeCachedPage(key: string, page: CatalogPage): void {
  pages.set(key, { at: Date.now(), page });
}

/** Favori basculé, source actualisée : les pages gardées ne sont plus à jour. */
export function clearCachedPages(): void {
  pages.clear();
}

/** Charge et garde une page si elle n'est pas déjà fraîche (préchargement). */
export async function prefetchPage(playlist: UnifiedPlaylist, request: PageRequest): Promise<void> {
  const key = pageKey(playlist.id, request);
  const cached = pages.get(key);
  if (cached && Date.now() - cached.at < CATALOG_PAGE_FRESH_MS) return;
  const res = await queryFilteredCatalog(playlist, request);
  storeCachedPage(key, { items: res.items, total: res.total, years: res.years, tookMs: res.tookMs });
}
