// Mise à jour de TVNest depuis les releases GitHub (electron-updater côté backend).
import type { ElectronBridgeAppUpdateStatus } from '@iptvnator/shared/interfaces';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isElectronRuntime } from '@/services/ipc-playlists.service';

// Le backend vérifie au démarrage ; une session longue revérifie à cet intervalle.
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type AppUpdateState = ReturnType<typeof useAppUpdate>;

export function useAppUpdate(autoUpdate: boolean, notify: (msg: string) => void) {
  const [status, setStatus] = useState<ElectronBridgeAppUpdateStatus | null>(null);
  const bridgeReady =
    isElectronRuntime() && typeof window.electron.getAppUpdateStatus === 'function';
  // Une seule action automatique par version : pas de téléchargement ni d'alerte en boucle.
  const autoDownloadedRef = useRef<string | null>(null);
  const notifiedReadyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bridgeReady) return;
    window.electron.getAppUpdateStatus().then(setStatus).catch(() => {});
    return window.electron.onAppUpdateStatusChange(setStatus);
  }, [bridgeReady]);

  const check = useCallback(async () => {
    if (!bridgeReady) return;
    setStatus(await window.electron.checkForAppUpdate().catch(() => null));
  }, [bridgeReady]);

  const download = useCallback(async () => {
    if (!bridgeReady) return;
    setStatus(await window.electron.downloadAppUpdate().catch(() => null));
  }, [bridgeReady]);

  const install = useCallback(() => {
    if (!bridgeReady) return;
    void window.electron.installAppUpdate().catch(() => {});
  }, [bridgeReady]);

  useEffect(() => {
    if (!bridgeReady || !autoUpdate) return;
    const timer = window.setInterval(() => void check(), RECHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [bridgeReady, autoUpdate, check]);

  useEffect(() => {
    if (!status?.supportedSelfUpdate) return;
    const version = status.latestVersion ?? status.release?.version ?? null;
    if (
      autoUpdate &&
      status.status === 'available' &&
      version &&
      autoDownloadedRef.current !== version
    ) {
      autoDownloadedRef.current = version;
      void download();
    }
    if (status.status === 'downloaded' && version && notifiedReadyRef.current !== version) {
      notifiedReadyRef.current = version;
      notify(`TVNest ${version} est prête : redémarrez depuis les Paramètres pour l'installer`);
    }
  }, [status, autoUpdate, download, notify]);

  return { status, available: bridgeReady, check, download, install };
}
