// Commandes interactives unifiées (seek, volume, pistes, vitesse, enregistrement) TVNest.
import type Hls from 'hls.js';
import { type MutableRefObject, type RefObject, useCallback } from 'react';
import { isElectronRuntime } from '@/services/ipc-playlists.service';

// L'UI raisonne en 0–100 ; le module natif libmpv attend 0–1 (il borne à [0, 1] puis × 100).
export const toMpvVolume = (percent: number) => Math.max(0, Math.min(100, percent)) / 100;

interface UseMpvControlsParams {
  sessionIdRef: MutableRefObject<string | null>;
  hlsRef: MutableRefObject<Hls | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  position: number;
  volume: number;
  muted: boolean;
  recordingActive: boolean;
  mediaTitle: string;
  setPosition: (v: number) => void;
  setVolumeState: (v: number) => void;
  setMuted: (m: boolean) => void;
  setSelectedAudioId: (id: number) => void;
  setSelectedSubtitleId: (id: number) => void;
  setSpeedState: (s: number) => void;
  setAspectState: (a: string) => void;
}

export function useTvNestPlayerControls({
  sessionIdRef,
  hlsRef,
  videoRef,
  position,
  volume,
  muted,
  recordingActive,
  mediaTitle,
  setPosition,
  setVolumeState,
  setMuted,
  setSelectedAudioId,
  setSelectedSubtitleId,
  setSpeedState,
  setAspectState,
}: UseMpvControlsParams) {
  const seekTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, seconds);
      setPosition(clamped);
      const sid = sessionIdRef.current;
      if (sid && isElectronRuntime()) {
        window.electron.seekEmbeddedMpv(sid, clamped).catch(() => {});
      } else if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
    },
    [sessionIdRef, setPosition, videoRef]
  );

  const seekBy = useCallback(
    (delta: number) => {
      const sid = sessionIdRef.current;
      if (sid && isElectronRuntime()) {
        if (window.electron.seekEmbeddedMpvBy) {
          window.electron.seekEmbeddedMpvBy(sid, delta).catch(() => {});
        } else {
          seekTo(position + delta);
        }
      } else if (videoRef.current) {
        videoRef.current.currentTime = Math.max(
          0,
          videoRef.current.currentTime + delta
        );
      }
    },
    [position, seekTo, sessionIdRef, videoRef]
  );

  const setVolume = useCallback(
    (nextVol: number) => {
      const v = Math.max(0, Math.min(100, Math.round(nextVol)));
      setVolumeState(v);
      setMuted(v === 0);
      const sid = sessionIdRef.current;
      if (sid && isElectronRuntime()) {
        window.electron.setEmbeddedMpvVolume(sid, toMpvVolume(v)).catch(() => {});
      } else if (videoRef.current) {
        videoRef.current.volume = v / 100;
        videoRef.current.muted = v === 0;
      }
    },
    [sessionIdRef, setMuted, setVolumeState, videoRef]
  );

  const changeVolumeBy = useCallback(
    (delta: number) => setVolume((muted ? 0 : volume) + delta),
    [muted, setVolume, volume]
  );

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    // Rétablir un volume audible si le volume mémorisé était 0.
    const restoreVol = volume > 0 ? volume : 50;
    setMuted(nextMuted);
    if (!nextMuted) setVolumeState(restoreVol);
    const sid = sessionIdRef.current;
    if (sid && isElectronRuntime()) {
      window.electron
        .setEmbeddedMpvVolume(sid, toMpvVolume(nextMuted ? 0 : restoreVol))
        .catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) videoRef.current.volume = restoreVol / 100;
    }
  }, [muted, sessionIdRef, setMuted, setVolumeState, videoRef, volume]);

  const selectAudioTrack = useCallback(
    (trackId: number) => {
      setSelectedAudioId(trackId);
      const sid = sessionIdRef.current;
      if (sid && isElectronRuntime()) {
        window.electron.setEmbeddedMpvAudioTrack(sid, trackId).catch(() => {});
      } else if (hlsRef.current) {
        hlsRef.current.audioTrack = trackId;
      }
    },
    [hlsRef, sessionIdRef, setSelectedAudioId]
  );

  const selectSubtitleTrack = useCallback(
    (trackId: number) => {
      setSelectedSubtitleId(trackId);
      const sid = sessionIdRef.current;
      if (sid && isElectronRuntime()) {
        window.electron
          .setEmbeddedMpvSubtitleTrack?.(sid, trackId)
          .catch(() => {});
      } else if (hlsRef.current) {
        hlsRef.current.subtitleTrack = trackId;
      }
    },
    [hlsRef, sessionIdRef, setSelectedSubtitleId]
  );

  const importSubtitleFile = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || !isElectronRuntime()) return;
    const path = await window.electron.selectEmbeddedMpvSubtitleFile?.();
    if (path) {
      await window.electron.addEmbeddedMpvSubtitle?.(sid, path).catch(() => {});
    }
  }, [sessionIdRef]);

  const setSpeed = useCallback(
    (nextSpeed: number) => {
      setSpeedState(nextSpeed);
      const sid = sessionIdRef.current;
      if (sid && isElectronRuntime()) {
        window.electron.setEmbeddedMpvSpeed?.(sid, nextSpeed).catch(() => {});
      } else if (videoRef.current) {
        videoRef.current.playbackRate = nextSpeed;
      }
    },
    [sessionIdRef, setSpeedState, videoRef]
  );

  const setAspect = useCallback(
    (nextAspect: string) => {
      setAspectState(nextAspect);
      const sid = sessionIdRef.current;
      if (sid && isElectronRuntime()) {
        window.electron.setEmbeddedMpvAspect?.(sid, nextAspect).catch(() => {});
      }
    },
    [sessionIdRef, setAspectState]
  );

  const toggleRecording = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || !isElectronRuntime()) return;
    if (recordingActive) {
      await window.electron.stopEmbeddedMpvRecording?.(sid).catch(() => {});
    } else {
      await window.electron
        .startEmbeddedMpvRecording?.(sid, { title: mediaTitle })
        .catch(() => {});
    }
  }, [mediaTitle, recordingActive, sessionIdRef]);

  return {
    seekTo,
    seekBy,
    setVolume,
    changeVolumeBy,
    toggleMute,
    selectAudioTrack,
    selectSubtitleTrack,
    importSubtitleFile,
    setSpeed,
    setAspect,
    toggleRecording,
  };
}
