// Historique, mis en page comme l'Accueil : grande tuile « Reprendre », chaînes récentes,
// puis une rangée par type (films, séries, chaînes) avec la progression de chaque titre.
import { History, Play, Radio } from 'lucide-react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { MediaRailSection } from '@/components/views/media-rail-section';
import { formatClock, shouldOfferResume } from '@/lib/resume-point';
import type { EpgProgram, UnifiedMedia } from '@/types/iptv.types';

interface HistoryViewProps {
  items: UnifiedMedia[];
  epgByChannel: Record<string, EpgProgram | null>;
  onPlay: (item: UnifiedMedia, expand?: boolean) => void;
  onOpenDetail: (item: UnifiedMedia) => void;
  onToggleFavorite: (item: UnifiedMedia) => void;
}

const RAIL_LIMIT = 20;

function progressOf(item: UnifiedMedia): number | null {
  if (!item.progressSeconds || !item.durationSeconds) return null;
  return Math.min(100, (item.progressSeconds / item.durationSeconds) * 100);
}

export function HistoryView({ items, epgByChannel, onPlay, onOpenDetail, onToggleFavorite }: HistoryViewProps) {
  const open = (item: UnifiedMedia, expand: boolean) =>
    item.kind === 'series' ? onOpenDetail(item) : onPlay(item, expand);

  // Le titre le plus récent encore entamé, sinon le dernier film ou série ouvert.
  const vod = items.filter((i) => i.kind !== 'live');
  const resumeItem =
    vod.find((i) => i.progressSeconds && shouldOfferResume(i.progressSeconds, i.durationSeconds)) ?? vod[0] ?? null;
  const resumeProgress = resumeItem ? progressOf(resumeItem) : null;
  const channels = items.filter((i) => i.kind === 'live');
  const rails = [
    { title: 'Films', items: items.filter((i) => i.kind === 'movie') },
    { title: 'Séries', items: items.filter((i) => i.kind === 'series') },
    { title: 'Chaînes', items: channels },
  ].filter((rail) => rail.items.length > 0);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-5 sm:space-y-10 sm:px-6 sm:py-7 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Historique</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {items.length > 0
            ? `${items.length} titre(s) regardé(s) récemment, du plus récent au plus ancien.`
            : 'Vos films, séries et chaînes regardés apparaîtront ici.'}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-border bg-card p-6 text-center">
          <History className="size-6 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Aucune lecture récente</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Lancez une chaîne, un film ou un épisode : vous le retrouverez ici pour reprendre.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {resumeItem ? (
            <button
              type="button"
              onClick={() => open(resumeItem, true)}
              className="group relative col-span-12 h-[240px] overflow-hidden rounded-[28px] border border-border bg-black p-6 text-left text-white shadow-lg lg:col-span-7"
            >
              <MediaArtwork
                src={resumeItem.backdropUrl || resumeItem.posterUrl}
                title={resumeItem.title}
                kind={resumeItem.kind}
                className="absolute inset-0 h-full w-full bg-black opacity-60"
                imgClassName="transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/30" />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Reprendre</span>
                  <h2 className="mt-1.5 truncate font-display text-xl font-bold">{resumeItem.title}</h2>
                  <p className="truncate text-xs text-zinc-300">{resumeItem.category}</p>
                </div>
                <div>
                  <div className="mb-2.5 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Play className="size-3.5 fill-current text-white" />
                      {resumeItem.kind === 'series' ? 'Voir les épisodes' : 'Reprendre en mode Cinéma'}
                    </span>
                    {resumeItem.progressSeconds && resumeItem.kind !== 'series' ? (
                      <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[10px] font-semibold">
                        {formatClock(resumeItem.progressSeconds)}
                        {resumeItem.durationSeconds ? ` / ${formatClock(resumeItem.durationSeconds)}` : ''}
                      </span>
                    ) : null}
                  </div>
                  {resumeProgress !== null ? (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white" style={{ width: `${resumeProgress}%` }} />
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          ) : null}

          <div
            className={`col-span-12 flex h-[240px] flex-col rounded-[28px] border border-border bg-card p-6 ${
              resumeItem ? 'lg:col-span-5' : ''
            }`}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chaînes récentes</h3>
            {channels.length === 0 ? (
              <div className="my-auto flex flex-col items-center gap-2 text-center">
                <Radio className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Aucune chaîne regardée récemment.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-1">
                {channels.slice(0, 3).map((ch) => {
                  const now = ch.tvgId ? epgByChannel[ch.tvgId] : null;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => onPlay(ch, false)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-elevated"
                    >
                      <div className="size-9 shrink-0 overflow-hidden rounded-lg border border-border bg-elevated">
                        <MediaArtwork src={ch.posterUrl} title={ch.title} kind="live" fit="contain" className="h-full w-full" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">{ch.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{now?.title || ch.category}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {rails.map((rail) => (
        <MediaRailSection
          key={rail.title}
          title={rail.title}
          items={rail.items.slice(0, RAIL_LIMIT)}
          epgByChannel={epgByChannel}
          onPlay={(item) => onPlay(item, false)}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
          fixedCardWidth
        />
      ))}
    </div>
  );
}
