// Hook de requêtage réactif SQLite / M3U avec filtres multicritères, pagination et EPG.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCategoriesWithCounts,
  fetchDashboardHighlights,
  queryFilteredCatalog,
} from '@/services/ipc-catalog.service';
import { fetchCurrentEpgForChannels } from '@/services/ipc-system.service';
import type {
  AppPreferences,
  AppSection,
  CatalogFilterState,
  EpgProgram,
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

const PAGE_SIZE = 140;

export interface DashboardHighlightsState {
  spotlight: UnifiedMedia[];
  liveChannels: UnifiedMedia[];
  recentMovies: UnifiedMedia[];
  recentSeries: UnifiedMedia[];
  favorites: UnifiedMedia[];
  continueWatching: UnifiedMedia[];
}

const EMPTY_HIGHLIGHTS: DashboardHighlightsState = {
  spotlight: [],
  liveChannels: [],
  recentMovies: [],
  recentSeries: [],
  favorites: [],
  continueWatching: [],
};

function createDefaultFilters(prefs: AppPreferences): CatalogFilterState {
  return {
    search: '',
    language: prefs.autoFilterByLanguage ? prefs.preferredContentLanguage : 'ALL',
    quality: 'ALL',
    minRating: 0,
    year: '',
    onlyFavorites: false,
    hasCatchup: false,
    hasEpg: false,
    sortBy: 'relevance',
  };
}

export function useCatalogQuery(
  activePlaylist: UnifiedPlaylist | null,
  section: AppSection,
  prefs: AppPreferences,
  onError: (msg: string) => void
) {
  const [categories, setCategories] = useState<UnifiedCategory[]>([]);
  const [highlights, setHighlights] = useState<DashboardHighlightsState>(EMPTY_HIGHLIGHTS);
  // La sélection est liée à (playlist, rubrique) : changer de rubrique revient à « Tous »,
  // sauf si l'appelant cible explicitement la nouvelle rubrique (navigation depuis l'Accueil).
  const scopeOf = (sec: AppSection) => `${activePlaylist?.id ?? ''}|${sec}`;
  const [categorySelection, setCategorySelection] = useState({
    scope: scopeOf(section),
    id: 'ALL',
  });
  const selectedCategory =
    categorySelection.scope === scopeOf(section) ? categorySelection.id : 'ALL';
  const setSelectedCategory = useCallback(
    (id: string, forSection?: AppSection) =>
      setCategorySelection({
        scope: `${activePlaylist?.id ?? ''}|${forSection ?? section}`,
        id,
      }),
    [activePlaylist?.id, section]
  );
  const [filters, setFilters] = useState<CatalogFilterState>(() => createDefaultFilters(prefs));
  const [items, setItems] = useState<UnifiedMedia[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [queryTookMs, setQueryTookMs] = useState<number>(0);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [epgByChannel, setEpgByChannel] = useState<Record<string, EpgProgram | null>>({});

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      language: prefs.autoFilterByLanguage ? prefs.preferredContentLanguage : prev.language,
    }));
  }, [prefs.autoFilterByLanguage, prefs.preferredContentLanguage]);

  // Charge les catégories comptées et les sélections Accueil dès que la playlist change.
  const reloadOverview = useCallback(async () => {
    if (!activePlaylist) {
      setCategories([]);
      setHighlights(EMPTY_HIGHLIGHTS);
      return;
    }
    try {
      const [cats, dash] = await Promise.all([
        fetchCategoriesWithCounts(activePlaylist),
        fetchDashboardHighlights(activePlaylist, prefs.preferredContentLanguage),
      ]);
      setCategories(cats);
      setHighlights(dash);

      const epgIds = dash.liveChannels
        .map((c) => c.tvgId)
        .filter((x): x is string => Boolean(x));
      if (epgIds.length > 0) {
        const map = await fetchCurrentEpgForChannels(epgIds);
        setEpgByChannel((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      onError(`Erreur catalogue : ${(err as Error).message}`);
    }
  }, [activePlaylist, prefs.preferredContentLanguage, onError]);

  useEffect(() => {
    void reloadOverview();
  }, [reloadOverview]);

  const queryType = useMemo<'live' | 'movie' | 'series' | 'all'>(() => {
    if (section === 'live' || section === 'epg') return 'live';
    if (section === 'movies') return 'movie';
    if (section === 'series') return 'series';
    return 'all';
  }, [section]);

  const selectedCategoryName = useMemo(
    () =>
      selectedCategory === 'ALL'
        ? null
        : (() => {
            const cat = categories.find((c) => c.id === selectedCategory);
            return cat ? cat.rawName ?? cat.name : null;
          })(),
    [categories, selectedCategory]
  );

  // Exécute la requête SQLite filtrée avec anti-rebond léger (100 ms).
  useEffect(() => {
    if (!activePlaylist) {
      setItems([]);
      setTotalMatches(0);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const effectiveFilters: CatalogFilterState = {
          ...filters,
          onlyFavorites: section === 'favorites' ? true : filters.onlyFavorites,
        };
        const res = await queryFilteredCatalog(activePlaylist, {
          type: queryType,
          categoryName: selectedCategoryName,
          filters: effectiveFilters,
          onlyRecent: section === 'history',
          preferLanguage: prefs.preferredContentLanguage,
          limit: section === 'epg' ? 240 : PAGE_SIZE,
          offset: 0,
        });
        if (cancelled) return;
        setItems(res.items);
        setTotalMatches(res.total);
        setAvailableYears(res.years);
        setQueryTookMs(res.tookMs);

        const liveEpgIds = res.items
          .filter((i) => i.kind === 'live' && i.tvgId)
          .slice(0, 80)
          .map((i) => i.tvgId as string);
        if (liveEpgIds.length > 0) {
          const map = await fetchCurrentEpgForChannels(liveEpgIds);
          if (!cancelled) setEpgByChannel((prev) => ({ ...prev, ...map }));
        }
      } catch (err) {
        if (!cancelled) onError(`Erreur recherche : ${(err as Error).message}`);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    activePlaylist,
    queryType,
    selectedCategoryName,
    filters,
    section,
    prefs.preferredContentLanguage,
    onError,
  ]);

  const loadMore = useCallback(async () => {
    if (!activePlaylist || catalogLoading || items.length >= totalMatches) return;
    setCatalogLoading(true);
    try {
      const effectiveFilters: CatalogFilterState = {
        ...filters,
        onlyFavorites: section === 'favorites' ? true : filters.onlyFavorites,
      };
      const res = await queryFilteredCatalog(activePlaylist, {
        type: queryType,
        categoryName: selectedCategoryName,
        filters: effectiveFilters,
        onlyRecent: section === 'history',
        preferLanguage: prefs.preferredContentLanguage,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...res.items]);
      setTotalMatches(res.total);
    } finally {
      setCatalogLoading(false);
    }
  }, [
    activePlaylist,
    catalogLoading,
    items.length,
    totalMatches,
    filters,
    section,
    queryType,
    selectedCategoryName,
    prefs.preferredContentLanguage,
  ]);

  const updateFilters = useCallback((patch: Partial<CatalogFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(createDefaultFilters(prefs));
  }, [prefs]);

  const patchMediaFavorite = useCallback((mediaId: string, isFavorite: boolean) => {
    const patchList = (list: UnifiedMedia[]) =>
      list.map((m) => (m.id === mediaId ? { ...m, isFavorite } : m));
    setItems(patchList);
    setHighlights((prev) => ({
      spotlight: patchList(prev.spotlight),
      liveChannels: patchList(prev.liveChannels),
      recentMovies: patchList(prev.recentMovies),
      recentSeries: patchList(prev.recentSeries),
      favorites: isFavorite ? prev.favorites : prev.favorites.filter((m) => m.id !== mediaId),
      continueWatching: patchList(prev.continueWatching),
    }));
  }, []);

  return {
    categories,
    highlights,
    selectedCategory,
    setSelectedCategory,
    filters,
    updateFilters,
    resetFilters,
    items,
    totalMatches,
    availableYears,
    queryTookMs,
    catalogLoading,
    loadMore,
    epgByChannel,
    patchMediaFavorite,
    reloadOverview,
  };
}
