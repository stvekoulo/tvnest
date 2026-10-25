// Grille des programmes XMLTV d'une chaîne : jours, émission en cours, vignettes.
import { Tv } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { cn, stripEmoji } from '@/lib/utils';
import type { EpgProgram } from '@/types/iptv.types';

type EpgListProgram = EpgProgram & { channelName?: string | null };

const timeFmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function dayLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const today = new Date(now);
  const diffDays = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000
  );
  if (diffDays === 0) return 'Aujourd’hui';
  if (diffDays === 1) return 'Demain';
  if (diffDays === -1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function programProgress(prog: EpgProgram, now: number): number | null {
  const start = Date.parse(prog.start);
  const stop = Date.parse(prog.stop);
  if (!(start <= now && now < stop)) return null;
  return Math.round(((now - start) / (stop - start)) * 100);
}

interface EpgProgramListProps {
  programs: EpgListProgram[];
  now: number;
  /** Résultats de recherche : on affiche la chaîne et on garde le passé. */
  searchMode?: boolean;
  onSelectProgram?: (prog: EpgListProgram) => void;
}

export function EpgProgramList({ programs, now, searchMode = false, onSelectProgram }: EpgProgramListProps) {
  const currentRef = useRef<HTMLDivElement | null>(null);
  // Grille d'une chaîne : on masque ce qui est terminé, l'émission en cours ouvre la liste.
  const visible = (searchMode ? programs : programs.filter((p) => Date.parse(p.stop) > now))
    .slice()
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const firstId = visible[0] ? `${visible[0].channel}-${visible[0].start}` : '';

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [firstId]);

  if (visible.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1.5 text-center">
        <Tv className="size-7 text-muted-foreground" />
        <p className="text-xs font-semibold text-foreground">Aucun programme à venir</p>
        <p className="max-w-sm text-[11px] text-muted-foreground">
          Synchronisez une source XMLTV dont les identifiants correspondent aux tvg-id de vos chaînes.
        </p>
      </div>
    );
  }

  let lastDay = '';
  return (
    <div className="space-y-2.5">
      {visible.map((prog, index) => {
        const day = dayLabel(prog.start, now);
        const showDay = day !== lastDay;
        lastDay = day;
        const progress = programProgress(prog, now);
        return (
          <div key={`${prog.channel}-${prog.start}`}>
            {showDay ? (
              <h3
                className={cn(
                  'mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
                  index > 0 && 'mt-5'
                )}
              >
                {day}
              </h3>
            ) : null}
            <div
              ref={progress !== null ? currentRef : undefined}
              role={onSelectProgram ? 'button' : undefined}
              tabIndex={onSelectProgram ? 0 : undefined}
              onClick={onSelectProgram ? () => onSelectProgram(prog) : undefined}
              onKeyDown={
                onSelectProgram
                  ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelectProgram(prog)
                  : undefined
              }
              className={cn(
                'flex gap-3.5 rounded-2xl border p-3.5',
                progress !== null ? 'border-foreground/25 bg-elevated' : 'border-border bg-card',
                onSelectProgram && 'cursor-pointer hover:border-foreground/25'
              )}
            >
              {prog.iconUrl ? (
                <MediaArtwork
                  src={prog.iconUrl}
                  title={prog.title}
                  kind="movie"
                  monogramSize="sm"
                  className="hidden aspect-video w-28 shrink-0 rounded-xl border border-border sm:block"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {timeFmt(prog.start)} – {timeFmt(prog.stop)}
                  </span>
                  {progress !== null ? (
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                      En cours
                    </span>
                  ) : null}
                  {prog.category ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {prog.category}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm font-bold text-foreground">{stripEmoji(prog.title)}</p>
                {searchMode && prog.channelName ? (
                  <p className="truncate text-[11px] text-muted-foreground">{stripEmoji(prog.channelName)}</p>
                ) : null}
                {prog.desc ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{prog.desc}</p>
                ) : null}
                {progress !== null ? (
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-foreground" style={{ width: `${progress}%` }} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
