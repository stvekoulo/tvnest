// Filtres du catalogue, minimalistes : un bouton « Filtres » (panneau compact) et, sous le
// titre, les filtres actifs en petites puces que l'on retire d'un clic.
import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDismissable } from '@/hooks/use-dismissable';
import { CONTENT_LANGUAGES, type ContentLanguageCode, t, type UiLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CatalogFilterState, CatalogQualityFilter, CatalogSortMode } from '@/types/iptv.types';

const QUALITY_OPTIONS: Array<{ value: CatalogQualityFilter; label: string }> = [
  { value: 'ALL', label: 'Toutes' },
  { value: '4K', label: '4K' },
  { value: 'FHD', label: '1080p' },
  { value: 'HD', label: '720p' },
  { value: 'HEVC', label: 'HEVC' },
];
const RATING_OPTIONS = [0, 6, 7, 8];
const SORT_OPTIONS: Array<{ value: CatalogSortMode; label: string }> = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'recent', label: 'Ajouts récents' },
  { value: 'rating-desc', label: 'Meilleures notes' },
  { value: 'year-desc', label: 'Année (récentes)' },
  { value: 'title-asc', label: 'Titre A → Z' },
  { value: 'title-desc', label: 'Titre Z → A' },
];

interface ActiveFilter {
  key: string;
  label: string;
  clear: Partial<CatalogFilterState>;
}

/** Filtres qui s'écartent des valeurs par défaut, avec de quoi les retirer. */
export function listActiveFilters(filters: CatalogFilterState): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  if (filters.search.trim()) active.push({ key: 'search', label: `« ${filters.search.trim()} »`, clear: { search: '' } });
  if (filters.language !== 'ALL') {
    const lang = CONTENT_LANGUAGES.find((l) => l.value === filters.language)?.label ?? filters.language;
    active.push({ key: 'language', label: lang, clear: { language: 'ALL' } });
  }
  if (filters.quality !== 'ALL') {
    const q = QUALITY_OPTIONS.find((o) => o.value === filters.quality)?.label ?? filters.quality;
    active.push({ key: 'quality', label: q, clear: { quality: 'ALL' } });
  }
  if (filters.minRating > 0) active.push({ key: 'rating', label: `Note ${filters.minRating}+`, clear: { minRating: 0 } });
  if (filters.year) active.push({ key: 'year', label: filters.year, clear: { year: '' } });
  if (filters.onlyFavorites) active.push({ key: 'fav', label: 'Favoris', clear: { onlyFavorites: false } });
  if (filters.hasCatchup) active.push({ key: 'catchup', label: 'Replay', clear: { hasCatchup: false } });
  if (filters.hasEpg) active.push({ key: 'epg', label: 'Avec guide', clear: { hasEpg: false } });
  if (filters.sortBy !== 'relevance') {
    const s = SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? filters.sortBy;
    active.push({ key: 'sort', label: s, clear: { sortBy: 'relevance' } });
  }
  return active;
}

interface CatalogFilterMenuProps {
  filters: CatalogFilterState;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
  availableYears: string[];
  totalMatches: number;
  showLiveFilters?: boolean;
  uiLanguage: UiLanguage;
}

export function CatalogFilterMenu({
  filters,
  onChange,
  onReset,
  availableYears,
  totalMatches,
  showLiveFilters = false,
  uiLanguage,
}: CatalogFilterMenuProps) {
  const { open, setOpen, ref } = useDismissable<HTMLDivElement>();
  const count = listActiveFilters(filters).filter((f) => f.key !== 'search').length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition-colors',
          count > 0 ? 'border-foreground/25 bg-elevated text-foreground' : 'border-border bg-card text-foreground hover:bg-elevated'
        )}
      >
        <SlidersHorizontal className="size-3.5 text-muted-foreground" />
        Filtres
        {count > 0 ? (
          <span className="grid size-[18px] place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(340px,calc(100vw-2rem))] space-y-4 rounded-2xl border border-border bg-card p-4 shadow-2xl">
          <Field label="Trier par">
            <NativeSelect value={filters.sortBy} onChange={(v) => onChange({ sortBy: v as CatalogSortMode })}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Langue">
            <NativeSelect value={filters.language} onChange={(v) => onChange({ language: v as ContentLanguageCode })}>
              {CONTENT_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Qualité">
            <Segmented
              options={QUALITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={filters.quality}
              onChange={(v) => onChange({ quality: v as CatalogQualityFilter })}
            />
          </Field>

          {!showLiveFilters ? (
            <Field label="Note minimale">
              <Segmented
                options={RATING_OPTIONS.map((r) => ({ value: String(r), label: r === 0 ? 'Toutes' : `${r}+` }))}
                value={String(filters.minRating)}
                onChange={(v) => onChange({ minRating: Number(v) })}
              />
            </Field>
          ) : null}

          {!showLiveFilters && availableYears.length > 0 ? (
            <Field label="Année">
              <NativeSelect value={filters.year || ''} onChange={(v) => onChange({ year: v })}>
                <option value="">Toutes les années</option>
                {availableYears.slice(0, 40).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            <Toggle active={filters.onlyFavorites} onClick={() => onChange({ onlyFavorites: !filters.onlyFavorites })}>
              Favoris
            </Toggle>
            {showLiveFilters ? (
              <>
                <Toggle active={filters.hasCatchup} onClick={() => onChange({ hasCatchup: !filters.hasCatchup })}>
                  Replay
                </Toggle>
                <Toggle active={filters.hasEpg} onClick={() => onChange({ hasEpg: !filters.hasEpg })}>
                  Avec guide
                </Toggle>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{totalMatches.toLocaleString('fr-FR')}</span> résultats
            </span>
            {count > 0 ? (
              <button type="button" onClick={onReset} className="font-semibold text-foreground hover:underline">
                {t(uiLanguage, 'resetFilters')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Puces des filtres actifs, retirables une à une. */
export function CatalogActiveFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: CatalogFilterState;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
}) {
  const active = listActiveFilters(filters);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.clear)}
          aria-label={`Retirer le filtre ${f.label}`}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-elevated pl-3 pr-2 text-[11px] font-medium text-foreground hover:border-foreground/30"
        >
          {f.label}
          <X className="size-3 text-muted-foreground" />
        </button>
      ))}
      {active.length > 1 ? (
        <button type="button" onClick={onReset} className="px-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
          Tout effacer
        </button>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function NativeSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-xl border border-border bg-elevated px-3 text-xs text-foreground outline-none focus:border-foreground/30 dark:[color-scheme:dark]"
    >
      {children}
    </select>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-elevated p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
            o.value === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
