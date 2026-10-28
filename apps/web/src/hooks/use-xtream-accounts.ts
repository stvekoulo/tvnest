// Abonnement de chaque source Xtream (date de fin, connexions), demandé au serveur et
// gardé quelques minutes : revenir sur la page des sources ne relance pas les requêtes.
import { useEffect, useState } from 'react';
import { fetchXtreamAccount, type XtreamAccount } from '@/services/xtream-request.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

export type AccountState = XtreamAccount | 'loading' | 'error' | null;

const ACCOUNT_FRESH_MS = 10 * 60_000;
const accountCache = new Map<string, { at: number; account: XtreamAccount | null }>();

export function useXtreamAccounts(playlists: UnifiedPlaylist[]): Record<string, AccountState> {
  const [states, setStates] = useState<Record<string, AccountState>>({});
  const xtream = playlists.filter((p) => p.kind === 'xtream' && p.serverUrl);
  const key = xtream.map((p) => p.id).join('|');

  useEffect(() => {
    let cancelled = false;
    for (const pl of xtream) {
      const cached = accountCache.get(pl.id);
      if (cached && Date.now() - cached.at < ACCOUNT_FRESH_MS) {
        setStates((s) => ({ ...s, [pl.id]: cached.account }));
        continue;
      }
      setStates((s) => ({ ...s, [pl.id]: 'loading' }));
      fetchXtreamAccount(pl.serverUrl as string, { username: pl.username || '', password: pl.password || '' })
        .then((account) => {
          accountCache.set(pl.id, { at: Date.now(), account });
          if (!cancelled) setStates((s) => ({ ...s, [pl.id]: account }));
        })
        .catch(() => {
          if (!cancelled) setStates((s) => ({ ...s, [pl.id]: 'error' }));
        });
    }
    return () => {
      cancelled = true;
    };
    // Relancé seulement quand la liste des sources Xtream change.
  }, [key]);

  return states;
}
