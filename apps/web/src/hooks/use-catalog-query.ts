// Hook de requêtage réactif SQLite / M3U avec filtres multicritères, pagination et EPG.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCatalogFilters } from './use-catalog-filters';
import { useCatalogPrefetchAndProgress } from './use-catalog-prefetch';
import { clearCachedRails } from './use-section-rails';
import {
  buildPageRequest,
  CATALOG_PAGE_FRESH_MS,
  CATALOG_PAGE_SIZE,
  clearCachedPages,
  type CatalogPage,
  pageKey,
  readCachedPage,
  sectionQueryType,
  storeCachedPage,
} from '@/services/catalog-page-cache';
import {
  fetchCategoriesWithCounts,
  fetchDashboardHighlights,
  queryFilteredCatalog,
  withSavedProgress,
} from '@/services/ipc-catalog.service';
import {
  fetchCurrentEpgForChannels,
  WATCH_PROGRESS_EVENT,
} from '@/services/ipc-system.service';
import type {
  AppPreferences,
  AppSection,
  CatalogFilterState,
  EpgProgram,
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

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

export function useCatalogQuery(
  activePlaylist: UnifiedPlaylist | null,
  section: AppSection,
  prefs: AppPreferences,
  onError: (msg: string) => void
) {
  const [categories, setCategories] = useState<UnifiedCategory[]>([]);
  const [categoriesTick, setCategoriesTick] = useState(0);
  const [highlights, setHighlights] = useState<DashboardHighlightsState>(EMPTY_HIGHLIGHTS);
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
  const {
    filters: scopedFilters,
    updateFilters,
    resetFilters,
    filtersFor,
  } = useCatalogFilters(activePlaylist?.id ?? '', section, prefs);
  const filtersForRef = useRef(filtersFor);
  filtersForRef.current = filtersFor;
  const [items, setItems] = useState<UnifiedMedia[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [queryTookMs, setQueryTookMs] = useState<number>(0);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [epgByChannel, setEpgByChannel] = useState<Record<string, EpgProgram | null>>({});
  const overviewReqRef = useRef(0);
  const loadMoreReqRef = useRef(0);

  const reloadCategories = useCallback(() => {
    setCategoriesTick((t) => t + 1);
  }, []);

  const languageFilter = scopedFilters.language;
  useEffect(() => {
    if (!activePlaylist) {
      setCategories([]);
      return;
    }
    let cancelled = false;
    fetchCategoriesWithCounts(activePlaylist, languageFilter)
      .then((cats) => !cancelled && setCategories(cats))
      .catch((err) => !cancelled && onError(`Erreur catalogue : ${(err as Error).message}`));
    return () => {
      cancelled = true;
    };
  }, [activePlaylist, languageFilter, categoriesTick, onError]);

  const reloadOverview = useCallback(async () => {
    const reqId = ++overviewReqRef.current;
    if (!activePlaylist) {
      setHighlights(EMPTY_HIGHLIGHTS);
      return;
    }
    try {
      const dash = await fetchDashboardHighlights(activePlaylist, prefs.preferredContentLanguage);
      if (reqId !== overviewReqRef.current) return;
      setHighlights(dash);

      const epgIds = dash.liveChannels
        .map((c) => c.tvgId || c.title)
        .filter((x): x is string => Boolean(x));
      if (epgIds.length > 0) {
        const map = await fetchCurrentEpgForChannels(epgIds);
        if (reqId === overviewReqRef.current) {
          setEpgByChannel((prev) => ({ ...prev, ...map }));
        }
      }
    } catch (err) {
      if (reqId === overviewReqRef.current) {
        onError(`Erreur catalogue : ${(err as Error).message}`);
      }
    }
  }, [activePlaylist, prefs.preferredContentLanguage, onError]);

  useEffect(() => {
    void reloadOverview();
  }, [reloadOverview]);

  useCatalogPrefetchAndProgress({
    activePlaylist,
    categories,
    preferredContentLanguage: prefs.preferredContentLanguage,
    filtersForRef,
    watchProgressEvent: WATCH_PROGRESS_EVENT,
    setItems,
    setHighlights,
    reloadOverview,
  });

  const queryType = sectionQueryType(section);
  const selectedCategoryName = useMemo(
    () =>
      selectedCategory === 'ALL'
        ? null
        : (() => {
            const cat = categories.find((c) => c.id === selectedCategory);
            return cat ? (cat.rawName ?? cat.name) : null;
          })(),
    [categories, selectedCategory]
  );

  const currentPageKey =
    activePlaylist && section !== 'search'
      ? pageKey(activePlaylist.id, buildPageRequest(section, scopedFilters, selectedCategoryName, prefs.preferredContentLanguage))
      : '';
  const [itemsKey, setItemsKey] = useState('');

  useLayoutEffect(() => {
    loadMoreReqRef.current += 1;
    if (!activePlaylist || section === 'search') {
      setItems([]);
      setTotalMatches(0);
      return;
    }
    const request = buildPageRequest(section, scopedFilters, selectedCategoryName, prefs.preferredContentLanguage);
    const key = pageKey(activePlaylist.id, request);
    const cached = readCachedPage(key);
    const apply = (page: CatalogPage) => {
      setItemsKey(key);
      setItems(page.items);
      setTotalMatches(page.total);
      setAvailableYears(page.years);
      setQueryTookMs(page.tookMs);
    };
    if (cached) apply(cached.page);
    if (cached && section !== 'history' && Date.now() - cached.at < CATALOG_PAGE_FRESH_MS) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!cached) setCatalogLoading(true);
      try {
        const res = await queryFilteredCatalog(activePlaylist, request);
        const listed = section === 'history' ? await withSavedProgress(activePlaylist.id, res.items) : res.items;
        if (cancelled) return;
        const page = { items: listed, total: res.total, years: res.years, tookMs: res.tookMs };
        storeCachedPage(key, page);
        apply(page);

        const liveEpgIds = res.items
          .filter((i) => i.kind === 'live')
          .slice(0, 120)
          .map((i) => i.tvgId || i.title)
          .filter(Boolean);
        if (liveEpgIds.length > 0) {
          const map = await fetchCurrentEpgForChannels(liveEpgIds);
          if (!cancelled) setEpgByChannel((prev) => ({ ...prev, ...map }));
        }
      } catch (err) {
        if (!cancelled) onError(`Erreur recherche : ${(err as Error).message}`);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }, cached ? 0 : 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    activePlaylist,
    selectedCategoryName,
    scopedFilters,
    section,
    categoriesTick,
    prefs.preferredContentLanguage,
    onError,
  ]);

  const loadMore = useCallback(async () => {
    if (!activePlaylist || catalogLoading || items.length >= totalMatches) return;
    const reqId = ++loadMoreReqRef.current;
    setCatalogLoading(true);
    try {
      const effectiveFilters: CatalogFilterState = {
        ...scopedFilters,
        onlyFavorites: section === 'favorites' ? true : scopedFilters.onlyFavorites,
      };
      const res = await queryFilteredCatalog(activePlaylist, {
        type: queryType,
        categoryName: selectedCategoryName,
        filters: effectiveFilters,
        onlyRecent: section === 'history',
        preferLanguage: prefs.preferredContentLanguage,
        limit: CATALOG_PAGE_SIZE,
        offset: items.length,
      });
      if (reqId !== loadMoreReqRef.current) return;
      setItems((prev) => [...prev, ...res.items]);
      setTotalMatches(res.total);
    } finally {
      if (reqId === loadMoreReqRef.current) setCatalogLoading(false);
    }
  }, [
    activePlaylist,
    catalogLoading,
    items.length,
    totalMatches,
    scopedFilters,
    section,
    queryType,
    selectedCategoryName,
    prefs.preferredContentLanguage,
  ]);

  const patchMediaFavorite = useCallback((mediaId: string, isFavorite: boolean) => {
    clearCachedPages();
    clearCachedRails();
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

  const cachedNow = itemsKey !== currentPageKey ? readCachedPage(currentPageKey)?.page : undefined;

  return {
    categories,
    highlights,
    selectedCategory,
    setSelectedCategory,
    filters: scopedFilters,
    updateFilters,
    resetFilters,
    items: cachedNow?.items ?? items,
    totalMatches: cachedNow?.total ?? totalMatches,
    availableYears: cachedNow?.years ?? availableYears,
    queryTookMs: cachedNow?.tookMs ?? queryTookMs,
    catalogLoading,
    loadMore,
    epgByChannel,
    patchMediaFavorite,
    reloadCategories,
    reloadOverview,
  };
}
