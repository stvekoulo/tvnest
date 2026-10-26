// Hook de requêtage réactif SQLite / M3U avec filtres multicritères, pagination et EPG.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCatalogFilters } from './use-catalog-filters';
import { loadSectionRails } from './use-section-rails';
import {
  buildPageRequest,
  CATALOG_PAGE_FRESH_MS,
  CATALOG_PAGE_SIZE,
  clearCachedPages,
  type CatalogPage,
  pageKey,
  prefetchPage,
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
import { isSameWatchItem } from '@/lib/resume-point';
import {
  fetchCurrentEpgForChannels,
  WATCH_PROGRESS_EVENT,
  type WatchProgressDetail,
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

  // Charge les catégories comptées et les sélections Accueil dès que la playlist change.
  // Les groupes suivent la langue du filtre (celle des Paramètres quand le filtre auto est actif).
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
  }, [activePlaylist, languageFilter, onError]);

  const reloadOverview = useCallback(async () => {
    if (!activePlaylist) {
      setHighlights(EMPTY_HIGHLIGHTS);
      return;
    }
    try {
      const dash = await fetchDashboardHighlights(activePlaylist, prefs.preferredContentLanguage);
      setHighlights(dash);

      const epgIds = dash.liveChannels.map((c) => c.tvgId).filter((x): x is string => Boolean(x));
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

  // Préchargement, une fois l'Accueil affiché : première page et rangées de Live TV, Films
  // et Séries, pour qu'aller d'une rubrique à l'autre soit immédiat dès la première fois.
  useEffect(() => {
    if (!activePlaylist || categories.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      for (const sec of ['live', 'movies', 'series'] as const) {
        if (cancelled) return;
        const filters = filtersForRef.current(sec);
        const type = sectionQueryType(sec) as 'live' | 'movie' | 'series';
        await prefetchPage(activePlaylist, buildPageRequest(sec, filters, null, prefs.preferredContentLanguage)).catch(() => {});
        if (cancelled) return;
        await loadSectionRails(activePlaylist, type, categories.filter((c) => c.type === type), filters).catch(() => []);
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activePlaylist, categories, prefs.preferredContentLanguage]);

  // « En cours » en temps réel : chaque sauvegarde de progression remonte le média en tête
  // avec sa nouvelle barre ; un média absent de l'historique recharge l'Accueil.
  useEffect(() => {
    let reloadTimer: number | undefined;
    const onProgress = (e: Event) => {
      const { item, positionSeconds, durationSeconds } = (e as CustomEvent<WatchProgressDetail>).detail;
      const patch = (r: UnifiedMedia) =>
        isSameWatchItem(r, item) ? { ...r, progressSeconds: positionSeconds, durationSeconds } : r;
      setItems((prev) => (prev.some((r) => isSameWatchItem(r, item)) ? prev.map(patch) : prev));
      setHighlights((prev) => {
        const row = prev.continueWatching.find((r) => isSameWatchItem(r, item));
        if (!row) {
          window.clearTimeout(reloadTimer);
          reloadTimer = window.setTimeout(() => void reloadOverview(), 1500);
          return prev;
        }
        const updated = { ...row, progressSeconds: positionSeconds, durationSeconds };
        return { ...prev, continueWatching: [updated, ...prev.continueWatching.filter((r) => r !== row)] };
      });
    };
    window.addEventListener(WATCH_PROGRESS_EVENT, onProgress);
    return () => {
      window.removeEventListener(WATCH_PROGRESS_EVENT, onProgress);
      window.clearTimeout(reloadTimer);
    };
  }, [reloadOverview]);

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

  // Première page de la rubrique. Déjà vue (ou préchargée) : affichée tout de suite, puis
  // rafraîchie en arrière-plan si elle date. Sinon : requête après un court anti-rebond.
  // Effet de mise en page : la page gardée remplace l'ancienne avant le premier affichage.
  useLayoutEffect(() => {
    // La page Recherche interroge elle-même toutes les sources.
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
    // L'historique change à chaque lecture : toujours rafraîchi.
    if (cached && section !== 'history' && Date.now() - cached.at < CATALOG_PAGE_FRESH_MS) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!cached) setCatalogLoading(true);
      try {
        const res = await queryFilteredCatalog(activePlaylist, request);
        // Historique : chaque ligne porte sa barre de progression.
        const listed = section === 'history' ? await withSavedProgress(activePlaylist.id, res.items) : res.items;
        if (cancelled) return;
        const page = { items: listed, total: res.total, years: res.years, tookMs: res.tookMs };
        storeCachedPage(key, page);
        apply(page);

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
    prefs.preferredContentLanguage,
    onError,
  ]);

  const loadMore = useCallback(async () => {
    if (!activePlaylist || catalogLoading || items.length >= totalMatches) return;
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
    scopedFilters,
    section,
    queryType,
    selectedCategoryName,
    prefs.preferredContentLanguage,
  ]);

  const patchMediaFavorite = useCallback((mediaId: string, isFavorite: boolean) => {
    clearCachedPages();
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

  // Liste d'une autre rubrique encore en état : la page gardée de la rubrique affichée la
  // remplace dès ce rendu (jamais un instant de Séries sous le titre Films).
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
    reloadOverview,
  };
}
