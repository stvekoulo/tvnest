// Hook principal du lecteur TVNest Cinema (session libmpv embarquée + fallback Web).
import type Hls from 'hls.js';
import type mpegts from 'mpegts.js';
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  EmbeddedMpvAudioTrack,
  EmbeddedMpvStreamStats,
  EmbeddedMpvSubtitleTrack,
} from '@iptvnator/shared/interfaces';
import {
  probeEmbeddedMpvSupport,
  resolveMediaPlayback,
} from '@/services/ipc-playback.service';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import { flushMediaWatchProgress, recordMediaWatchProgress } from '@/services/ipc-system.service';
import type { UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';
import { useDomOverlayActive, useMpvBoundsSync } from './use-tvnest-mpv-bounds';
import { toMpvVolume, useTvNestPlayerControls } from './use-tvnest-mpv-controls';
import { useTvNestMpvSession } from './use-tvnest-mpv-session';
import { destroyWebEngines, startWebMediaEngine } from './use-tvnest-web-engine';

export type PlayerEngineKind = 'libmpv' | 'hls' | 'mpegts' | 'html5';

const livePositions = new Map<string, number>();
const RESUME_END_MARGIN_S = 10;

export function describeMpvError(raw: string): string {
  const text = raw.toLowerCase();
  if (/loading failed|failed to open|http error|connection|timed out|network|403|404|5\d\d/.test(text)) {
    return 'Le flux ne répond pas : le serveur IPTV refuse la connexion, est saturé ou la chaîne est hors ligne. Réessayez dans un instant.';
  }
  if (/unrecognized file format|no video|codec|decod/.test(text)) {
    return 'Format de flux non pris en charge par le lecteur intégré. Essayez MPV ou VLC.';
  }
  return raw;
}

export function getSessionPosition(mediaId: string): number | undefined {
  return livePositions.get(mediaId);
}

export function forgetSessionPosition(mediaId: string): void {
  livePositions.delete(mediaId);
}

export interface UseTvNestPlayerOptions {
  media: UnifiedMedia;
  playlist?: UnifiedPlaylist | null;
  playing: boolean;
  onPlayingChange: (next: boolean) => void;
  hostRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  preferWebEngine?: boolean;
  avoidNativeView?: boolean;
  initialMuted?: boolean;
}

export function useTvNestPlayer({
  media,
  playlist,
  playing,
  onPlayingChange,
  hostRef,
  videoRef,
  preferWebEngine = false,
  avoidNativeView = false,
  initialMuted = false,
}: UseTvNestPlayerOptions) {
  const [engine, setEngine] = useState<PlayerEngineKind>('html5');
  const [mpvMode, setMpvMode] = useState<'frame-copy' | 'native' | null>(null);
  const [mpvAvailable, setMpvAvailable] = useState(false);
  const [forcedWeb, setForcedWeb] = useState(preferWebEngine);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(() =>
    media.progressSeconds === 0
      ? 0
      : (livePositions.get(media.id) ?? media.progressSeconds ?? 0)
  );
  const [duration, setDuration] = useState(media.durationSeconds || 0);
  const [positionOf, setPositionOf] = useState(media.id);
  if (positionOf !== media.id) {
    setPositionOf(media.id);
    if (media.progressSeconds === 0) livePositions.delete(media.id);
    setPosition(
      media.progressSeconds === 0
        ? 0
        : (livePositions.get(media.id) ?? media.progressSeconds ?? 0)
    );
    setDuration(media.durationSeconds || 0);
  }

  useEffect(() => {
    setForcedWeb(preferWebEngine);
  }, [preferWebEngine]);

  useEffect(() => {
    recordMediaWatchProgress(media, position, duration);
  }, [media.id, position, duration]);
  useEffect(() => {
    if (!playing) flushMediaWatchProgress(media.id);
  }, [playing, media.id]);
  useEffect(() => () => flushMediaWatchProgress(media.id, true), [media.id]);

  useEffect(() => {
    if (media.kind === 'live' || position <= 0) return;
    if (duration > 0 && position > duration - RESUME_END_MARGIN_S) livePositions.delete(media.id);
    else livePositions.set(media.id, position);
  }, [media.id, media.kind, position, duration]);

  const [volume, setVolumeState] = useState(initialMuted ? 0 : 90);
  const [muted, setMuted] = useState(initialMuted);
  const [speed, setSpeedState] = useState(1);
  const [aspect, setAspectState] = useState('auto');
  const [audioTracks, setAudioTracks] = useState<EmbeddedMpvAudioTrack[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<number | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<EmbeddedMpvSubtitleTrack[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | null>(null);
  const [stats, setStats] = useState<EmbeddedMpvStreamStats | undefined>();
  const [resolution, setResolution] = useState<string | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setRetryToken((t) => t + 1);
  }, []);

  const sessionIdRef = useRef<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tsRef = useRef<mpegts.Player | null>(null);
  const mpvModeRef = useRef<'frame-copy' | 'native' | null>(null);
  const pendingSeekRef = useRef<{ target: number; startedAt: number }>({
    target: 0,
    startedAt: 0,
  });

  const overlayActive = useDomOverlayActive(engine === 'libmpv' && mpvMode === 'native');
  const { measureBounds, startBoundsTracking } = useMpvBoundsSync({
    hostRef,
    sessionIdRef,
    mpvModeRef,
    overlayActive,
    hasError: error !== null,
  });

  useTvNestMpvSession({
    media,
    playlist,
    playing,
    onPlayingChange,
    forcedWeb,
    avoidNativeView,
    retryToken,
    volume,
    muted,
    videoRef,
    sessionIdRef,
    hlsRef,
    tsRef,
    mpvModeRef,
    pendingSeekRef,
    livePositions,
    measureBounds,
    startBoundsTracking,
    describeMpvError,
    toMpvVolume,
    resolveMediaPlayback,
    probeEmbeddedMpvSupport,
    startWebMediaEngine,
    destroyWebEngines,
    setEngine,
    setMpvMode,
    setMpvAvailable,
    setBuffering,
    setError,
    setPosition,
    setDuration,
    setAudioTracks,
    setSelectedAudioId,
    setSubtitleTracks,
    setSelectedSubtitleId,
    setSpeedState,
    setAspectState,
    setStats,
    setRecordingActive,
    setReconnectAttempt,
    setResolution,
  });

  useEffect(() => {
    const sid = sessionIdRef.current;
    if (sid && isElectronRuntime()) {
      window.electron.setEmbeddedMpvPaused(sid, !playing).catch(() => {});
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (playing && v.paused) v.play().catch(() => {});
    else if (!playing && !v.paused) v.pause();
  }, [playing, videoRef]);

  const controls = useTvNestPlayerControls({
    sessionIdRef,
    hlsRef,
    videoRef,
    position,
    volume,
    muted,
    recordingActive,
    mediaTitle: media.title,
    setPosition,
    setVolumeState,
    setMuted,
    setSelectedAudioId,
    setSelectedSubtitleId,
    setSpeedState,
    setAspectState,
  });

  return {
    engine,
    mpvMode,
    mpvAvailable,
    forcedWeb,
    setForcedWeb,
    buffering,
    setBuffering,
    error,
    setError,
    position,
    setPosition,
    duration,
    setDuration,
    volume,
    muted,
    speed,
    aspect,
    audioTracks,
    selectedAudioId,
    subtitleTracks,
    selectedSubtitleId,
    stats,
    resolution,
    setResolution,
    recordingActive,
    reconnectAttempt,
    retry,
    ...controls,
  };
}
