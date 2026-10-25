// Composant d'affiche résilient (no-referrer + monogramme élégant sans icône cassée).
import { Clapperboard, Film, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { StreamKind } from '@/types/iptv.types';

interface MediaArtworkProps {
  src?: string | null;
  /** Image essayée si `src` est absente ou ne se charge pas (ex. logo XMLTV). */
  fallbackSrc?: string | null;
  title: string;
  kind?: StreamKind;
  fit?: 'cover' | 'contain';
  className?: string;
  imgClassName?: string;
  monogramSize?: 'sm' | 'md' | 'lg';
}

function computeMonogram(title: string): string {
  const cleaned = title
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\b(FR|EN|ES|AR|DE|IT|PT|FHD|HD|UHD|4K|HEVC|VIP)\b/gi, ' ')
    .trim();
  const words = (cleaned || title).split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }
  return (words[0] || 'TV').slice(0, 2).toUpperCase();
}

export function MediaArtwork({
  src,
  fallbackSrc,
  title,
  kind = 'movie',
  fit = 'cover',
  className,
  imgClassName,
  monogramSize = 'md',
}: MediaArtworkProps) {
  const candidates = [src, fallbackSrc]
    .map((u) => u?.trim() || '')
    .filter((u) => u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:'));
  const candidatesKey = candidates.join('|');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [candidatesKey]);

  const trimmed = candidates[attempt] || '';
  const showFallback = !trimmed;
  const Icon = kind === 'live' ? Radio : kind === 'series' ? Clapperboard : Film;
  const monogram = computeMonogram(title);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-elevated select-none',
        className
      )}
    >
      {!showFallback ? (
        <img
          src={trimmed}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setAttempt((a) => a + 1)}
          className={cn(
            'h-full w-full transition-transform duration-500',
            fit === 'contain' ? 'object-contain p-3' : 'object-cover',
            imgClassName
          )}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_65%)] p-3 text-center">
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card/80 px-3 py-2 shadow-sm">
            <span
              className={cn(
                'font-display font-extrabold tracking-tight text-foreground/90',
                monogramSize === 'sm'
                  ? 'text-xs'
                  : monogramSize === 'lg'
                    ? 'text-2xl'
                    : 'text-base'
              )}
            >
              {monogram}
            </span>
          </div>
          {monogramSize !== 'sm' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Icon className="size-3 text-primary/80" />
              {kind === 'live' ? 'Direct' : kind === 'series' ? 'Série' : 'VOD'}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
