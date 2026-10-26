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
  EmbeddedMpvSession,
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
import { toMpvVolume, useTvNestPlayerControls } from './use-tvnest-mpv-controls';
import { destroyWebEngines, startWebMediaEngine } from './use-tvnest-web-engine';

export type PlayerEngineKind = 'libmpv' | 'hls' | 'mpegts' | 'html5';

type Bounds = { x: number; y: number; width: number; height: number };

// En mode natif, la vidéo libmpv est une fenêtre OS peinte AU-DESSUS du DOM : tout menu,
// liste ou modale qui la chevauche serait masqué. On la déplace hors écran tant qu'un
// tel calque existe (même stratégie que le lecteur Angular d'origine).
const HIDDEN_BOUNDS: Bounds = { x: -100000, y: -100000, width: 1, height: 1 };
const OVERLAY_SELECTOR = '[data-tvnest-overlay], [role="listbox"][aria-hidden="false"]';
// Un décalage de mise en page sans redimensionnement n'émet aucun événement DOM :
// on vérifie la position toutes les 500 ms (aucun IPC tant que rien ne bouge).
const POSITION_POLL_MS = 500;

// Position de lecture mémorisée par média pour la session. Passer de l'aperçu au mode
// Cinéma (ou l'inverse) démonte un lecteur et en monte un autre : le nouveau reprend ici.
const livePositions = new Map<string, number>();
const RESUME_END_MARGIN_S = 10;

/** Message mpv brut (« loading failed »…) → explication lisible. */
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

/** Position atteinte pendant la session (plus récente que celle enregistrée en base). */
export function getSessionPosition(mediaId: string): number | undefined {
  return livePositions.get(mediaId);
}

/** « Recommencer » : la prochaine ouverture repart du début. */
export function forgetSessionPosition(mediaId: string): void {
  livePositions.delete(mediaId);
}

function boundsDiffer(a: Bounds, b: Bounds): boolean {
  return (
    Math.abs(a.x - b.x) > 0.5 ||
    Math.abs(a.y - b.y) > 0.5 ||
    Math.abs(a.width - b.width) > 0.5 ||
    Math.abs(a.height - b.height) > 0.5
  );
}

function useDomOverlayActive(enabled: boolean): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    const check = () => setActive(document.querySelector(OVERLAY_SELECTOR) !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'data-tvnest-overlay'],
    });
    return () => observer.disconnect();
  }, [enabled]);
  return active;
}

export interface UseTvNestPlayerOptions {
  media: UnifiedMedia;
  playlist?: UnifiedPlaylist | null;
  playing: boolean;
  onPlayingChange: (next: boolean) => void;
  /** Zone vidéo seule (sans la barre de contrôles) : c'est elle que libmpv recouvre. */
  hostRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  preferWebEngine?: boolean;
  /** N'utilise pas la fenêtre libmpv native (le rendu frame-copy dans un canvas reste permis). */
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
  const [position, setPosition] = useState(
    () => livePositions.get(media.id) ?? media.progressSeconds ?? 0
  );
  const [duration, setDuration] = useState(media.durationSeconds || 0);
  // Nouveau média (épisode suivant…) : position et durée repartent AVANT tout effet, sinon
  // l'épisode suivant hériterait de la fin du précédent comme point de reprise.
  const [positionOf, setPositionOf] = useState(media.id);
  if (positionOf !== media.id) {
    setPositionOf(media.id);
    setPosition(livePositions.get(media.id) ?? media.progressSeconds ?? 0);
    setDuration(media.durationSeconds || 0);
  }

  // Progression en base (moteur libmpv comme moteur Web) : voir recordMediaWatchProgress.
  useEffect(() => {
    recordMediaWatchProgress(media, position, duration);
    // `media` suit `media.id` : pas besoin de le lister.
  }, [media.id, position, duration]);
  useEffect(() => {
    if (!playing) flushMediaWatchProgress(media.id);
  }, [playing, media.id]);
  useEffect(() => () => flushMediaWatchProgress(media.id, true), [media.id]);

