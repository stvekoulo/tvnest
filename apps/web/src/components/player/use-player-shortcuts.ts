// Raccourcis clavier du lecteur TVNest Cinema (lecture, sauts, volume, plein écran, épisode suivant).
import { useEffect } from 'react';
import type { UnifiedMedia } from '@/types/iptv.types';

interface UsePlayerShortcutsParams {
  compact: boolean;
  mediaKind: UnifiedMedia['kind'];
  playing: boolean;
  duration: number;
  onPlayingChange: (v: boolean) => void;
  seekBy: (delta: number) => void;
  seekTo: (sec: number) => void;
  changeVolumeBy: (delta: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  onCloseTheater?: () => void;
  revealOsd: () => void;
  nextEpisode?: UnifiedMedia | null;
  onPlayNext?: () => void;
}

export function usePlayerShortcuts({
  compact,
  mediaKind,
  playing,
  duration,
  onPlayingChange,
  seekBy,
  seekTo,
  changeVolumeBy,
  toggleMute,
  toggleFullscreen,
  onCloseTheater,
  revealOsd,
  nextEpisode,
  onPlayNext,
}: UsePlayerShortcutsParams) {
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable ||
        target?.getAttribute('role') === 'slider'
      ) {
        return;
      }
      if (target?.closest('[role="listbox"], [role="menu"], [data-tvnest-overlay]')) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const seekable = mediaKind !== 'live';
      const step = e.shiftKey ? 60 : 10;
      let handled = true;

      if (key === ' ' || key === 'k') {
        if (key === ' ' && tag === 'BUTTON') return;
        onPlayingChange(!playing);
      } else if ((key === 'ArrowLeft' || key === 'j') && seekable) {
        seekBy(-step);
      } else if ((key === 'ArrowRight' || key === 'l') && seekable) {
        seekBy(step);
      } else if (key === 'ArrowUp') {
        changeVolumeBy(5);
      } else if (key === 'ArrowDown') {
        changeVolumeBy(-5);
      } else if (key === 'm') {
        toggleMute();
      } else if (key === 'f') {
        toggleFullscreen();
      } else if (key === 'n' && nextEpisode && onPlayNext) {
        onPlayNext();
      } else if (/^[0-9]$/.test(key) && seekable && duration > 0) {
        seekTo((Number(key) / 10) * duration);
      } else if (key === 'Escape' && onCloseTheater && !document.fullscreenElement) {
        onCloseTheater();
      } else {
        handled = false;
      }

      if (handled) {
        e.preventDefault();
        revealOsd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    compact,
    mediaKind,
    playing,
    duration,
    onPlayingChange,
    seekBy,
    seekTo,
    changeVolumeBy,
    toggleMute,
    toggleFullscreen,
    onCloseTheater,
    revealOsd,
    nextEpisode,
    onPlayNext,
  ]);
}
