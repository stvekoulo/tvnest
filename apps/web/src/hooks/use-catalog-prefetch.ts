// Préchargement en arrière-plan des rubriques et synchronisation temps réel « En cours ».
import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from 'react';
import { isSameWatchItem } from '@/lib/resume-point';
import {
  buildPageRequest,
  prefetchPage,
  sectionQueryType,
} from '@/services/catalog-page-cache';
import type { WatchProgressDetail } from '@/services/ipc-system.service';
import type {
  AppSection,
  CatalogFilterState,
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';
import type { DashboardHighlightsState } from './use-catalog-query';
import { loadSectionRails } from './use-section-rails';

export function useCatalogPrefetchAndProgress({
  activePlaylist,
  categories,
  preferredContentLanguage,
  filtersForRef,
  watchProgressEvent,
  setItems,
  setHighlights,
  reloadOverview,
}: {
  activePlaylist: UnifiedPlaylist | null;
  categories: UnifiedCategory[];
  preferredContentLanguage: string;
  filtersForRef: MutableRefObject<(sec: AppSection) => CatalogFilterState>;
  watchProgressEvent: string;
  setItems: Dispatch<SetStateAction<UnifiedMedia[]>>;
  setHighlights: Dispatch<SetStateAction<DashboardHighlightsState>>;
  reloadOverview: () => Promise<void>;
}) {
  useEffect(() => {
    if (!activePlaylist || categories.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      for (const sec of ['live', 'movies', 'series'] as const) {
        if (cancelled) return;
        const filters = filtersForRef.current(sec);
        const type = sectionQueryType(sec) as 'live' | 'movie' | 'series';
        await prefetchPage(
          activePlaylist,
          buildPageRequest(sec, filters, null, preferredContentLanguage)
        ).catch(() => {});
        if (cancelled) return;
        await loadSectionRails(
          activePlaylist,
          type,
          categories.filter((c) => c.type === type),
          filters
        ).catch(() => []);
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activePlaylist, categories, preferredContentLanguage, filtersForRef]);

  useEffect(() => {
    let reloadTimer: number | undefined;
    const onProgress = (e: Event) => {
      const { item, positionSeconds, durationSeconds } = (
        e as CustomEvent<WatchProgressDetail>
      ).detail;
      const patch = (r: UnifiedMedia) =>
        isSameWatchItem(r, item)
          ? { ...r, progressSeconds: positionSeconds, durationSeconds }
          : r;
      setItems((prev) =>
        prev.some((r) => isSameWatchItem(r, item)) ? prev.map(patch) : prev
      );
      setHighlights((prev) => {
        const row = prev.continueWatching.find((r) => isSameWatchItem(r, item));
        if (!row) {
          window.clearTimeout(reloadTimer);
          reloadTimer = window.setTimeout(() => void reloadOverview(), 1500);
          return prev;
        }
        const updated = {
          ...row,
          progressSeconds: positionSeconds,
          durationSeconds,
        };
        return {
          ...prev,
          continueWatching: [
            updated,
            ...prev.continueWatching.filter((r) => r !== row),
          ],
        };
      });
    };
    window.addEventListener(watchProgressEvent, onProgress);
    return () => {
      window.removeEventListener(watchProgressEvent, onProgress);
      window.clearTimeout(reloadTimer);
    };
  }, [watchProgressEvent, setItems, setHighlights, reloadOverview]);
}
