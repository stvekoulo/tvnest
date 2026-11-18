// Orchestration de lecture TVNest (reprise, lecteurs externes MPV/VLC, file d'épisodes).
import { useCallback, useMemo, useState } from 'react';
import { forgetSessionPosition, getSessionPosition } from '@/hooks/use-tvnest-player';
import { shouldOfferResume } from '@/lib/resume-point';
import { listEpisodeMedia, nextEpisodeIn } from '@/lib/series-episodes';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import {
  clearSavedPlaybackPosition,
  fetchSavedPlaybackPosition,
  launchExternalPlayer,
} from '@/services/ipc-system.service';
import type {
  AppPreferences,
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

interface UseIptvPlaybackParams {
  prefs: AppPreferences;
  seriesDetail: SeriesDetail | null;
  playlistOf: (item: UnifiedMedia | null | undefined) => UnifiedPlaylist | null;
  openMediaDetail: (item: UnifiedMedia) => Promise<void>;
  notify: (msg: string) => void;
}

export function useIptvPlayback({
  prefs,
  seriesDetail,
  playlistOf,
  openMediaDetail,
  notify,
}: UseIptvPlaybackParams) {
  const [activeMedia, setActiveMedia] = useState<UnifiedMedia | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [theaterOpen, setTheaterOpen] = useState<boolean>(false);
  const [resumePrompt, setResumePrompt] = useState<ResumePrompt | null>(null);
  const [episodeQueue, setEpisodeQueue] = useState<UnifiedMedia[]>([]);

  const stopPlayback = useCallback(() => {
    setTheaterOpen(false);
    setIsPlaying(false);
    setActiveMedia(null);
  }, []);

  const openExternal = useCallback(
    async (player: 'mpv' | 'vlc', item: UnifiedMedia, positionSeconds?: number) => {
      stopPlayback();
      const target =
        positionSeconds !== undefined && item.kind !== 'live'
          ? { ...item, progressSeconds: positionSeconds }
          : item;
      const label = player.toUpperCase();
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
    [stopPlayback, playlistOf, notify]
  );

  const startPlayback = useCallback(
    (item: UnifiedMedia, expandTheater: boolean) => {
      if (item.kind === 'episode') {
        const queue = seriesDetail ? listEpisodeMedia(seriesDetail) : [];
        setEpisodeQueue(queue.some((ep) => ep.id === item.id) ? queue : []);
      } else {
        setEpisodeQueue([]);
      }
      setActiveMedia(item);
      setIsPlaying(prefs.autoplay);
      if (expandTheater) setTheaterOpen(true);
    },
    [seriesDetail, prefs.autoplay]
  );

  const nextEpisode = useMemo(
    () => (activeMedia?.kind === 'episode' ? nextEpisodeIn(episodeQueue, activeMedia.id) : null),
    [episodeQueue, activeMedia]
  );

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
      if (item.kind === 'movie' || item.kind === 'episode') {
        const saved = await fetchSavedPlaybackPosition(item);
        const position =
          getSessionPosition(item.id) ?? saved?.positionSeconds ?? item.progressSeconds ?? 0;
        const duration = saved?.durationSeconds ?? item.durationSeconds;
        if (shouldOfferResume(position, duration)) {
          setResumePrompt({
            item,
            expand: expandTheater,
            positionSeconds: position,
            durationSeconds: duration,
          });
          return;
        }
      }
      if (prefs.defaultPlayer !== 'builtin' && isElectronRuntime()) {
        await openExternal(prefs.defaultPlayer, item);
        return;
      }
      startPlayback(item, expandTheater);
    },
    [prefs.defaultPlayer, openExternal, openMediaDetail, startPlayback]
  );

  const playAt = useCallback(
    async (item: UnifiedMedia, positionSeconds: number, expandTheater = false) => {
      if (positionSeconds <= 0) {
        forgetSessionPosition(item.id);
        void clearSavedPlaybackPosition(item);
      }
      if (prefs.defaultPlayer !== 'builtin' && isElectronRuntime()) {
        await openExternal(prefs.defaultPlayer, item, positionSeconds);
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

  return {
    activeMedia,
    setActiveMedia,
    isPlaying,
    setIsPlaying,
    theaterOpen,
    setTheaterOpen,
    resumePrompt,
    nextEpisode,
    stopPlayback,
    openExternal,
    playNextEpisode,
    playStream,
    playAt,
    answerResumePrompt,
  };
}
