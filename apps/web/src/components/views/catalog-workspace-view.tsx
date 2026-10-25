// Vue catalogue TVNest avec rail de groupes SQLite, filtres multicritères et aperçu Live.
import { Maximize2, PlusCircle, Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MediaSquircleCard } from '@/components/cards/media-squircle-card';
import { Button } from '@/components/motion/button/base';
import { PlayerSlot } from '@/components/player/player-host';
import { CatalogFilterBar } from '@/components/views/catalog-filter-bar';
import { t, type UiLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { fetchChannelSchedule } from '@/services/ipc-system.service';
import type {
  CatalogFilterState,
  EpgProgram,
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

interface CatalogWorkspaceViewProps {
  title: string;
  isLiveSection?: boolean;
  playlist: UnifiedPlaylist | null;
  items: UnifiedMedia[];
  totalMatches: number;
  availableYears: string[];
  queryTookMs: number;
  categories: UnifiedCategory[];
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  filters: CatalogFilterState;
  onUpdateFilters: (patch: Partial<CatalogFilterState>) => void;
  onResetFilters: () => void;
  onLoadMore: () => void;
  epgByChannel: Record<string, EpgProgram | null>;
  activeMedia: UnifiedMedia | null;
  isPlaying: boolean;
  onSetPlaying: (v: boolean) => void;
  suppressPreviewPlayer: boolean;
  uiLanguage: UiLanguage;
  onPlay: (item: UnifiedMedia, expand?: boolean) => void;
  onOpenDetail: (item: UnifiedMedia) => void;
  onToggleFavorite: (item: UnifiedMedia) => void;
  onExpandTheater: () => void;
}

export function CatalogWorkspaceView({
  title,
  isLiveSection = false,
  playlist,
  items,
  totalMatches,
  availableYears,
  queryTookMs,
  categories,
  selectedCategory,
  onSelectCategory,
  filters,
  onUpdateFilters,
  onResetFilters,
  onLoadMore,
  epgByChannel,
  activeMedia,
  isPlaying,
  onSetPlaying,
  suppressPreviewPlayer,
  uiLanguage,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  onExpandTheater,
}: CatalogWorkspaceViewProps) {
  const [schedule, setSchedule] = useState<EpgProgram[]>([]);

  useEffect(() => {
    if (!activeMedia?.tvgId) {
      setSchedule([]);
      return;
    }
    fetchChannelSchedule(activeMedia.tvgId)
      .then((list) => setSchedule(list.slice(0, 8)))
      .catch(() => setSchedule([]));
  }, [activeMedia?.tvgId]);

  // Nouvelle liste (groupe, rubrique ou filtres) : on repart du haut, pas de la position
  // de défilement de la liste précédente.
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    gridScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedCategory, title, filters]);

  const totalCatCount = categories.reduce((sum, c) => sum + (c.count || 0), 0);

  return (
    <div className="flex h-full min-h-0">
      {/* Rail latéral des groupes avec compteurs SQLite exacts */}
      {categories.length > 0 ? (
        <div className="w-[235px] shrink-0 overflow-y-auto border-r border-border bg-surface p-3.5">
          <h3 className="mb-2.5 px-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Groupes ({categories.length.toLocaleString('fr-FR')})
          </h3>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onSelectCategory('ALL')}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
                selectedCategory === 'ALL'
                  ? 'bg-elevated text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]'
                  : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
              )}
            >
              <span>{t(uiLanguage, 'allGroups')}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {(totalCatCount || totalMatches).toLocaleString('fr-FR')}
              </span>
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors',
                  selectedCategory === cat.id
                    ? 'bg-elevated font-semibold text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]'
                    : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                )}
              >
                <span className="truncate pr-2">{cat.name}</span>
                {cat.count !== undefined ? (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {cat.count.toLocaleString('fr-FR')}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Zone centrale : Barre de filtres SQLite + Grille de cartes */}
      <div ref={gridScrollRef} className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {totalMatches.toLocaleString('fr-FR')} flux indexés dans SQLite
            </p>
          </div>
        </div>

        <CatalogFilterBar
          filters={filters}
          onChange={onUpdateFilters}
          onReset={onResetFilters}
          availableYears={availableYears}
          totalMatches={totalMatches}
          tookMs={queryTookMs}
          showLiveFilters={isLiveSection}
          uiLanguage={uiLanguage}
        />

        {items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-card p-6 text-center">
            <Radio className="size-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold text-foreground">
              Aucun flux ne correspond à vos filtres
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
               Ajustez la recherche, la langue ou réinitialisez les filtres actifs.
            </p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'grid gap-4',
                isLiveSection
                  ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
              )}
            >
              {items.map((item) => (
                <MediaSquircleCard
                  key={item.id}
                  item={item}
                  active={activeMedia?.id === item.id}
                  epg={item.tvgId ? epgByChannel[item.tvgId] : null}
                  onPlay={() => onPlay(item, !isLiveSection)}
                  onOpenDetail={
                    item.kind !== 'live' ? () => onOpenDetail(item) : undefined
                  }
                  onToggleFavorite={() => onToggleFavorite(item)}
                />
              ))}
            </div>

            {items.length < totalMatches ? (
              <div className="flex justify-center pt-3">
                <Button variant="secondary" size="md" onClick={onLoadMore}>
                  <PlusCircle className="size-4 text-primary" />
                  {t(uiLanguage, 'loadMore')} ({items.length.toLocaleString('fr-FR')} /{' '}
                  {totalMatches.toLocaleString('fr-FR')})
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Panneau latéral Live TV : Aperçu direct + Guide EPG */}
      {/* Aperçu réservé aux chaînes en direct : un film ou un épisode n'a rien à faire ici. */}
      {isLiveSection && activeMedia?.kind === 'live' && !suppressPreviewPlayer ? (
        <aside className="hidden w-[320px] shrink-0 flex-col border-l border-border bg-surface p-5 xl:flex">
          <div className="relative aspect-video w-full overflow-hidden rounded-[22px] border border-border bg-black shadow-lg">
            <PlayerSlot />
          </div>

          <div className="mt-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-foreground">
                {activeMedia.title}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {activeMedia.category}
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={onExpandTheater}>
              <Maximize2 className="size-3.5" />
              Cinéma
            </Button>
          </div>

          <div className="mt-5 flex-1 overflow-y-auto">
            <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Programme EPG en cours
            </h4>
            {schedule.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun programme XMLTV associé ({activeMedia.tvgId || 'sans ID'}).
              </p>
            ) : (
              <div className="space-y-2">
                {schedule.map((prog, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <p className="text-xs font-semibold text-foreground">{prog.title}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-primary">
                      {new Date(prog.start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      –{' '}
                      {new Date(prog.stop).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
