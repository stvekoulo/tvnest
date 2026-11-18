// Hook dédié aux actions d'import, d'actualisation et de suppression de sources IPTV.
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { clearCachedRails } from '@/hooks/use-section-rails';
import { clearCachedPages } from '@/services/catalog-page-cache';
import {
  addM3uPlaylistByUrl,
  addM3uPlaylistFromFileDialog,
  addM3uPlaylistFromText,
  fetchSavedPlaylists,
  markSourcesRefreshed,
  refreshM3uPlaylists,
  removeSavedPlaylist,
} from '@/services/ipc-playlists.service';
import {
  addStalkerPortal,
  addXtreamPortal,
  refreshStalkerPortal,
  refreshXtreamPortal,
} from '@/services/ipc-portals.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

interface UsePlaylistActionsParams {
  activePlaylistId: string | null;
  setActivePlaylistId: Dispatch<SetStateAction<string | null>>;
  setPlaylists: Dispatch<SetStateAction<UnifiedPlaylist[]>>;
  setSyncLabel: Dispatch<SetStateAction<string | null>>;
  notify: (msg: string) => void;
  onCatalogInvalidated?: () => void;
  onPlaylistDeleted?: (id: string) => void;
}

export function usePlaylistActions({
  activePlaylistId,
  setActivePlaylistId,
  setPlaylists,
  setSyncLabel,
  notify,
  onCatalogInvalidated,
  onPlaylistDeleted,
}: UsePlaylistActionsParams) {
  const pushPlaylist = useCallback(
    async (pl: UnifiedPlaylist, message: string) => {
      clearCachedPages();
      clearCachedRails();
      const refreshed = await fetchSavedPlaylists().catch(() => null);
      if (refreshed && refreshed.length > 0) {
        setPlaylists(refreshed);
      } else {
        setPlaylists((prev) => [pl, ...prev.filter((p) => p.id !== pl.id)]);
      }
      setActivePlaylistId(pl.id);
      onCatalogInvalidated?.();
      notify(message);
    },
    [setPlaylists, setActivePlaylistId, onCatalogInvalidated, notify]
  );

  const addSource = {
    m3uUrl: async (url: string, title: string, ua?: string) => {
      setSyncLabel('Téléchargement M3U...');
      try {
        const pl = await addM3uPlaylistByUrl(url, title, ua);
        await pushPlaylist(pl, `Playlist "${pl.title}" ajoutée (${pl.channelCount} flux)`);
      } finally {
        setSyncLabel(null);
      }
    },
    m3uFile: async (): Promise<boolean> => {
      const pl = await addM3uPlaylistFromFileDialog();
      if (!pl) return false;
      await pushPlaylist(pl, `Fichier "${pl.title}" importé`);
      return true;
    },
    m3uText: async (text: string, title: string) => {
      const pl = await addM3uPlaylistFromText(text, title);
      await pushPlaylist(pl, `Playlist texte "${pl.title}" enregistrée`);
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
        await pushPlaylist(pl, `Portail Xtream "${pl.title}" synchronisé`);
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
        await pushPlaylist(pl, `Portail Stalker "${pl.title}" connecté`);
      } finally {
        setSyncLabel(null);
      }
    },
  };

  const refreshSource = useCallback(
    async (pl: UnifiedPlaylist) => {
      setSyncLabel(`Actualisation de « ${pl.title} »...`);
      try {
        if (pl.kind === 'xtream') {
          await refreshXtreamPortal(pl);
        } else if (pl.kind === 'stalker') {
          await refreshStalkerPortal(pl);
        } else if (pl.kind === 'm3u-url' || pl.kind === 'm3u-file') {
          const done = await refreshM3uPlaylists([pl.id]);
          if (done.length === 0) {
            throw new Error('Impossible de rafraîchir cette playlist M3U.');
          }
        } else {
          notify('Une playlist texte collée ne possède pas de source distante à actualiser.');
          return;
        }
        markSourcesRefreshed([pl.id]);
        clearCachedPages();
        clearCachedRails();
        const refreshed = await fetchSavedPlaylists().catch(() => null);
        if (refreshed) setPlaylists(refreshed);
        onCatalogInvalidated?.();
        notify(`Source « ${pl.title} » actualisée`);
      } catch (err) {
        notify(`Actualisation en échec : ${(err as Error).message}`);
      } finally {
        setSyncLabel(null);
      }
    },
    [setSyncLabel, setPlaylists, onCatalogInvalidated, notify]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await removeSavedPlaylist(id);
      clearCachedPages();
      clearCachedRails();
      onPlaylistDeleted?.(id);
      setPlaylists((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (activePlaylistId === id) {
          setActivePlaylistId(next[0]?.id || null);
        }
        return next;
      });
      notify('Source supprimée');
    },
    [activePlaylistId, setPlaylists, setActivePlaylistId, onPlaylistDeleted, notify]
  );

  return { addSource, refreshSource, deletePlaylist };
}
