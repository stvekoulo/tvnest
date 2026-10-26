// Choix du groupe du catalogue : un seul bouton, une liste avec recherche (remplace la colonne).
import { Check, ChevronDown, Layers, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDismissable } from '@/hooks/use-dismissable';
import { t, type UiLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UnifiedCategory } from '@/types/iptv.types';

interface CatalogGroupPickerProps {
  categories: UnifiedCategory[];
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  totalCount: number;
  uiLanguage: UiLanguage;
}

export function CatalogGroupPicker({
  categories,
  selectedCategory,
  onSelectCategory,
  totalCount,
  uiLanguage,
}: CatalogGroupPickerProps) {
  const { open, setOpen, ref } = useDismissable<HTMLDivElement>();
  const [query, setQuery] = useState('');
  const current = categories.find((c) => c.id === selectedCategory);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, query]);

  const pick = (id: string) => {
    onSelectCategory(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition-colors',
          current ? 'border-foreground/25 bg-elevated text-foreground' : 'border-border bg-card text-foreground hover:bg-elevated'
        )}
      >
        <Layers className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{current ? current.name : t(uiLanguage, 'allGroups')}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-2 flex max-h-[min(460px,70vh)] w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:left-auto sm:right-0">
          <div className="border-b border-border p-2">
            <label className="flex h-9 items-center gap-2 rounded-xl bg-elevated px-3 text-xs">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Chercher parmi ${categories.length} groupes`}
                className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>
          <div className="overflow-y-auto p-1.5">
            {!query ? (
              <GroupRow label={t(uiLanguage, 'allGroups')} count={totalCount} active={!current} onClick={() => pick('ALL')} />
            ) : null}
            {visible.map((cat) => (
              <GroupRow
                key={cat.id}
                label={cat.name}
                count={cat.count}
                active={cat.id === selectedCategory}
                onClick={() => pick(cat.id)}
              />
            ))}
            {visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Aucun groupe ne correspond.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupRow({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors',
        active ? 'bg-elevated font-semibold text-foreground' : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="font-mono text-[10px] text-muted-foreground">{count.toLocaleString('fr-FR')}</span> : null}
      {active ? <Check className="size-3.5 shrink-0" /> : null}
    </button>
  );
}
