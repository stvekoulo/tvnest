// Actualisation des sources en arrière-plan au démarrage, tous les N jours (Paramètres).
import { useEffect, useRef } from 'react';
import { clearCachedRails } from '@/hooks/use-section-rails';
import { clearCachedPages } from '@/services/catalog-page-cache';
import { refreshXtreamPortal } from '@/services/ipc-portals.service';
import {
  fetchSourceRefreshTimes,
  isElectronRuntime,
  markSourcesRefreshed,
  refreshM3uPlaylists,
} from '@/services/ipc-playlists.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

const DAY_MS = 86_400_000;
// Laisse l'interface et le catalogue se charger avant de lancer des téléchargements lourds.
const STARTUP_DELAY_MS = 15_000;

export function isSourceRefreshDue(lastRefreshMs: number, days: number, now = Date.now()): boolean {
  return days > 0 && now - lastRefreshMs >= days * DAY_MS;
}

interface SourceAutoRefreshOptions {
  playlists: UnifiedPlaylist[];
  /** 0 = désactivé, sinon intervalle en jours (1 à 7). */
  days: number;
  onRefreshed: () => Promise<void>;
  notify: (msg: string) => void;
  setSyncLabel: (label: string | null) => void;
}

export function useSourceAutoRefresh({
  playlists,
  days,
  onRefreshed,
  notify,
  setSyncLabel,
}: SourceAutoRefreshOptions) {
  // Une seule passe par lancement de l'application, marquée au moment où elle démarre.
  const startedRef = useRef(false);
  const latestRef = useRef({ playlists, onRefreshed, notify, setSyncLabel });
  latestRef.current = { playlists, onRefreshed, notify, setSyncLabel };
  const ready = isElectronRuntime() && days > 0 && playlists.length > 0;

  useEffect(() => {
    if (!ready || startedRef.current) return;
    const timer = window.setTimeout(async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const { playlists, onRefreshed, notify, setSyncLabel } = latestRef.current;
      // Seules ces sources ont une origine à re-télécharger (texte collé et Stalker n'en ont pas).
      const candidates = playlists.filter((p) => ['m3u-url', 'm3u-file', 'xtream'].includes(p.kind));
      const times = await fetchSourceRefreshTimes().catch(() => ({} as Record<string, number>));
      const due = candidates.filter((p) => isSourceRefreshDue(times[p.id] ?? 0, days));
      if (due.length === 0) return;

      setSyncLabel(`Actualisation de ${due.length} source(s)...`);
      const done: string[] = [];
      try {
        const m3uIds = due.filter((p) => p.kind !== 'xtream').map((p) => p.id);
        done.push(...(await refreshM3uPlaylists(m3uIds).catch(() => [])));
        for (const portal of due.filter((p) => p.kind === 'xtream')) {
          setSyncLabel(`Actualisation de « ${portal.title} »...`);
          const ok = await refreshXtreamPortal(portal).then(() => true, () => false);
          if (ok) done.push(portal.id);
        }
      } finally {
        setSyncLabel(null);
      }

      markSourcesRefreshed(done);
      if (done.length > 0) {
        clearCachedPages();
        clearCachedRails();
        await onRefreshed();
      }
      const failed = due.length - done.length;
      notify(
        failed > 0
          ? `Sources actualisées : ${done.length}, en échec : ${failed}`
          : `${done.length} source(s) actualisée(s)`
      );
    }, STARTUP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ready, days]);
}