  useEffect(() => {
    if (media.kind === 'live' || position <= 0) return;
    // Arrivé au générique : la prochaine ouverture repart du début.
    if (duration > 0 && position > duration - RESUME_END_MARGIN_S) livePositions.delete(media.id);
    else livePositions.set(media.id, position);
  }, [media.id, media.kind, position, duration]);
  const [volume, setVolumeState] = useState(initialMuted ? 0 : 90);
  const [muted, setMuted] = useState(initialMuted);
  const [speed, setSpeedState] = useState(1);
  const [aspect, setAspectState] = useState('auto');
  const [audioTracks, setAudioTracks] = useState<EmbeddedMpvAudioTrack[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<number | null>(null);
  const [subtitleTracks, setSubtitleTracks] = useState<
    EmbeddedMpvSubtitleTrack[]
  >([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | null>(
    null
  );
  const [stats, setStats] = useState<EmbeddedMpvStreamStats | undefined>();
  const [resolution, setResolution] = useState<string | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number | null>(null);
  // « Réessayer » : relance une session neuve sur le même média.
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setRetryToken((t) => t + 1);
  }, []);

  const sessionIdRef = useRef<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tsRef = useRef<mpegts.Player | null>(null);
  const mpvModeRef = useRef<'frame-copy' | 'native' | null>(null);
  const nativeHiddenRef = useRef(false);
  const lastBoundsRef = useRef<Bounds | null>(null);
  const boundsFrameRef = useRef<number | null>(null);

  const overlayActive = useDomOverlayActive(engine === 'libmpv' && mpvMode === 'native');

  const measureBounds = useCallback((): Bounds | null => {
    // Le canvas frame-copy fait partie du DOM : les calques s'empilent dessus nativement.
    if (mpvModeRef.current === 'native' && nativeHiddenRef.current) return HIDDEN_BOUNDS;
    const el = hostRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null;
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }, [hostRef]);

  const syncBounds = useCallback(() => {
    if (boundsFrameRef.current !== null) cancelAnimationFrame(boundsFrameRef.current);
    boundsFrameRef.current = requestAnimationFrame(() => {
      boundsFrameRef.current = null;
      const sid = sessionIdRef.current;
      const bounds = measureBounds();
      if (!sid || !bounds || !isElectronRuntime()) return;
      lastBoundsRef.current = bounds;
      window.electron.setEmbeddedMpvBounds(sid, bounds).catch(() => {});
    });
  }, [measureBounds]);

  useEffect(() => {
    nativeHiddenRef.current = overlayActive || error !== null;
    syncBounds();
  }, [overlayActive, error, syncBounds]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setBuffering(true);
    setReconnectAttempt(null);
    setPosition(livePositions.get(media.id) ?? media.progressSeconds ?? 0);
    setDuration(media.durationSeconds || 0);

    let unsubMpv: (() => void) | undefined;
    let stopBoundsTracking: (() => void) | undefined;
    let createdSessionId: string | null = null;

    (async () => {
      const [baseResolved, support] = await Promise.all([
        resolveMediaPlayback(media, playlist),
        probeEmbeddedMpvSupport(),
      ]);
      if (cancelled) return;
      const resumeAt = livePositions.get(media.id);
      const resolved =
        resumeAt && resumeAt > 1 && !baseResolved.isLive
          ? { ...baseResolved, startTime: Math.floor(resumeAt) }
          : baseResolved;

      setMpvAvailable(Boolean(support.supported));
      if (!resolved.streamUrl) {
        setBuffering(false);
        setError('URL de flux indisponible pour ce média.');
        return;
      }

      if (isElectronRuntime()) {
        window.electron.setPlaybackKeepAwake(true).catch(() => {});
      }

      const nativeViewAvoided = avoidNativeView && support.engine !== 'frame-copy';
      if (isElectronRuntime() && Boolean(support.supported) && !forcedWeb && !nativeViewAvoided) {
        try {
          const mode =
            support.engine === 'frame-copy' ? 'frame-copy' : 'native';
          mpvModeRef.current = mode;
          const session = await window.electron.createEmbeddedMpvSession(
            measureBounds() ?? { x: 0, y: 0, width: 640, height: 360 },
            resolved.title,
            toMpvVolume(muted ? 0 : volume)
          );
          createdSessionId = session.id;
          if (cancelled) {
            window.electron.disposeEmbeddedMpvSession(session.id).catch(() => {});
            return;
          }

          sessionIdRef.current = session.id;
          setMpvMode(mode);
          setEngine('libmpv');

          unsubMpv = window.electron.onEmbeddedMpvSessionUpdate?.(
            (snap: EmbeddedMpvSession) => {
              if (snap.id !== session.id || cancelled) return;
              setPosition(snap.positionSeconds || 0);
              setDuration(snap.durationSeconds || 0);
              setAudioTracks(snap.audioTracks || []);
              setSelectedAudioId(snap.selectedAudioTrackId);
              setSubtitleTracks(snap.subtitleTracks || []);
              setSelectedSubtitleId(snap.selectedSubtitleTrackId);
              setSpeedState(snap.playbackSpeed || 1);
              setAspectState(snap.aspectOverride || 'auto');
              setStats(snap.stats);
              setRecordingActive(Boolean(snap.recording?.active));
              setReconnectAttempt(snap.reconnect?.attempt ?? null);
              if (snap.videoWidth && snap.videoHeight) {
                setResolution(`${snap.videoWidth}×${snap.videoHeight}`);
              }
              setBuffering(snap.status === 'loading' || snap.status === 'idle');
              if (snap.status === 'error' && snap.error) setError(describeMpvError(snap.error));
              else if (snap.status === 'playing') setError(null);
            }
          );

          await window.electron.loadEmbeddedMpvPlayback(session.id, resolved);
          if (cancelled) return;
          if (mode === 'frame-copy') {
            // Sans canvas WebGL2 attaché, mpv joue le son derrière un écran noir :
            // on traite l'échec comme une erreur et on bascule sur le moteur Web.
            const attached = await window.electron
              .attachEmbeddedMpvFrameView?.(session.id)
              .catch(() => false);
            if (cancelled) return;
            if (attached === false) throw new Error('frame view attach failed');
          }
          if (!playing) {
            await window.electron.setEmbeddedMpvPaused(session.id, true);
          }
          if (cancelled) return;

          const host = hostRef.current;
          const resizeObs = new ResizeObserver(() => syncBounds());
          if (host) resizeObs.observe(host);
          window.addEventListener('resize', syncBounds);
          window.addEventListener('scroll', syncBounds, true);
          const poll = window.setInterval(() => {
            if (mpvModeRef.current !== 'native' || !lastBoundsRef.current) return;
            const now = measureBounds();
            if (now && boundsDiffer(now, lastBoundsRef.current)) syncBounds();
          }, POSITION_POLL_MS);
          stopBoundsTracking = () => {
            resizeObs.disconnect();
            window.removeEventListener('resize', syncBounds);
            window.removeEventListener('scroll', syncBounds, true);
            window.clearInterval(poll);
          };
          syncBounds();
          return;
        } catch {
          if (cancelled) return;
          // La session créée doit être détruite, sinon sa fenêtre native reste à l'écran.
          unsubMpv?.();
          unsubMpv = undefined;
          if (createdSessionId) {
            if (mpvModeRef.current === 'frame-copy') {
              window.electron.detachEmbeddedMpvFrameView?.();
            }
            window.electron.disposeEmbeddedMpvSession(createdSessionId).catch(() => {});
          }
          createdSessionId = null;
          sessionIdRef.current = null;
          mpvModeRef.current = null;
          setMpvMode(null);
          setEngine('html5');
        }
      }

      if (videoRef.current) {
        void startWebMediaEngine({
          isCancelled: () => cancelled,
          resolved,
          video: videoRef.current,
          playing,
          onPlayingChange,
          hlsRef,
          tsRef,
          setEngine,
          setAudioTracks,
          setSelectedAudioId,
          setBuffering,
          setError,
        });
      }
    })();

    return () => {
      cancelled = true;
      stopBoundsTracking?.();
      if (boundsFrameRef.current !== null) {
        cancelAnimationFrame(boundsFrameRef.current);
        boundsFrameRef.current = null;
      }
      lastBoundsRef.current = null;
      unsubMpv?.();
      destroyWebEngines(hlsRef, tsRef);
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sid && isElectronRuntime()) {
        if (mpvModeRef.current === 'frame-copy') {
          window.electron.detachEmbeddedMpvFrameView?.();
        }
        window.electron.disposeEmbeddedMpvSession(sid).catch(() => {});
      }
      mpvModeRef.current = null;
      if (isElectronRuntime()) {
        window.electron.setPlaybackKeepAwake(false).catch(() => {});
      }
    };
  }, [media.id, media.streamUrl, playlist?.id, forcedWeb, retryToken]);

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
