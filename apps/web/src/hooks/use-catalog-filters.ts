import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppPreferences, AppSection, CatalogFilterState } from '@/types/iptv.types';

function createDefaultFilters(
  autoFilterByLanguage: boolean,
  preferredContentLanguage: AppPreferences['preferredContentLanguage']
): CatalogFilterState {
  return {
    search: '',
    language: autoFilterByLanguage ? preferredContentLanguage : 'ALL',
    quality: 'ALL',
    minRating: 0,
    year: '',
    onlyFavorites: false,
    hasCatchup: false,
    hasEpg: false,
    sortBy: 'relevance',
  };
}

// Chaînes en direct : la langue par défaut du catalogue ne s'applique pas (les noms de
// chaînes et de groupes ne la signalent pas comme pour les films et séries).
const LANGUAGE_FREE_SECTIONS: readonly AppSection[] = ['live', 'epg'];

/** Each source and section owns all its filters, including search and sorting. */
export function useCatalogFilters(playlistId: string, section: AppSection, prefs: AppPreferences) {
  const { autoFilterByLanguage, preferredContentLanguage } = prefs;
  const defaultsFor = useCallback(
    (target: AppSection) =>
      createDefaultFilters(
        autoFilterByLanguage && !LANGUAGE_FREE_SECTIONS.includes(target),
        preferredContentLanguage
      ),
    [autoFilterByLanguage, preferredContentLanguage]
  );
  const defaultFilters = useMemo(() => defaultsFor(section), [defaultsFor, section]);
  const [filtersByScope, setFiltersByScope] = useState<Record<string, CatalogFilterState>>({});
  const filters = filtersByScope[`${playlistId}|${section}`] ?? defaultFilters;

  // La langue préférée s'applique à toutes les rubriques déjà personnalisées, sauf le direct.
  useEffect(() => {
    if (!autoFilterByLanguage) return;
    setFiltersByScope((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([scope, filter]) => [
          scope,
          LANGUAGE_FREE_SECTIONS.some((s) => scope.endsWith(`|${s}`))
            ? filter
            : { ...filter, language: preferredContentLanguage },
        ])
      )
    );
  }, [autoFilterByLanguage, preferredContentLanguage]);

  const updateFilters = useCallback(
    (patch: Partial<CatalogFilterState>, forSection?: AppSection) => {
      const target = forSection ?? section;
      const scope = `${playlistId}|${target}`;
      setFiltersByScope((prev) => ({
        ...prev,
        [scope]: { ...(prev[scope] ?? defaultsFor(target)), ...patch },
      }));
    },
    [playlistId, section, defaultsFor]
  );

  // Réinitialise uniquement la rubrique courante.
  const resetFilters = useCallback(() => {
    const scope = `${playlistId}|${section}`;
    setFiltersByScope((prev) => {
      const next = { ...prev };
      delete next[scope];
      return next;
    });
  }, [playlistId, section]);

  return { filters, updateFilters, resetFilters };
}
