// Catalogue (Live TV, Films, Séries, Favoris) dans le style de l'Accueil. Sans groupe ni
// filtre : « À la une », panneau des groupes et une rangée par groupe, comme l'Accueil.
// Avec un groupe, un filtre, une recherche ou « Tout parcourir » : la grille complète.
import { ChevronLeft, PlusCircle, Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MediaSquircleCard } from '@/components/cards/media-squircle-card';
import { Button } from '@/components/motion/button/base';
import { CatalogActiveFilters, CatalogFilterMenu, listActiveFilters } from '@/components/views/catalog-filter-bar';
import { CatalogGroupPicker } from '@/components/views/catalog-group-picker';
import { DashboardHeroRow } from '@/components/views/dashboard-hero-row';
import { LivePreviewPanel } from '@/components/views/live-preview-panel';
import { MediaRailSection } from '@/components/views/media-rail-section';
import { useSectionRails } from '@/hooks/use-section-rails';
import { t, type UiLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type {
  CatalogFilterState,
  EpgProgram,
  UnifiedCategory,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

interface CatalogWorkspaceViewProps {
  title: string;
  /** Rubrique présentée comme l'Accueil (rangées par groupe) ; absent pour Favoris. */
  browseType?: 'live' | 'movie' | 'series';
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
  browseType,
  playlist,
  isLiveSection = false,
  items,
  totalMatches,
  availableYears,
  categories,
  selectedCategory,
  onSelectCategory,
  filters,
  onUpdateFilters,
  onResetFilters,
  onLoadMore,
  epgByChannel,
  activeMedia,
  suppressPreviewPlayer,
  uiLanguage,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  onExpandTheater,
}: CatalogWorkspaceViewProps) {
  // Nouvelle liste (groupe, rubrique ou filtres) : on repart du haut, pas de la position
  // de défilement de la liste précédente.
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    gridScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedCategory, title, filters]);

  const totalCatCount = categories.reduce((sum, c) => sum + (c.count || 0), 0);
  const showPreview = isLiveSection && activeMedia?.kind === 'live' && !suppressPreviewPlayer;

  // La langue par défaut n'empêche pas l'aperçu ; tout autre filtre passe en grille.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [title]);
  const narrowed = listActiveFilters(filters).some((f) => f.key !== 'language');
  const browsing = Boolean(browseType) && !showAll && selectedCategory === 'ALL' && !narrowed;
  const rails = useSectionRails(playlist, browsing ? (browseType ?? null) : null, categories, filters);
  const selectGroup = (id: string) => {
    if (id === 'ALL') setShowAll(false);
    onSelectCategory(id);
  };

  return (
    <div className="flex h-full min-h-0">
      <div ref={gridScrollRef} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {totalMatches.toLocaleString('fr-FR')} {isLiveSection ? 'chaînes' : 'titres'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {categories.length > 0 ? (
                <CatalogGroupPicker
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={selectGroup}
                  totalCount={totalCatCount || totalMatches}
                  uiLanguage={uiLanguage}
                />
              ) : null}
              <CatalogFilterMenu
                filters={filters}
                onChange={onUpdateFilters}
                onReset={onResetFilters}
                availableYears={availableYears}
                totalMatches={totalMatches}
                showLiveFilters={isLiveSection}
                uiLanguage={uiLanguage}
              />
            </div>
          </div>

          <CatalogActiveFilters filters={filters} onChange={onUpdateFilters} onReset={onResetFilters} />

          {browseType && !browsing ? (
            <button
              type="button"
              onClick={() => {
                setShowAll(false);
                onSelectCategory('ALL');
                onResetFilters();
              }}
              className="-mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              Retour à l'aperçu
            </button>
          ) : null}

          {browsing ? (
            <div className="space-y-8 sm:space-y-10">
              <DashboardHeroRow
                spotlight={(items.some((i) => i.posterUrl) ? items.filter((i) => i.posterUrl) : items).slice(0, 8)}
                categories={categories}
                totalStreamCount={totalMatches}
                onSelectCat={(cat) => selectGroup(cat.id)}
                onPlay={onPlay}
                onOpenDetail={onOpenDetail}
                onToggleFavorite={onToggleFavorite}
                onNavigateSection={() => setShowAll(true)}
                uiLanguage={uiLanguage}
                explore={{ label: `Tout parcourir (${totalMatches.toLocaleString('fr-FR')})`, onClick: () => setShowAll(true) }}
              />
              {rails.map((rail) => (
                <MediaRailSection
                  key={rail.category.id}
                  title={rail.category.name}
                  items={rail.items.slice(0, 5)}
                  epgByChannel={epgByChannel}
                  onSeeAll={() => selectGroup(rail.category.id)}
                  onPlay={(item) => onPlay(item, !isLiveSection)}
                  onOpenDetail={onOpenDetail}
                  onToggleFavorite={onToggleFavorite}
                  fixedCardWidth
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-card p-6 text-center">
              <Radio className="size-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">Aucun résultat</p>
              <p className="mt-1 text-xs text-muted-foreground">Changez de groupe ou retirez un filtre.</p>
            </div>
          ) : (
            <>
              {/* Colonnes calculées sur la largeur disponible : du téléphone au grand écran. */}
              <div
                className={cn(
                  'grid gap-3 sm:gap-5',
                  isLiveSection
                    ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))]'
                    : 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]'
                )}
              >
                {items.map((item) => (
                  <MediaSquircleCard
                    key={item.id}
                    item={item}
                    active={activeMedia?.id === item.id}
                    epg={item.tvgId ? epgByChannel[item.tvgId] : null}
                    onPlay={() => onPlay(item, !isLiveSection)}
                    onOpenDetail={item.kind !== 'live' ? () => onOpenDetail(item) : undefined}
                    onToggleFavorite={() => onToggleFavorite(item)}
                  />
                ))}
              </div>

              {items.length < totalMatches ? (
                <div className="flex justify-center pt-3">
                  <Button variant="secondary" size="md" onClick={onLoadMore}>
                    <PlusCircle className="size-4" />
                    {t(uiLanguage, 'loadMore')} ({items.length.toLocaleString('fr-FR')} /{' '}
                    {totalMatches.toLocaleString('fr-FR')})
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Aperçu réservé aux chaînes en direct : un film ou un épisode n'a rien à faire ici. */}
      {showPreview && activeMedia ? <LivePreviewPanel channel={activeMedia} onExpandTheater={onExpandTheater} /> : null}
    </div>
  );
}
