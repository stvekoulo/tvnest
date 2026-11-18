// Abonnements IPC Electron de l'espace de travail TVNest (EPG, transferts, retour, ouverture M3U OS).
import { type MutableRefObject, useEffect } from 'react';
import {
  importM3uPlaylistFromFilePath,
  isElectronRuntime,
} from '@/services/ipc-playlists.service';
import { saveExternalPlaybackProgress } from '@/services/ipc-system.service';

function formatEpgSourceLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname || 'source XMLTV';
  } catch {
    return rawUrl.split(/[\\/]/).pop() || 'source XMLTV';
  }
}

interface UseWorkspaceIpcEventsParams {
  parentalLockEnabled: boolean;
  theaterOpenRef: MutableRefObject<boolean>;
  setTheaterOpen: (v: boolean) => void;
  closeMediaDetail: () => void;
  setSyncLabel: (label: string | null) => void;
  refreshPlaylists: () => Promise<void>;
  refreshDownloads: () => Promise<void>;
  setActivePlaylistId: (id: string | null) => void;
  notify: (msg: string) => void;
}

export function useWorkspaceIpcEvents({
  parentalLockEnabled,
  theaterOpenRef,
  setTheaterOpen,
  closeMediaDetail,
  setSyncLabel,
  refreshPlaylists,
  refreshDownloads,
  setActivePlaylistId,
  notify,
}: UseWorkspaceIpcEventsParams) {
  useEffect(() => {
    void refreshPlaylists();
    if (!isElectronRuntime()) return;

    void window.electron.setParentalLockState?.(parentalLockEnabled).catch(() => {});
    const unsubEpg = window.electron.onEpgProgress?.((prog) => {
      setSyncLabel(prog.status === 'loading' ? `EPG : ${formatEpgSourceLabel(prog.url)}` : null);
    });
    const unsubDl = window.electron.onDownloadsUpdate?.(() => void refreshDownloads());
    const unsubRec = window.electron.onRecordingsUpdate?.(() => void refreshDownloads());
    const unsubBack = window.electron.onWindowBackRequested?.(() => {
      if (theaterOpenRef.current) setTheaterOpen(false);
      else closeMediaDetail();
    });
    const unsubExternal = window.electron.onPlaybackPositionUpdate?.(saveExternalPlaybackProgress);
    const unsubOpen = window.electron.onPlaylistOpenRequest?.((req) => {
      void importM3uPlaylistFromFilePath(req.filePath, req.fileName)
        .then(async (pl) => {
          await window.electron.acknowledgePlaylistOpenRequest?.(req.requestId);
          await refreshPlaylists();
          setActivePlaylistId(pl.id);
          notify(`Fichier « ${pl.title} » ouvert`);
        })
        .catch((err) => notify(`Ouverture M3U impossible : ${(err as Error).message}`));
    });
    void window.electron.announcePlaylistOpenListener?.().catch(() => {});

    return () => {
      unsubEpg?.();
      unsubDl?.();
      unsubRec?.();
      unsubBack?.();
      unsubExternal?.();
      unsubOpen?.();
    };
  }, [refreshPlaylists, refreshDownloads, closeMediaDetail]);
}
