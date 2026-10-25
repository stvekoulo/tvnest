// Barre avancée de recherche et de filtrage multicritère SQLite avec contrôles @beui.
import {
  ArrowUpDown,
  Calendar,
  Clock,
  Globe,
  Heart,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Tv,
  X,
} from 'lucide-react';
import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import { CONTENT_LANGUAGES, type ContentLanguageCode, t, type UiLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type {
  CatalogFilterState,
  CatalogQualityFilter,
  CatalogSortMode,
} from '@/types/iptv.types';

interface CatalogFilterBarProps {
  filters: CatalogFilterState;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
  availableYears: string[];
  totalMatches: number;
  tookMs: number;
  showLiveFilters?: boolean;
  uiLanguage: UiLanguage;
}

const QUALITY_OPTIONS: Array<{ value: CatalogQualityFilter; label: string }> = [
  { value: 'ALL', label: 'Toutes qualités' },
  { value: '4K', label: '4K / UHD (2160p)' },
  { value: 'FHD', label: 'Full HD (1080p)' },
  { value: 'HD', label: 'HD (720p)' },
  { value: 'HEVC', label: 'HEVC / H.265' },
];

const RATING_OPTIONS = [
  { value: '0', label: 'Toutes notes' },
  { value: '5', label: 'Note ≥ 5.0' },
  { value: '6', label: 'Note ≥ 6.0' },
  { value: '7', label: 'Note ≥ 7.0' },
  { value: '8', label: 'Note ≥ 8.0' },
];

const SORT_OPTIONS: Array<{ value: CatalogSortMode; label: string }> = [
  { value: 'relevance', label: 'Pertinence & Langue' },
  { value: 'recent', label: 'Ajouts récents' },
  { value: 'rating-desc', label: 'Meilleures notes' },
  { value: 'year-desc', label: 'Plus récents (année)' },
  { value: 'title-asc', label: 'Titre (A → Z)' },
  { value: 'title-desc', label: 'Titre (Z → A)' },
];

export function CatalogFilterBar({
  filters,
  onChange,
  onReset,
  availableYears,
  totalMatches,
  tookMs,
  showLiveFilters = false,
  uiLanguage,
}: CatalogFilterBarProps) {
  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    filters.language !== 'ALL' ||
    filters.quality !== 'ALL' ||
    filters.minRating > 0 ||
    Boolean(filters.year) ||
    filters.onlyFavorites ||
    filters.hasCatchup ||
    filters.hasEpg ||
    filters.sortBy !== 'relevance';

  return (
    <div className="space-y-2.5 rounded-[22px] border border-border bg-card p-3.5">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
        {/* Recherche plein texte multi-jetons */}
        <div className="md:col-span-4">
          <Input
            value={filters.search}
            onChange={(search) => onChange({ search })}
            placeholder={t(uiLanguage, 'searchPlaceholder')}
            leftIcon={<Search />}
            rightIcon={
              filters.search ? (
                <button
                  type="button"
                  onClick={() => onChange({ search: '' })}
                  className="rounded-md p-1 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Filtre par langue */}
        <div className="md:col-span-2">
          <Select
            value={filters.language}
            onValueChange={(v) => onChange({ language: v as ContentLanguageCode })}
          >
            <SelectTrigger>
              <Globe className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Langue" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtre qualité */}
        <div className="md:col-span-2">
          <Select
            value={filters.quality}
            onValueChange={(v) => onChange({ quality: v as CatalogQualityFilter })}
          >
            <SelectTrigger>
              <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Qualité" />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_OPTIONS.map((q) => (
                <SelectItem key={q.value} value={q.value}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtre note minimale ou année */}
        <div className="md:col-span-2">
          {availableYears.length > 0 && !showLiveFilters ? (
            <Select
              value={filters.year || 'ALL'}
              onValueChange={(v) => onChange({ year: v === 'ALL' ? '' : v })}
            >
              <SelectTrigger>
                <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes années</SelectItem>
                {availableYears.slice(0, 25).map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={String(filters.minRating)}
              onValueChange={(v) => onChange({ minRating: Number(v) })}
            >
              <SelectTrigger>
                <Star className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Note" />
              </SelectTrigger>
              <SelectContent>
                {RATING_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tri */}
        <div className="md:col-span-2">
          <Select
            value={filters.sortBy}
            onValueChange={(v) => onChange({ sortBy: v as CatalogSortMode })}
          >
            <SelectTrigger>
              <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ligne secondaire : puces rapides + compteur temps réel SQLite */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={filters.onlyFavorites}
            onClick={() => onChange({ onlyFavorites: !filters.onlyFavorites })}
            icon={<Heart className="size-3" />}
            label="Favoris uniquement"
          />
          {!showLiveFilters ? (
            <FilterChip
              active={filters.minRating >= 7}
              onClick={() => onChange({ minRating: filters.minRating >= 7 ? 0 : 7 })}
              icon={<Star className="size-3" />}
              label="Top Notes (7+)"
            />
          ) : null}
          {showLiveFilters ? (
            <>
              <FilterChip
                active={filters.hasCatchup}
                onClick={() => onChange({ hasCatchup: !filters.hasCatchup })}
                icon={<Clock className="size-3" />}
                label="Replay TV disponible"
              />
              <FilterChip
                active={filters.hasEpg}
                onClick={() => onChange({ hasEpg: !filters.hasEpg })}
                icon={<Tv className="size-3" />}
                label="Guide EPG actif"
              />
            </>
          ) : null}

          {hasActiveFilters ? (
            <Button size="sm" variant="ghost" onClick={onReset} className="h-7 px-2.5 text-[11px]">
              <RotateCcw className="size-3" />
              {t(uiLanguage, 'resetFilters')}
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            {totalMatches.toLocaleString('fr-FR')}
          </span>
          <span>résultats</span>
          <span className="rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
            {tookMs} ms
          </span>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors',
        active
          ? 'border-foreground/30 bg-elevated text-foreground'
          : 'border-border bg-elevated text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
