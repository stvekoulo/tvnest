// Plein écran de toute l'application. Dans Electron : plein écran natif de la fenêtre
// (aucun geste utilisateur exigé). En mode Web : API Fullscreen du navigateur.
import { useEffect, useState } from 'react';
import { isElectronRuntime } from '@/services/ipc-playlists.service';

export function hasNativeWindowFullscreen(): boolean {
  return (
    isElectronRuntime() &&
    typeof window.electron.toggleFullScreenWindow === 'function' &&
    typeof window.electron.getWindowState === 'function'
  );
}

export async function isAppFullscreen(): Promise<boolean> {
  if (hasNativeWindowFullscreen()) {
    return Boolean((await window.electron.getWindowState().catch(() => null))?.isFullScreen);
  }
  return Boolean(document.fullscreenElement);
}

/** Bascule le plein écran de l'interface (bouton de la barre de titre, F11). */
export async function toggleAppFullscreen(): Promise<void> {
  if (hasNativeWindowFullscreen()) {
    await window.electron.toggleFullScreenWindow();
    return;
  }
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  else await document.documentElement.requestFullscreen?.().catch(() => {});
}

/** État plein écran de l'interface, tenu à jour (fenêtre Electron ou document). */
export function useAppFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    void isAppFullscreen().then(setFullscreen);
    const onDocChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onDocChange);
    const unsubWindow = hasNativeWindowFullscreen()
      ? window.electron.onWindowStateChange?.((s) => setFullscreen(Boolean(s.isFullScreen)))
      : undefined;
    return () => {
      document.removeEventListener('fullscreenchange', onDocChange);
      unsubWindow?.();
    };
  }, []);
  return fullscreen;
}
