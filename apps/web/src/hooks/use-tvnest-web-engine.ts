// Initialisation du pipeline Web multi-moteur (mpegts.js, hls.js, HTML5) pour TVNest.
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import type { MutableRefObject } from 'react';
import type {
  EmbeddedMpvAudioTrack,
  ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { PlayerEngineKind } from './use-tvnest-player';

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

export function startWebMediaEngine({
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
}: StartWebEngineParams): void {
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
    return true;
  };

  const lower = resolved.streamUrl.toLowerCase();
  const looksLikeTs =
    (lower.endsWith('.ts') || lower.includes('output=ts')) &&
    !lower.includes('.m3u8');

  if (looksLikeTs && startTs(resolved.streamUrl)) return;

  if (Hls.isSupported() && (lower.includes('.m3u8') || resolved.isLive)) {
    setEngine('hls');
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
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
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (resolved.liveAutoTsUrl && startTs(resolved.liveAutoTsUrl)) return;
      setBuffering(false);
      setError('Flux incompatible avec le décodeur Web — activez libmpv ou MPV.');
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
