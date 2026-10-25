// Hook principal d'orchestration TVNest (sources, recherche SQLite, lecteur et fiche dédiée).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCatalogQuery } from '@/hooks/use-catalog-query';
import { usePlaylistActions } from '@/hooks/use-playlist-actions';
import { forgetSessionPosition, getSessionPosition } from '@/hooks/use-tvnest-player';
import { shouldOfferResume } from '@/lib/resume-point';
import { listEpisodeMedia, nextEpisodeIn } from '@/lib/series-episodes';
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
  fetchSavedPlaybackPosition,
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

export interface ResumePrompt {
  item: UnifiedMedia;
  expand: boolean;
  positionSeconds: number;
  durationSeconds?: number;
}

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

  // Source d'un média : un résultat de la recherche globale peut venir d'une autre source
  // que la source active (identifiants Xtream, user-agent…).
  const playlistOf = useCallback(
    (item: UnifiedMedia | null | undefined) =>
      (item && playlists.find((p) => p.id === item.playlistId)) || activePlaylist,
    [playlists, activePlaylist]
  );

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
  // Fiche ouverte en dernier : une réponse plus lente d'une fiche précédente est ignorée.
  const detailRequestRef = useRef(0);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  const closeMediaDetail = useCallback(() => {
    detailRequestRef.current += 1;
    setDetailMedia(null);
    setSeriesDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  }, []);

  // Lecteur externe (MPV / VLC). Le lecteur intégré est arrêté avant : beaucoup de comptes
  // IPTV n'autorisent qu'une connexion à la fois, et le serveur refuserait celle de MPV.
  // `positionSeconds` : position atteinte dans le lecteur intégré, reprise par MPV / VLC.
  const openExternal = useCallback(
    async (player: 'mpv' | 'vlc', item: UnifiedMedia, positionSeconds?: number) => {
      setTheaterOpen(false);
      setIsPlaying(false);
      setActiveMedia(null);
      const target =
        positionSeconds && positionSeconds > 5 && item.kind !== 'live'
          ? { ...item, progressSeconds: positionSeconds }
          : item;
      const label = player.toUpperCase();
      // Venu du lecteur intégré : laisser le serveur libérer la connexion qu'il vient de fermer.
      // ponytail: délai fixe ; à remplacer par l'attente de fin de session si 600 ms ne suffisent pas.
      if (positionSeconds !== undefined) await new Promise((r) => setTimeout(r, 600));
      try {
        const session = await launchExternalPlayer(player, target, playlistOf(item));
        notify(
          session.status === 'error'
            ? `${label} n'a pas pu lire le flux : ${session.error ?? 'erreur inconnue'}`
            : `Ouvert dans ${label}`
        );
      } catch (err) {
        notify(`${label} : ${(err as Error).message}`);
      }
    },
    [playlistOf, notify]
  );

  const [resumePrompt, setResumePrompt] = useState<ResumePrompt | null>(null);

  // File d'épisodes de la série en cours : source de l'« Épisode suivant » automatique.
  const [episodeQueue, setEpisodeQueue] = useState<UnifiedMedia[]>([]);

  const startPlayback = useCallback(
    (item: UnifiedMedia, expandTheater: boolean) => {
      if (item.kind === 'episode') {
        const queue = seriesDetail ? listEpisodeMedia(seriesDetail) : [];
        setEpisodeQueue(queue.some((ep) => ep.id === item.id) ? queue : []);
      } else {
        setEpisodeQueue([]);
      }
      setActiveMedia(item);
      setIsPlaying(true);
      if (expandTheater) setTheaterOpen(true);
    },
    [seriesDetail]
  );

  const nextEpisode = useMemo(
    () => (activeMedia?.kind === 'episode' ? nextEpisodeIn(episodeQueue, activeMedia.id) : null),
    [episodeQueue, activeMedia]
  );

  // Enchaîne l'épisode suivant depuis le début, dans la même vue (Cinéma reste ouvert).
  const playNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    forgetSessionPosition(nextEpisode.id);
    setActiveMedia({ ...nextEpisode, progressSeconds: 0 });
    setIsPlaying(true);
  }, [nextEpisode]);

  const playStream = useCallback(
    async (item: UnifiedMedia, expandTheater = false) => {
      if (item.kind === 'series') {
        await openMediaDetail(item);
        return;
      }
      if (prefs.defaultPlayer !== 'builtin' && isElectronRuntime()) {
        await openExternal(prefs.defaultPlayer, item);
        return;
      }
      // Film ou épisode déjà entamé : on propose « Reprendre » ou « Recommencer ».
      if (item.kind === 'movie' || item.kind === 'episode') {
        const saved = await fetchSavedPlaybackPosition(item);
        const position = getSessionPosition(item.id) ?? saved?.positionSeconds ?? item.progressSeconds ?? 0;
        const duration = saved?.durationSeconds ?? item.durationSeconds;
        if (shouldOfferResume(position, duration)) {
          setResumePrompt({ item, expand: expandTheater, positionSeconds: position, durationSeconds: duration });
          return;
        }
      }
      startPlayback(item, expandTheater);
    },
    [prefs.defaultPlayer, openExternal, openMediaDetail, startPlayback]
  );

  // Lecture à une position choisie (Reprendre / Recommencer), sans redemander.
  const playAt = useCallback(
    async (item: UnifiedMedia, positionSeconds: number, expandTheater = false) => {
      if (positionSeconds <= 0) forgetSessionPosition(item.id);
      if (prefs.defaultPlayer !== 'builtin' && isElectronRuntime()) {
        await openExternal(prefs.defaultPlayer, item, positionSeconds || undefined);
        return;
      }
      startPlayback({ ...item, progressSeconds: positionSeconds }, expandTheater);
    },
    [prefs.defaultPlayer, openExternal, startPlayback]
  );

  const answerResumePrompt = useCallback(
    (choice: 'resume' | 'restart' | 'cancel') => {
      const prompt = resumePrompt;
      setResumePrompt(null);
      if (!prompt || choice === 'cancel') return;
      void playAt(prompt.item, choice === 'restart' ? 0 : prompt.positionSeconds, prompt.expand);
    },
    [resumePrompt, playAt]
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
    playlistOf,
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
    openExternal,
    resumePrompt,
    playAt,
    answerResumePrompt,
    nextEpisode,
    playNextEpisode,
    stopPlayback: () => {
      setTheaterOpen(false);
      setIsPlaying(false);
      setActiveMedia(null);
    },
    theaterOpen,
    setTheaterOpen,
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
