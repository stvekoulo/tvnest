// Cycle de vie d'une session de lecture TVNest (création libmpv embarquée ou bascule moteur Web).
import type Hls from 'hls.js';
import type mpegts from 'mpegts.js';
import { type MutableRefObject, type RefObject, useEffect } from 'react';
import type {
  EmbeddedMpvAudioTrack,
  EmbeddedMpvSession,
  EmbeddedMpvStreamStats,
  EmbeddedMpvSubtitleTrack,
  EmbeddedMpvSupport,
  ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';
import type { Bounds } from './use-tvnest-mpv-bounds';
import type { PlayerEngineKind } from './use-tvnest-player';

interface UseTvNestMpvSessionParams {
  media: UnifiedMedia;
  playlist?: UnifiedPlaylist | null;
  playing: boolean;
  onPlayingChange: (v: boolean) => void;
  forcedWeb: boolean;
  avoidNativeView: boolean;
  retryToken: number;
  volume: number;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  sessionIdRef: MutableRefObject<string | null>;
  hlsRef: MutableRefObject<Hls | null>;
  tsRef: MutableRefObject<mpegts.Player | null>;
  mpvModeRef: MutableRefObject<'frame-copy' | 'native' | null>;
  pendingSeekRef: MutableRefObject<{ target: number; startedAt: number }>;
  livePositions: Map<string, number>;
  measureBounds: () => Bounds | null;
  startBoundsTracking: () => () => void;
  describeMpvError: (raw: string) => string;
  toMpvVolume: (v: number) => number;
  resolveMediaPlayback: (item: UnifiedMedia, pl?: UnifiedPlaylist | null) => Promise<ResolvedPortalPlayback>;
  probeEmbeddedMpvSupport: () => Promise<EmbeddedMpvSupport>;
  startWebMediaEngine: (params: {
    isCancelled: () => boolean;
    resolved: ResolvedPortalPlayback;
    video: HTMLVideoElement;
    playing: boolean;
    onPlayingChange: (v: boolean) => void;
    hlsRef: MutableRefObject<Hls | null>;
    tsRef: MutableRefObject<mpegts.Player | null>;
    setEngine: (e: PlayerEngineKind) => void;
    setAudioTracks: (t: EmbeddedMpvAudioTrack[]) => void;
    setSelectedAudioId: (id: number | null) => void;
    setBuffering: (b: boolean) => void;
    setError: (err: string | null) => void;
  }) => Promise<void>;
  destroyWebEngines: (h: MutableRefObject<Hls | null>, t: MutableRefObject<mpegts.Player | null>) => void;
  setEngine: (e: PlayerEngineKind) => void;
  setMpvMode: (m: 'frame-copy' | 'native' | null) => void;
  setMpvAvailable: (b: boolean) => void;
  setBuffering: (b: boolean) => void;
  setError: (e: string | null) => void;
  setPosition: (p: number) => void;
  setDuration: (d: number) => void;
  setAudioTracks: (t: EmbeddedMpvAudioTrack[]) => void;
  setSelectedAudioId: (id: number | null) => void;
  setSubtitleTracks: (t: EmbeddedMpvSubtitleTrack[]) => void;
  setSelectedSubtitleId: (id: number | null) => void;
  setSpeedState: (s: number) => void;
  setAspectState: (a: string) => void;
  setStats: (s: EmbeddedMpvStreamStats | undefined) => void;
  setRecordingActive: (b: boolean) => void;
  setReconnectAttempt: (n: number | null) => void;
  setResolution: (r: string | null) => void;
}

export function useTvNestMpvSession(p: UseTvNestMpvSessionParams) {
  useEffect(() => {
    let cancelled = false;
    p.setError(null);
    p.setBuffering(true);
    p.setReconnectAttempt(null);
    if (p.media.progressSeconds === 0) p.livePositions.delete(p.media.id);
    const initialPos =
      p.media.progressSeconds === 0
        ? 0
        : (p.livePositions.get(p.media.id) ?? p.media.progressSeconds ?? 0);
    p.setPosition(initialPos);
    p.setDuration(p.media.durationSeconds || 0);

    let unsubMpv: (() => void) | undefined;
    let stopBoundsTracking: (() => void) | undefined;
    let createdSessionId: string | null = null;

    (async () => {
      const [baseResolved, support] = await Promise.all([
        p.resolveMediaPlayback(p.media, p.playlist),
        p.probeEmbeddedMpvSupport(),
      ]);
      if (cancelled) return;
      const resumeAt = p.media.progressSeconds === 0 ? 0 : p.livePositions.get(p.media.id);
      const resolved =
        resumeAt && resumeAt > 1 && !baseResolved.isLive
          ? { ...baseResolved, startTime: Math.floor(resumeAt) }
          : baseResolved;

      p.pendingSeekRef.current =
        resolved.startTime && resolved.startTime > 2
          ? { target: resolved.startTime, startedAt: Date.now() }
          : { target: 0, startedAt: 0 };

      p.setMpvAvailable(Boolean(support.supported));
      if (!resolved.streamUrl) {
        p.setBuffering(false);
        p.setError('URL de flux indisponible pour ce média.');
        return;
      }

      if (isElectronRuntime()) {
        window.electron.setPlaybackKeepAwake(true).catch(() => {});
      }

      const nativeViewAvoided = p.avoidNativeView && support.engine !== 'frame-copy';
      if (isElectronRuntime() && Boolean(support.supported) && !p.forcedWeb && !nativeViewAvoided) {
        try {
          const mode = support.engine === 'frame-copy' ? 'frame-copy' : 'native';
          p.mpvModeRef.current = mode;
          const session = await window.electron.createEmbeddedMpvSession(
            p.measureBounds() ?? { x: 0, y: 0, width: 640, height: 360 },
            resolved.title,
            p.toMpvVolume(p.muted ? 0 : p.volume)
          );
          createdSessionId = session.id;
          if (cancelled) {
            window.electron.disposeEmbeddedMpvSession(session.id).catch(() => {});
            return;
          }

          p.sessionIdRef.current = session.id;
          p.setMpvMode(mode);
          p.setEngine('libmpv');

          unsubMpv = window.electron.onEmbeddedMpvSessionUpdate?.(
            (snap: EmbeddedMpvSession) => {
              if (snap.id !== session.id || cancelled) return;
              const snapPos = snap.positionSeconds || 0;
              const pending = p.pendingSeekRef.current;
              if (pending.target > 0) {
                if (snapPos >= 2 || Date.now() - pending.startedAt > 4000) {
                  p.pendingSeekRef.current = { target: 0, startedAt: 0 };
                  p.setPosition(snapPos);
                }
              } else {
                p.setPosition(snapPos);
              }
              p.setDuration(snap.durationSeconds || 0);
              p.setAudioTracks(snap.audioTracks || []);
              p.setSelectedAudioId(snap.selectedAudioTrackId);
              p.setSubtitleTracks(snap.subtitleTracks || []);
              p.setSelectedSubtitleId(snap.selectedSubtitleTrackId);
              p.setSpeedState(snap.playbackSpeed || 1);
              p.setAspectState(snap.aspectOverride || 'auto');
              p.setStats(snap.stats);
              p.setRecordingActive(Boolean(snap.recording?.active));
              p.setReconnectAttempt(snap.reconnect?.attempt ?? null);
              if (snap.videoWidth && snap.videoHeight) {
                p.setResolution(`${snap.videoWidth}×${snap.videoHeight}`);
              }
              p.setBuffering(snap.status === 'loading' || snap.status === 'idle');
              if (snap.status === 'error' && snap.error) p.setError(p.describeMpvError(snap.error));
              else if (snap.status === 'playing') p.setError(null);
            }
          );

          await window.electron.loadEmbeddedMpvPlayback(session.id, resolved);
          if (cancelled) return;
          if (mode === 'frame-copy') {
            const attached = await window.electron
              .attachEmbeddedMpvFrameView?.(session.id)
              .catch(() => false);
            if (cancelled) return;
            if (attached === false) throw new Error('frame view attach failed');
          }
          if (!p.playing) {
            await window.electron.setEmbeddedMpvPaused(session.id, true);
          }
          if (cancelled) return;

          stopBoundsTracking = p.startBoundsTracking();
          return;
        } catch {
          if (cancelled) return;
          unsubMpv?.();
          unsubMpv = undefined;
          if (createdSessionId) {
            if (p.mpvModeRef.current === 'frame-copy') {
              window.electron.detachEmbeddedMpvFrameView?.();
            }
            window.electron.disposeEmbeddedMpvSession(createdSessionId).catch(() => {});
          }
          createdSessionId = null;
          p.sessionIdRef.current = null;
          p.mpvModeRef.current = null;
          p.setMpvMode(null);
          p.setEngine('html5');
        }
      }

      if (p.videoRef.current) {
        void p.startWebMediaEngine({
          isCancelled: () => cancelled,
          resolved,
          video: p.videoRef.current,
          playing: p.playing,
          onPlayingChange: p.onPlayingChange,
          hlsRef: p.hlsRef,
          tsRef: p.tsRef,
          setEngine: p.setEngine,
          setAudioTracks: p.setAudioTracks,
          setSelectedAudioId: p.setSelectedAudioId,
          setBuffering: p.setBuffering,
          setError: p.setError,
        });
      }
    })();

    return () => {
      cancelled = true;
      stopBoundsTracking?.();
      unsubMpv?.();
      p.destroyWebEngines(p.hlsRef, p.tsRef);
      const sid = p.sessionIdRef.current;
      p.sessionIdRef.current = null;
      if (sid && isElectronRuntime()) {
        if (p.mpvModeRef.current === 'frame-copy') {
          window.electron.detachEmbeddedMpvFrameView?.();
        }
        window.electron.disposeEmbeddedMpvSession(sid).catch(() => {});
      }
      p.mpvModeRef.current = null;
      if (isElectronRuntime()) {
        window.electron.setPlaybackKeepAwake(false).catch(() => {});
      }
    };
  }, [p.media.id, p.media.streamUrl, p.playlist?.id, p.forcedWeb, p.avoidNativeView, p.retryToken]);
}
