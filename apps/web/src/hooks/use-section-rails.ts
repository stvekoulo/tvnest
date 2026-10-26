// Rangées par groupe d'une rubrique (Live TV, Films, Séries), comme celles de l'Accueil :
// les plus gros groupes, quelques titres chacun, chargés en parallèle.
import { useEffect, useState } from 'react';
import { queryFilteredCatalog } from '@/services/ipc-catalog.service';
import type { CatalogFilterState, UnifiedCategory, UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

export interface SectionRail {
  category: UnifiedCategory;
  items: UnifiedMedia[];
}

const RAIL_GROUPS = 8;
const RAIL_ITEMS = 10;

export function useSectionRails(
  playlist: UnifiedPlaylist | null,
  type: 'live' | 'movie' | 'series' | null,
  categories: UnifiedCategory[],
  filters: CatalogFilterState
): SectionRail[] {
  const [rails, setRails] = useState<SectionRail[]>([]);
  const groups = [...categories]
    .filter((c) => (c.count ?? 1) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, RAIL_GROUPS);
  const groupsKey = groups.map((g) => g.id).join('|');

  useEffect(() => {
    if (!playlist || !type || groups.length === 0) {
      setRails([]);
      return;
    }
    let cancelled = false;
    void Promise.all(
      groups.map((category) =>
        queryFilteredCatalog(playlist, {
          type,
          categoryName: category.rawName ?? category.name,
          filters,
          preferLanguage: filters.language,
          limit: RAIL_ITEMS,
          offset: 0,
        })
          .then((res) => ({ category, items: res.items }))
          .catch(() => ({ category, items: [] as UnifiedMedia[] }))
      )
    ).then((loaded) => {
      if (!cancelled) setRails(loaded.filter((rail) => rail.items.length > 0));
    });
    return () => {
      cancelled = true;
    };
    // `groups` suit `groupsKey` : pas besoin de le lister.
  }, [playlist, type, groupsKey, filters]);

  return rails;
}
