// Rangées par groupe d'une rubrique (Live TV, Films, Séries), comme celles de l'Accueil :
// les plus gros groupes, quelques titres chacun. Gardées en mémoire et préchargées :
// changer de rubrique les affiche tout de suite.
import { useEffect, useState } from 'react';
import { queryFilteredCatalog } from '@/services/ipc-catalog.service';
import type { CatalogFilterState, UnifiedCategory, UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

export interface SectionRail {
  category: UnifiedCategory;
  items: UnifiedMedia[];
}

type RailType = 'live' | 'movie' | 'series';

const RAIL_GROUPS = 8;
const RAIL_ITEMS = 10;
const RAILS_FRESH_MS = 60_000;
const railsCache = new Map<string, { at: number; rails: SectionRail[] }>();

function topGroups(categories: UnifiedCategory[]): UnifiedCategory[] {
  return [...categories]
    .filter((c) => (c.count ?? 1) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, RAIL_GROUPS);
}

function railsKey(playlistId: string, type: RailType, groups: UnifiedCategory[], filters: CatalogFilterState): string {
  return JSON.stringify([playlistId, type, groups.map((g) => g.id), filters]);
}

export function clearCachedRails(): void {
  railsCache.clear();
}

/** Charge (ou reprend du cache s'il est frais) les rangées d'une rubrique. */
export async function loadSectionRails(
  playlist: UnifiedPlaylist,
  type: RailType,
  categories: UnifiedCategory[],
  filters: CatalogFilterState
): Promise<SectionRail[]> {
  const groups = topGroups(categories);
  const key = railsKey(playlist.id, type, groups, filters);
  const cached = railsCache.get(key);
  if (cached && Date.now() - cached.at < RAILS_FRESH_MS) return cached.rails;
  // Une requête après l'autre : la base n'en traite qu'une à la fois de toute façon.
  const rails: SectionRail[] = [];
  for (const category of groups) {
    const res = await queryFilteredCatalog(playlist, {
      type,
      categoryName: category.rawName ?? category.name,
      filters,
      preferLanguage: filters.language,
      limit: RAIL_ITEMS,
      offset: 0,
    }).catch(() => null);
    if (res && res.items.length > 0) rails.push({ category, items: res.items });
  }
  railsCache.set(key, { at: Date.now(), rails });
  return rails;
}

export function useSectionRails(
  playlist: UnifiedPlaylist | null,
  type: RailType | null,
  categories: UnifiedCategory[],
  filters: CatalogFilterState
): SectionRail[] {
  const key = playlist && type ? railsKey(playlist.id, type, topGroups(categories), filters) : '';
  // Rangées liées à leur clé : changer de rubrique n'affiche jamais celles de la précédente.
  const [loaded, setLoaded] = useState<{ key: string; rails: SectionRail[] }>({ key: '', rails: [] });

  useEffect(() => {
    if (!playlist || !type || categories.length === 0) return;
    const cached = railsCache.get(key);
    if (cached && Date.now() - cached.at < RAILS_FRESH_MS) return;
    let cancelled = false;
    void loadSectionRails(playlist, type, categories, filters).then((rails) => {
      if (!cancelled) setLoaded({ key, rails });
    });
    return () => {
      cancelled = true;
    };
    // `categories` et `filters` sont résumés par `key`.
  }, [playlist, type, key]);

  if (!key) return [];
  return loaded.key === key ? loaded.rails : (railsCache.get(key)?.rails ?? []);
}
