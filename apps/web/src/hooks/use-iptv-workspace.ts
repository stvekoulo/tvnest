// Hook principal d'orchestration TVNest (sources, recherche SQLite, lecteur et fiche dédiée).
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCatalogQuery } from '@/hooks/use-catalog-query';
import { type ResumePrompt, useIptvPlayback } from '@/hooks/use-iptv-playback';
import { usePlaylistActions } from '@/hooks/use-playlist-actions';
import { clearCachedRails } from '@/hooks/use-section-rails';
import { useWorkspaceIpcEvents } from '@/hooks/use-workspace-ipc-events';
import { clearCachedPages } from '@/services/catalog-page-cache';
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
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

export type { ResumePrompt };

export function useIptvWorkspace() {
  const [section, setSectionState] = useState<AppSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [playlists, setPlaylists] = useState<UnifiedPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addSourceOpen, setAddSourceOpen] = useState<boolean>(false);

  const [detailMedia, setDetailMedia] = useState<UnifiedMedia | null>(null);
  const [seriesDetail, setSeriesDetail] = useState<SeriesDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [downloads, setDownloads] = useState<ElectronDownloadItem[]>([]);
  const [recordings, setRecordings] = useState<ElectronRecordingItem[]>([]);
  const [prefs, setPrefs] = useState<AppPreferences>(() => loadPreferences());

  const toastTimerRef = useRef<number | undefined>(undefined);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const detailRequestRef = useRef(0);
  const closeMediaDetail = useCallback(() => {
    detailRequestRef.current += 1;
    setDetailMedia(null);
    setSeriesDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  }, []);

  const setSection = useCallback(
    (next: AppSection) => {
      closeMediaDetail();
      startTransition(() => setSectionState(next));
    },
    [closeMediaDetail]
  );

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) || playlists[0] || null,
    [playlists, activePlaylistId]
  );

  const catalog = useCatalogQuery(activePlaylist, section, prefs, notify);

  const playlistOf = useCallback(
    (item: UnifiedMedia | null | undefined) =>
      (item && playlists.find((p) => p.id === item.playlistId)) || activePlaylist,
    [playlists, activePlaylist]
  );

  const openMediaDetail = useCallback(
    async (item: UnifiedMedia) => {
      const request = ++detailRequestRef.current;
      setDetailMedia(item);
      setSeriesDetail(null);
      setDetailError(null);
      const source = playlistOf(item);
      if (!source || source.kind !== 'xtream') {
        setDetailLoading(false);
        return;
      }

      setDetailLoading(true);
      try {
        if (item.kind === 'series') {
          const detail = await fetchXtreamSeriesDetail(source, item);
          if (request !== detailRequestRef.current) return;
          setSeriesDetail(detail);
          setDetailMedia(detail.series);
        } else if (item.kind === 'movie') {
          const enriched = await fetchXtreamMovieDetail(source, item);
          if (request !== detailRequestRef.current) return;
          setDetailMedia(enriched);
        }
      } catch (err) {
        if (request === detailRequestRef.current) setDetailError((err as Error).message);
      } finally {
        if (request === detailRequestRef.current) setDetailLoading(false);
      }
    },
    [playlistOf]
  );

  const playback = useIptvPlayback({
    prefs,
    seriesDetail,
    playlistOf,
    openMediaDetail,
    notify,
  });

  const theaterOpenRef = useRef(playback.theaterOpen);
  theaterOpenRef.current = playback.theaterOpen;
  const prevActiveMediaRef = useRef<UnifiedMedia | null>(null);

  useEffect(() => {
    const prev = prevActiveMediaRef.current;
    prevActiveMediaRef.current = playback.activeMedia;
    if (prev?.kind === 'episode' && !playback.activeMedia && detailMedia?.kind === 'series') {
      const source = playlistOf(detailMedia);
      if (source?.kind === 'xtream') {
        void fetchXtreamSeriesDetail(source, detailMedia)
          .then((detail) => setSeriesDetail(detail))
          .catch(() => {});
      }
    }
  }, [playback.activeMedia, detailMedia, playlistOf]);

  const refreshPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchSavedPlaylists();
      setPlaylists(list);
      setActivePlaylistId((curr) => curr ?? list[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDownloads = useCallback(
    () =>
      getDownloadsAndRecordings().then((r) => {
        setDownloads(r.downloads);
        setRecordings(r.recordings);
      }),
    []
  );

  useWorkspaceIpcEvents({
    parentalLockEnabled: prefs.parentalLockEnabled,
    theaterOpenRef,
    setTheaterOpen: playback.setTheaterOpen,
    closeMediaDetail,
    setSyncLabel,
    refreshPlaylists,
    refreshDownloads,
    setActivePlaylistId,
    notify,
  });

  useEffect(() => {
    if (section === 'downloads') void refreshDownloads();
  }, [section, refreshDownloads]);

  const toggleFavorite = useCallback(
    async (item: UnifiedMedia) => {
      const next = await toggleMediaFavoriteInDb(item);
      catalog.patchMediaFavorite(item.id, next);
      playback.setActiveMedia((curr) => (curr?.id === item.id ? { ...curr, isFavorite: next } : curr));
      setDetailMedia((curr) => (curr?.id === item.id ? { ...curr, isFavorite: next } : curr));
      void catalog.reloadOverview();
    },
    [catalog, playback]
  );

  const { addSource, refreshSource, deletePlaylist } = usePlaylistActions({
    activePlaylistId,
    setActivePlaylistId,
    setPlaylists,
    setSyncLabel,
    notify,
    onCatalogInvalidated: () => {
      catalog.reloadCategories();
      void catalog.reloadOverview();
    },
    onPlaylistDeleted: (id) => {
      if (playback.activeMedia?.playlistId === id) playback.stopPlayback();
      if (detailMedia?.playlistId === id) closeMediaDetail();
    },
  });

  const updatePrefs = useCallback(
    async (patch: Partial<AppPreferences>) => {
      const next = { ...prefs, ...patch };
      const parentalChanged =
        patch.parentalLockEnabled !== undefined &&
        patch.parentalLockEnabled !== prefs.parentalLockEnabled;
      setPrefs(next);
      await savePreferences(next);
      if (parentalChanged) {
        clearCachedPages();
        clearCachedRails();
        catalog.reloadCategories();
        void catalog.reloadOverview();
      }
      notify('Préférences enregistrées');
    },
    [prefs, catalog, notify]
  );

  const toggleCategoryLock = useCallback(
    async (cat: UnifiedCategory) => {
      if (!isElectronRuntime() || !cat.dbId || !window.electron.dbSetCategoryLocked) return;
      const nextLocked = !cat.locked;
      await window.electron.dbSetCategoryLocked(cat.dbId, nextLocked);
      clearCachedPages();
      clearCachedRails();
      catalog.reloadCategories();
      void catalog.reloadOverview();
      notify(nextLocked ? `Groupe « ${cat.name} » verrouillé` : `Groupe « ${cat.name} » déverrouillé`);
    },
    [catalog, notify]
  );

  const downloadMedia = useCallback(
    async (item: UnifiedMedia) => {
      try {
        await startVodDownload(item, playlistOf(item));
        notify(`Téléchargement lancé : ${item.title}`);
      } catch (err) {
        notify(`Téléchargement impossible : ${(err as Error).message}`);
      }
    },
    [playlistOf, notify]
  );

  return {
    isElectron: isElectronRuntime(),
    section,
    setSection,
    sidebarCollapsed,
    setSidebarCollapsed,
    playlists,
    activePlaylist,
    playlistOf,
    setActivePlaylistId: (id: string | null) => {
      closeMediaDetail();
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
    activeMedia: playback.activeMedia,
    isPlaying: playback.isPlaying,
    setIsPlaying: playback.setIsPlaying,
    openExternal: playback.openExternal,
    resumePrompt: playback.resumePrompt,
    playAt: playback.playAt,
    answerResumePrompt: playback.answerResumePrompt,
    nextEpisode: playback.nextEpisode,
    playNextEpisode: playback.playNextEpisode,
    stopPlayback: playback.stopPlayback,
    theaterOpen: playback.theaterOpen,
    setTheaterOpen: playback.setTheaterOpen,
    addSourceOpen,
    setAddSourceOpen,
    detailMedia,
    seriesDetail,
    detailLoading,
    openMediaDetail,
    closeMediaDetail,
    detailError,
    epgByChannel: catalog.epgByChannel,
    downloads,
    recordings,
    prefs,
    updatePrefs,
    toggleCategoryLock,
    playStream: playback.playStream,
    toggleFavorite,
    addSource,
    refreshSource,
    deletePlaylist,
    downloadMedia,
    refreshDownloads,
  };
}
