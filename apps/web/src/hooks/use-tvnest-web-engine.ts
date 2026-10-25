// Initialisation du pipeline Web multi-moteur (mpegts.js, hls.js, HTML5) pour TVNest.
// hls.js et mpegts.js (~600 Ko) ne sont chargés que si le moteur Web est utilisé :
// dans l'application installée, c'est libmpv qui lit.
import type Hls from 'hls.js';
import type mpegts from 'mpegts.js';
import type { MutableRefObject } from 'react';
import type {
  EmbeddedMpvAudioTrack,
  ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { PlayerEngineKind } from './use-tvnest-player';

const NETWORK_RECOVERY_MAX = 3;
/** 1 s, 2 s, 4 s. */
const networkRecoveryDelayMs = (attempt: number) => 1000 * 2 ** (attempt - 1);
const NETWORK_LOST_MESSAGE =
  'Connexion au flux perdue. Vérifiez votre connexion ou réessayez : le serveur IPTV est peut-être saturé.';
const INCOMPATIBLE_MESSAGE = 'Flux incompatible avec le décodeur Web — activez libmpv ou MPV.';

interface StartWebEngineParams {
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
  /** Lecture abandonnée pendant le chargement des moteurs (changement de média). */
  isCancelled?: () => boolean;
}

export function destroyWebEngines(
  hlsRef: MutableRefObject<Hls | null>,
  tsRef: MutableRefObject<mpegts.Player | null>
): void {
  if (hlsRef.current) {
    hlsRef.current.destroy();
    hlsRef.current = null;
  }
  if (tsRef.current) {
    tsRef.current.unload();
    tsRef.current.detachMediaElement();
    tsRef.current.destroy();
    tsRef.current = null;
  }
}

export async function startWebMediaEngine({
  resolved,
  video,
  playing,
  onPlayingChange,
  hlsRef,
  tsRef,
  setEngine,
  setAudioTracks,
  setSelectedAudioId,
  setBuffering,
  setError,
  isCancelled,
}: StartWebEngineParams): Promise<void> {
  const [{ default: Hls }, { default: mpegts }] = await Promise.all([
    import('hls.js'),
    import('mpegts.js'),
  ]);
  if (isCancelled?.()) return;

  if (isElectronRuntime() && (resolved.userAgent || resolved.referer)) {
    window.electron
      .setUserAgent(
        resolved.userAgent || null,
        resolved.referer || null,
        resolved.streamUrl
      )
      .catch(() => {});
  }

  const startTs = (tsUrl: string): boolean => {
    if (!mpegts.isSupported()) return false;
    destroyWebEngines(hlsRef, tsRef);
    setEngine('mpegts');
    const tsPlayer = mpegts.createPlayer(
      { type: 'mpegts', isLive: Boolean(resolved.isLive), url: tsUrl },
      { enableWorker: true, liveBufferLatencyChasing: true }
    );
    tsRef.current = tsPlayer;
    tsPlayer.attachMediaElement(video);
    tsPlayer.load();
    if (playing) Promise.resolve(tsPlayer.play()).catch(() => {});
    // Coupure réseau : on recharge le flux quelques fois avant d'afficher une erreur.
    let tsRecoveries = 0;
    tsPlayer.on(mpegts.Events.ERROR, (type: string) => {
      if (tsRef.current !== tsPlayer) return;
      if (type === mpegts.ErrorTypes.NETWORK_ERROR && tsRecoveries < NETWORK_RECOVERY_MAX) {
        tsRecoveries += 1;
        setBuffering(true);
        window.setTimeout(() => {
          if (tsRef.current !== tsPlayer) return;
          tsPlayer.unload();
          tsPlayer.load();
          Promise.resolve(tsPlayer.play()).catch(() => {});
        }, networkRecoveryDelayMs(tsRecoveries));
        return;
      }
      setBuffering(false);
      setError(
        type === mpegts.ErrorTypes.NETWORK_ERROR ? NETWORK_LOST_MESSAGE : INCOMPATIBLE_MESSAGE
      );
    });
    tsPlayer.on(mpegts.Events.STATISTICS_INFO, () => {
      tsRecoveries = 0;
    });
    return true;
  };

  const lower = resolved.streamUrl.toLowerCase();
  const looksLikeTs =
    (lower.endsWith('.ts') || lower.includes('output=ts')) &&
    !lower.includes('.m3u8');

  if (looksLikeTs && startTs(resolved.streamUrl)) return;

  if (Hls.isSupported() && (lower.includes('.m3u8') || resolved.isLive)) {
    setEngine('hls');
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      // Connexions IPTV instables : plus de tentatives avant qu'une erreur devienne fatale.
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 4,
      fragLoadingMaxRetry: 6,
      manifestLoadingRetryDelay: 1000,
      levelLoadingRetryDelay: 1000,
      fragLoadingRetryDelay: 1000,
    });
    let networkRecoveries = 0;
    let mediaRecoveries = 0;
    hlsRef.current = hls;
    hls.loadSource(resolved.streamUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (resolved.startTime && !resolved.isLive) {
        video.currentTime = resolved.startTime;
      }
      setAudioTracks(
        hls.audioTracks.map((t, i) => ({
          id: i,
          title: t.name,
          language: t.lang,
          selected: i === hls.audioTrack,
        }))
      );
      setSelectedAudioId(hls.audioTrack);
      setBuffering(false);
      if (playing) video.play().catch(() => onPlayingChange(false));
    });
    hls.on(Hls.Events.FRAG_LOADED, () => {
      networkRecoveries = 0;
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      // Coupure réseau : relancer le chargement avec un délai croissant.
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < NETWORK_RECOVERY_MAX) {
        networkRecoveries += 1;
        setBuffering(true);
        window.setTimeout(() => {
          if (hlsRef.current === hls) hls.startLoad();
        }, networkRecoveryDelayMs(networkRecoveries));
        return;
      }
      // Décodage interrompu : hls.js sait souvent le reprendre sans recharger.
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
        mediaRecoveries += 1;
        hls.recoverMediaError();
        return;
      }
      if (resolved.liveAutoTsUrl && startTs(resolved.liveAutoTsUrl)) return;
      setBuffering(false);
      setError(
        data.type === Hls.ErrorTypes.NETWORK_ERROR ? NETWORK_LOST_MESSAGE : INCOMPATIBLE_MESSAGE
      );
    });
    return;
  }

  setEngine('html5');
  video.src = resolved.streamUrl;
  if (resolved.startTime && !resolved.isLive) {
    video.currentTime = resolved.startTime;
  }
  if (playing) video.play().catch(() => onPlayingChange(false));
}
