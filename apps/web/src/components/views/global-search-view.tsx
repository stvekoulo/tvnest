// Résultats de la recherche lancée depuis l'Accueil : toutes les sources de la base confondues.
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaSquircleCard } from '@/components/cards/media-squircle-card';
import { Loader } from '@/components/motion/loader';
import { searchAllSources } from '@/services/ipc-catalog.service';
import type { EpgProgram, UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

const SEARCH_DEBOUNCE_MS = 250;
const GROUPS: Array<{ kind: UnifiedMedia['kind']; title: string }> = [
  { kind: 'live', title: 'Chaînes en direct' },
  { kind: 'movie', title: 'Films' },
  { kind: 'series', title: 'Séries' },
];

interface GlobalSearchViewProps {
  query: string;
  playlists: UnifiedPlaylist[];
  epgByChannel: Record<string, EpgProgram | null>;
  onPlay: (item: UnifiedMedia) => void;
  onOpenDetail: (item: UnifiedMedia) => void;
  onToggleFavorite: (item: UnifiedMedia) => void;
}

export function GlobalSearchView({
  query,
  playlists,
  epgByChannel,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
}: GlobalSearchViewProps) {
  const [results, setResults] = useState<UnifiedMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const found = await searchAllSources(playlists, term);
      if (cancelled) return;
      setResults(found);
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, playlists]);

  const multiSource = playlists.length > 1;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div>
        <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground">
          {term ? `Résultats pour « ${term} »` : 'Recherche'}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Dans toutes les sources ({playlists.length}) : chaînes, films et séries.
        </p>
      </div>

      {term.length < 2 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-border bg-card text-center">
          <Search className="size-6 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Tapez au moins 2 caractères</p>
        </div>
      ) : loading ? (
        <div className="flex h-56 items-center justify-center">
          <Loader variant="dots" size={28} />
        </div>
      ) : results.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-border bg-card text-center">
          <Search className="size-6 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Aucun résultat dans vos sources</p>
        </div>
      ) : (
        GROUPS.map(({ kind, title }) => {
          const items = results.filter((r) => r.kind === kind);
          if (items.length === 0) return null;
          return (
            <section key={kind} className="space-y-4">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                {title} <span className="text-sm font-medium text-muted-foreground">({items.length})</span>
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 sm:gap-5">
                {items.map((item) => (
                  <div key={item.id} className="min-w-0 space-y-1.5">
                    <MediaSquircleCard
                      item={item}
                      epg={item.tvgId ? epgByChannel[item.tvgId] : null}
                      onPlay={() => onPlay(item)}
                      onOpenDetail={item.kind !== 'live' ? () => onOpenDetail(item) : undefined}
                      onToggleFavorite={() => onToggleFavorite(item)}
                    />
                    {multiSource ? (
                      <p className="truncate px-1 text-[10px] text-muted-foreground">{item.playlistTitle}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
