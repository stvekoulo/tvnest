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

/** Each source and section owns all its filters, including search and sorting. */
export function useCatalogFilters(playlistId: string, section: AppSection, prefs: AppPreferences) {
  const { autoFilterByLanguage, preferredContentLanguage } = prefs;
  const defaultFilters = useMemo(
    () => createDefaultFilters(autoFilterByLanguage, preferredContentLanguage),
    [autoFilterByLanguage, preferredContentLanguage]
  );
  const [filtersByScope, setFiltersByScope] = useState<Record<string, CatalogFilterState>>({});
  const filters = filtersByScope[`${playlistId}|${section}`] ?? defaultFilters;

  // Global language preferences intentionally apply to every customized section.
  useEffect(() => {
    if (!autoFilterByLanguage) return;
    setFiltersByScope((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([scope, filter]) => [
          scope,
          { ...filter, language: preferredContentLanguage },
        ])
      )
    );
  }, [autoFilterByLanguage, preferredContentLanguage]);

  const updateFilters = useCallback(
    (patch: Partial<CatalogFilterState>, forSection?: AppSection) => {
      const scope = `${playlistId}|${forSection ?? section}`;
      setFiltersByScope((prev) => ({
        ...prev,
        [scope]: { ...(prev[scope] ?? defaultFilters), ...patch },
      }));
    },
    [playlistId, section, defaultFilters]
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
