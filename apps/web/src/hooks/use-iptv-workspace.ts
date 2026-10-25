// Hook principal d'orchestration TVNest (sources, recherche SQLite, lecteur et fiche dédiée).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCatalogQuery } from '@/hooks/use-catalog-query';
import { usePlaylistActions } from '@/hooks/use-playlist-actions';
import {
  fetchSavedPlaylists,
  isElectronRuntime,
} from '@/services/ipc-playlists.service';
import {
  fetchXtreamMovieDetail,
  fetchXtreamSeriesDetail,
  toggleMediaFavoriteInDb,
} from '@/services/ipc-series.service';
import {
  getDownloadsAndRecordings,
  launchExternalPlayer,
  loadPreferences,
  savePreferences,
  startVodDownload,
} from '@/services/ipc-system.service';
import type {
  AppPreferences,
  AppSection,
  ElectronDownloadItem,
  ElectronRecordingItem,
  SeriesDetail,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

export function useIptvWorkspace() {
  const [section, setSectionState] = useState<AppSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [playlists, setPlaylists] = useState<UnifiedPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [activeMedia, setActiveMedia] = useState<UnifiedMedia | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [theaterOpen, setTheaterOpen] = useState<boolean>(false);
  const [addSourceOpen, setAddSourceOpen] = useState<boolean>(false);

  // État de la page dédiée Film / Série (remplace l'ancien modal).
  const [detailMedia, setDetailMedia] = useState<UnifiedMedia | null>(null);
  const [seriesDetail, setSeriesDetail] = useState<SeriesDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const [downloads, setDownloads] = useState<ElectronDownloadItem[]>([]);
  const [recordings, setRecordings] = useState<ElectronRecordingItem[]>([]);
  const [prefs, setPrefs] = useState<AppPreferences>(() => loadPreferences());

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const setSection = useCallback((next: AppSection) => {
    setDetailMedia(null);
    setSeriesDetail(null);
    setSectionState(next);
  }, []);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) || playlists[0] || null,
    [playlists, activePlaylistId]
  );

  const catalog = useCatalogQuery(activePlaylist, section, prefs, notify);

  const refreshPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchSavedPlaylists();
      setPlaylists(list);
      if (list.length > 0 && !activePlaylistId) setActivePlaylistId(list[0].id);
    } finally {
      setLoading(false);
    }
  }, [activePlaylistId]);

  useEffect(() => {
    void refreshPlaylists();
    if (!isElectronRuntime()) return;

    window.electron.onEpgProgress?.((prog) => {
      setSyncLabel(prog.status === 'loading' ? `EPG : ${prog.url}` : null);
    });
    const unsubDl = window.electron.onDownloadsUpdate?.(() => {
      getDownloadsAndRecordings().then((res) => {
        setDownloads(res.downloads);
        setRecordings(res.recordings);
      });
    });
    const unsubBack = window.electron.onWindowBackRequested?.(() => {
      setTheaterOpen((open) => {
        if (open) return false;
        setDetailMedia(null);
        setSeriesDetail(null);
        return false;
      });
    });
    return () => {
      unsubDl?.();
      unsubBack?.();
    };
  }, [refreshPlaylists]);

  useEffect(() => {
    if (section === 'downloads') {
      getDownloadsAndRecordings().then((res) => {
        setDownloads(res.downloads);
        setRecordings(res.recordings);
      });
    }
  }, [section]);

  // Ouvre la page complète dédiée d'un film ou d'une série avec métadonnées serveur.
  const openMediaDetail = useCallback(
    async (item: UnifiedMedia) => {
      setDetailMedia(item);
      setSeriesDetail(null);
      if (!activePlaylist || activePlaylist.kind !== 'xtream') return;

      setDetailLoading(true);
      try {
        if (item.kind === 'series') {
          const detail = await fetchXtreamSeriesDetail(activePlaylist, item);
          setSeriesDetail(detail);
          setDetailMedia(detail.series);
        } else if (item.kind === 'movie') {
          const enriched = await fetchXtreamMovieDetail(activePlaylist, item);
          setDetailMedia(enriched);
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [activePlaylist]
  );

  const closeMediaDetail = useCallback(() => {
    setDetailMedia(null);
    setSeriesDetail(null);
  }, []);

  const playStream = useCallback(
    async (item: UnifiedMedia, expandTheater = false) => {
      if (item.kind === 'series') {
        await openMediaDetail(item);
        return;
      }
      if (prefs.defaultPlayer !== 'builtin' && isElectronRuntime()) {
        await launchExternalPlayer(prefs.defaultPlayer, item, activePlaylist);
        notify(`Ouvert dans ${prefs.defaultPlayer.toUpperCase()}`);
        return;
      }
      setActiveMedia(item);
      setIsPlaying(true);
      if (expandTheater) setTheaterOpen(true);
    },
    [activePlaylist, prefs.defaultPlayer, notify, openMediaDetail]
  );

  const toggleFavorite = useCallback(
    async (item: UnifiedMedia) => {
      const next = await toggleMediaFavoriteInDb(item);
      catalog.patchMediaFavorite(item.id, next);
      setActiveMedia((curr) => (curr?.id === item.id ? { ...curr, isFavorite: next } : curr));
      setDetailMedia((curr) => (curr?.id === item.id ? { ...curr, isFavorite: next } : curr));
      void catalog.reloadOverview();
    },
    [catalog]
  );

  const { addSource, deletePlaylist } = usePlaylistActions({
    activePlaylistId,
    setActivePlaylistId,
    setPlaylists,
    setSyncLabel,
    notify,
  });

  const updatePrefs = useCallback(
    async (patch: Partial<AppPreferences>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await savePreferences(next);
      notify('Préférences enregistrées');
    },
    [prefs, notify]
  );

  const downloadMedia = useCallback(
    async (item: UnifiedMedia) => {
      await startVodDownload(item);
      notify(`Téléchargement lancé : ${item.title}`);
    },
    [notify]
  );

  return {
    isElectron: isElectronRuntime(),
    section,
    setSection,
    sidebarCollapsed,
    setSidebarCollapsed,
    playlists,
    activePlaylist,
    setActivePlaylistId: (id: string | null) => {
      setDetailMedia(null);
      setActivePlaylistId(id);
    },
    refreshPlaylists,
    categories: catalog.categories,
    highlights: catalog.highlights,
    items: catalog.items,
    totalMatches: catalog.totalMatches,
    availableYears: catalog.availableYears,
    queryTookMs: catalog.queryTookMs,
    selectedCategory: catalog.selectedCategory,
    setSelectedCategory: catalog.setSelectedCategory,
    filters: catalog.filters,
    updateFilters: catalog.updateFilters,
    resetFilters: catalog.resetFilters,
    loadMore: catalog.loadMore,
    loading: loading || catalog.catalogLoading,
    syncLabel,
    setSyncLabel,
    toast,
    notify,
    activeMedia,
    isPlaying,
    setIsPlaying,
    theaterOpen,
    setTheaterOpen,
    addSourceOpen,
    setAddSourceOpen,
    detailMedia,
    seriesDetail,
    detailLoading,
    openMediaDetail,
    closeMediaDetail,
    epgByChannel: catalog.epgByChannel,
    downloads,
    recordings,
    prefs,
    updatePrefs,
    playStream,
    toggleFavorite,
    addSource,
    deletePlaylist,
    downloadMedia,
    refreshDownloads: () =>
      getDownloadsAndRecordings().then((r) => {
        setDownloads(r.downloads);
        setRecordings(r.recordings);
      }),
  };
}
