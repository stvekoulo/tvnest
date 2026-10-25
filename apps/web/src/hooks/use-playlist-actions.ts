// Hook dédié aux actions d'import et suppression de sources IPTV réelles.
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  addM3uPlaylistByUrl,
  addM3uPlaylistFromFileDialog,
  addM3uPlaylistFromText,
  fetchSavedPlaylists,
  removeSavedPlaylist,
} from '@/services/ipc-playlists.service';
import {
  addStalkerPortal,
  addXtreamPortal,
} from '@/services/ipc-portals.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

interface UsePlaylistActionsParams {
  activePlaylistId: string | null;
  setActivePlaylistId: Dispatch<SetStateAction<string | null>>;
  setPlaylists: Dispatch<SetStateAction<UnifiedPlaylist[]>>;
  setSyncLabel: Dispatch<SetStateAction<string | null>>;
  notify: (msg: string) => void;
}

export function usePlaylistActions({
  activePlaylistId,
  setActivePlaylistId,
  setPlaylists,
  setSyncLabel,
  notify,
}: UsePlaylistActionsParams) {
  const pushPlaylist = useCallback(
    async (pl: UnifiedPlaylist, message: string) => {
      const refreshed = await fetchSavedPlaylists().catch(() => null);
      if (refreshed && refreshed.length > 0) {
        setPlaylists(refreshed);
      } else {
        setPlaylists((prev) => [pl, ...prev.filter((p) => p.id !== pl.id)]);
      }
      setActivePlaylistId(pl.id);
      notify(message);
    },
    [setPlaylists, setActivePlaylistId, notify]
  );

  const addSource = {
    m3uUrl: async (url: string, title: string, ua?: string) => {
      setSyncLabel('Téléchargement M3U...');
      try {
        const pl = await addM3uPlaylistByUrl(url, title, ua);
        pushPlaylist(pl, `Playlist "${pl.title}" ajoutée (${pl.channelCount} flux)`);
      } finally {
        setSyncLabel(null);
      }
    },
    m3uFile: async () => {
      const pl = await addM3uPlaylistFromFileDialog();
      if (!pl) return;
      pushPlaylist(pl, `Fichier "${pl.title}" importé`);
    },
    m3uText: async (text: string, title: string) => {
      const pl = await addM3uPlaylistFromText(text, title);
      pushPlaylist(pl, `Playlist texte "${pl.title}" enregistrée`);
    },
    xtream: async (params: {
      title: string;
      serverUrl: string;
      username: string;
      password: string;
    }) => {
      setSyncLabel('Synchronisation Xtream Codes...');
      try {
        const pl = await addXtreamPortal(params);
        pushPlaylist(pl, `Portail Xtream "${pl.title}" synchronisé`);
      } finally {
        setSyncLabel(null);
      }
    },
    stalker: async (params: {
      title: string;
      portalUrl: string;
      macAddress: string;
    }) => {
      setSyncLabel('Connexion Stalker Portal...');
      try {
        const pl = await addStalkerPortal(params);
        pushPlaylist(pl, `Portail Stalker "${pl.title}" connecté`);
      } finally {
        setSyncLabel(null);
      }
    },
  };

  const deletePlaylist = useCallback(
    async (id: string) => {
      await removeSavedPlaylist(id);
      setPlaylists((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (activePlaylistId === id) {
          setActivePlaylistId(next[0]?.id || null);
        }
        return next;
      });
      notify('Playlist supprimée');
    },
    [activePlaylistId, setPlaylists, setActivePlaylistId, notify]
  );

  return { addSource, deletePlaylist };
}
