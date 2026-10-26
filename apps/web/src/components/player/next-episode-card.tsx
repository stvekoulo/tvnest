// Carte « Épisode suivant » à la Netflix : apparaît à la fin d'un épisode et enchaîne
// automatiquement le suivant après un décompte.
import { Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import type { UnifiedMedia } from '@/types/iptv.types';

/**
 * Début estimé du générique de fin : 1,5 % de la durée, entre 20 s et 35 s
 * (34:30 → carte à 33:59, enchaînement à 34:04 ; 22:00 → carte à 21:40).
 * ponytail: estimation, les flux Xtream ne donnent pas de marqueur de générique.
 */
export function nextEpisodeLeadSeconds(durationSeconds: number): number {
  return Math.min(35, Math.max(20, Math.round(durationSeconds * 0.015)));
}

export const NEXT_EPISODE_COUNTDOWN_SECONDS = 5;

interface NextEpisodeCardProps {
  next: UnifiedMedia;
  /** Lecture en pause : le décompte s'arrête aussi. */
  paused: boolean;
  onPlayNext: () => void;
  onDismiss: () => void;
}

export function NextEpisodeCard({ next, paused, onPlayNext, onDismiss }: NextEpisodeCardProps) {
  const [remaining, setRemaining] = useState(NEXT_EPISODE_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (remaining <= 0) {
      onPlayNext();
      return;
    }
    if (paused) return;
    const timer = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, paused, onPlayNext]);

  const elapsedPct = ((NEXT_EPISODE_COUNTDOWN_SECONDS - remaining) / NEXT_EPISODE_COUNTDOWN_SECONDS) * 100;

  return (
    <div
      data-tvnest-overlay=""
      role="dialog"
      aria-label="Épisode suivant"
      className="absolute bottom-28 right-6 z-40 w-80 overflow-hidden rounded-2xl border border-white/15 bg-[#0A0A0A]/95 text-white shadow-2xl backdrop-blur-xl"
    >
      <div className="relative aspect-video w-full bg-black">
        <MediaArtwork
          src={next.backdropUrl || next.posterUrl}
          title={next.title}
          kind="episode"
          className="h-full w-full opacity-80"
        />
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Épisode suivant</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-bold">{next.title}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPlayNext}
            className="relative flex-1 overflow-hidden rounded-full bg-white px-3 py-2 text-xs font-bold text-black"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-black/15 transition-[width] duration-1000 ease-linear"
              style={{ width: `${elapsedPct}%` }}
            />
            <span className="relative inline-flex items-center justify-center gap-1.5">
              <Play className="size-3.5 fill-current" />
              Lire maintenant ({remaining})
            </span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Annuler l'épisode suivant automatique"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            <X className="size-3.5" /> Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
