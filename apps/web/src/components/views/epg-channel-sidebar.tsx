// Colonne latérale des chaînes Live TV du guide EPG TVNest avec recherche et barre d'émission en cours.
import { Search } from 'lucide-react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { Input } from '@/components/motion/input';
import { programProgress } from '@/components/views/epg-program-list';
import { cn } from '@/lib/utils';
import type { EpgProgram, UnifiedMedia } from '@/types/iptv.types';

interface EpgChannelSidebarProps {
  totalLiveCount: number;
  coveredCount: number;
  channelQuery: string;
  onChannelQueryChange: (q: string) => void;
  channels: Array<{ ch: UnifiedMedia; key: string }>;
  selectedKey?: string;
  covered: Set<string>;
  icons: Record<string, string | null>;
  nowPlaying: Record<string, EpgProgram | null>;
  now: number;
  onSelectChannel: (key: string) => void;
}

export function EpgChannelSidebar({
  totalLiveCount,
  coveredCount,
  channelQuery,
  onChannelQueryChange,
  channels,
  selectedKey,
  covered,
  icons,
  nowPlaying,
  now,
  onSelectChannel,
}: EpgChannelSidebarProps) {
  return (
    <div className="col-span-12 flex max-h-[45vh] flex-col overflow-hidden rounded-[26px] border border-border bg-card p-3 lg:col-span-4 lg:max-h-none">
      <div className="mb-2 space-y-2 px-1">
        <h2 className="pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Chaînes ({totalLiveCount.toLocaleString('fr-FR')}) · {coveredCount.toLocaleString('fr-FR')} avec guide
        </h2>
        <Input
          value={channelQuery}
          onChange={onChannelQueryChange}
          placeholder="Filtrer les chaînes..."
          leftIcon={<Search />}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {channels.slice(0, 600).map(({ ch, key }) => {
          const active = selectedKey === key;
          const current = nowPlaying[key];
          const progress = current ? programProgress(current, now) : null;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSelectChannel(key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                active ? 'bg-elevated' : 'hover:bg-elevated',
                !covered.has(key) && 'opacity-60'
              )}
            >
              <MediaArtwork
                src={ch.posterUrl}
                fallbackSrc={icons[key]}
                title={ch.title}
                kind="live"
                fit="contain"
                monogramSize="sm"
                className="size-9 shrink-0 rounded-lg border border-border bg-black"
              />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-xs text-foreground', active && 'font-bold')}>
                  {ch.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {current ? current.title : covered.has(key) ? 'Programme à venir' : 'Pas de guide'}
                </span>
                {progress !== null ? (
                  <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-border">
                    <span className="block h-full bg-foreground/70" style={{ width: `${progress}%` }} />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
