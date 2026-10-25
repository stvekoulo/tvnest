// Rail horizontal/grille de cartes médias TVNest réutilisable sur le tableau de bord.
import { ChevronRight } from 'lucide-react';
import { MediaSquircleCard } from '@/components/cards/media-squircle-card';
import type { EpgProgram, UnifiedMedia } from '@/types/iptv.types';

interface MediaRailSectionProps {
  title: string;
  onSeeAll: () => void;
  items: UnifiedMedia[];
  epgByChannel: Record<string, EpgProgram | null>;
  onPlay: (item: UnifiedMedia) => void;
  onOpenDetail: (item: UnifiedMedia) => void;
  onToggleFavorite: (item: UnifiedMedia) => void;
}

export function MediaRailSection({
  title,
  onSeeAll,
  items,
  epgByChannel,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
}: MediaRailSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
        >
          Voir tout
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      {/* Une seule ligne : colonnes égales, défilement horizontal si l'espace manque. */}
      <div className="grid auto-cols-[minmax(150px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-1 sm:gap-5">
        {items.map((item) => (
          <MediaSquircleCard
            key={item.id}
            item={item}
            epg={item.tvgId ? epgByChannel[item.tvgId] : null}
            onPlay={() => onPlay(item)}
            onOpenDetail={item.kind !== 'live' ? () => onOpenDetail(item) : undefined}
            onToggleFavorite={() => onToggleFavorite(item)}
          />
        ))}
      </div>
    </section>
  );
}
