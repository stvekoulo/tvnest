// Rangée haute Bento TVNest (Spotlight avec affiches valides + Catégories SQLite + Onboarding).
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Globe,
  Heart,
  Info,
  Play,
  Server,
  Star,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { ActionSwapIcon } from '@/components/motion/action-swap';
import { Button } from '@/components/motion/button/base';
import { TvNestLogo } from '@/components/shell/tvnest-logo';
import { EASE_OUT } from '@/lib/ease';
import { t, type UiLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type {
  AppSection,
  UnifiedCategory,
  UnifiedMedia,
} from '@/types/iptv.types';

export function EmptyOnboardingState({
  onOpenAddSource,
}: {
  onOpenAddSource: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center p-8">
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-[32px] border border-border bg-card p-10 shadow-2xl">
        <TvNestLogo size="lg" showWordmark subtitle="Universal IPTV & Cinema Hub" />
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-foreground">
          Connectez votre première source IPTV
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Aucune donnée fictive n’est chargée. Connectez une playlist M3U8, un fichier
          local, un serveur Xtream Codes ou un portail Stalker MAC pour alimenter le
          catalogue SQLite, le guide EPG et le lecteur intégré TVNest Cinema (libmpv).
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={onOpenAddSource}
            className="flex flex-col items-start gap-2 rounded-[24px] border border-border bg-elevated p-5 text-left transition-colors hover:border-primary/50"
          >
            <Globe className="size-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Playlist M3U / URL</span>
            <span className="text-xs text-muted-foreground">
              Lien distant .m3u / .m3u8 ou texte brut
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAddSource}
            className="flex flex-col items-start gap-2 rounded-[24px] border border-border bg-elevated p-5 text-left transition-colors hover:border-primary/50"
          >
            <Server className="size-5 text-foreground" />
            <span className="text-sm font-bold text-foreground">Xtream & Stalker</span>
            <span className="text-xs text-muted-foreground">
              Live TV, Films VOD, Séries & Saisons SQLite
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAddSource}
            className="flex flex-col items-start gap-2 rounded-[24px] border border-border bg-elevated p-5 text-left transition-colors hover:border-primary/50"
          >
            <FolderOpen className="size-5 text-foreground" />
            <span className="text-sm font-bold text-foreground">Fichier M3U Local</span>
            <span className="text-xs text-muted-foreground">
              Ouverture directe depuis votre disque
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface DashboardHeroRowProps {
  spotlight: UnifiedMedia[];
  categories: UnifiedCategory[];
  totalStreamCount: number;
  onSelectCat: (cat: UnifiedCategory) => void;
  onPlay: (item: UnifiedMedia, expand?: boolean) => void;
  onOpenDetail: (item: UnifiedMedia) => void;
  onToggleFavorite: (item: UnifiedMedia) => void;
  onNavigateSection: (sec: AppSection) => void;
  uiLanguage: UiLanguage;
}

const HERO_AUTOPLAY_MS = 7000;

export function DashboardHeroRow({
  spotlight,
  categories,
  totalStreamCount,
  onSelectCat,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  onNavigateSection,
  uiLanguage,
}: DashboardHeroRowProps) {
  const reduceMotion = useReducedMotion();
  const [heroIdx, setHeroIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const pool = spotlight.slice(0, 8);
  const count = pool.length;
  const index = count > 0 ? heroIdx % count : 0;
  const heroItem = pool[index];
  const browseCats = categories.slice(0, 4);
  const autoplay = count > 1 && !hovered && !focused && !reduceMotion;

  const goTo = useCallback(
    (delta: number) => setHeroIdx((i) => (i + delta + count) % Math.max(1, count)),
    [count]
  );

  // Le minuteur dépend de `index` : toute navigation manuelle le relance de zéro.
  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => goTo(1), HERO_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, goTo]);

  return (
    <div className="grid grid-cols-12 gap-5">
      <section
        aria-roledescription="carrousel"
        aria-label="À la une"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') goTo(-1);
          else if (e.key === 'ArrowRight') goTo(1);
        }}
        className="relative col-span-12 h-[300px] overflow-hidden rounded-[28px] border border-border bg-black text-white shadow-xl sm:h-[340px] lg:col-span-8"
      >
        <AnimatePresence initial={false}>
          {heroItem ? (
            <motion.div
              key={heroItem.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.6, ease: EASE_OUT }}
              className="absolute inset-0"
            >
              <MediaArtwork
                src={heroItem.backdropUrl || heroItem.posterUrl}
                title={heroItem.title}
                kind={heroItem.kind}
                monogramSize="lg"
                className="h-full w-full bg-black opacity-85"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/25" />

        {heroItem ? (
          <>
            <div className="absolute inset-x-5 top-5 flex flex-wrap items-center justify-between gap-2 sm:inset-x-7 sm:top-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
                  <span className="size-1.5 rounded-full bg-foreground" />
                  {heroItem.playlistTitle}
                </span>
                <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
                  {heroItem.category}
                </span>
              </div>

              {heroItem.rating && Number(heroItem.rating) > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                  <Star className="size-3 fill-current" />
                  {Number(heroItem.rating).toFixed(1)}
                </span>
              ) : null}
            </div>

            <div className="absolute inset-x-5 bottom-5 flex flex-col items-start gap-4 sm:inset-x-7 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0 max-w-xl">
                <h1 className="line-clamp-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {heroItem.title}
                </h1>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="primary"
                    ripple
                    onClick={() =>
                      heroItem.kind === 'series'
                        ? onOpenDetail(heroItem)
                        : onPlay(heroItem, true)
                    }
                  >
                    <Play className="size-3.5 fill-current" />
                    {t(uiLanguage, 'watchNow')}
                  </Button>

                  {heroItem.kind !== 'live' ? (
                    <Button variant="glass" onClick={() => onOpenDetail(heroItem)}>
                      <Info className="size-3.5" />
                      Fiche complète
                    </Button>
                  ) : null}

                  <button
                    type="button"
                    aria-label={heroItem.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    onClick={() => onToggleFavorite(heroItem)}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md hover:bg-white/15"
                  >
                    <ActionSwapIcon value={heroItem.isFavorite ? 'fav' : 'idle'} className="size-4">
                      <Heart
                        className={cn(
                          'size-4',
                          heroItem.isFavorite && 'fill-current text-foreground'
                        )}
                      />
                    </ActionSwapIcon>
                  </button>
                </div>
              </div>

              {count > 1 ? (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    aria-label="Précédent"
                    onClick={() => goTo(-1)}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-white/15"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <div className="hidden items-center gap-1.5 sm:flex">
                    {pool.map((sp, idx) => (
                      <button
                        key={sp.id}
                        type="button"
                        aria-label={`Aller à l’élément ${idx + 1} sur ${count}`}
                        aria-current={idx === index ? 'true' : undefined}
                        onClick={() => setHeroIdx(idx)}
                        className={cn(
                          'relative h-1.5 overflow-hidden rounded-full transition-[width,background-color] duration-300',
                          idx === index ? 'w-7 bg-white/30' : 'w-1.5 bg-white/35 hover:bg-white/60'
                        )}
                      >
                        {idx === index ? (
                          <motion.span
                            key={`${heroItem.id}-${autoplay}`}
                            className="absolute inset-0 origin-left rounded-full bg-white"
                            initial={{ scaleX: autoplay ? 0 : 1 }}
                            animate={{ scaleX: 1 }}
                            transition={{
                              duration: autoplay ? HERO_AUTOPLAY_MS / 1000 : 0,
                              ease: 'linear',
                            }}
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Suivant"
                    onClick={() => goTo(1)}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-white/15"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      {/* Groupes de la source active avec compteurs réels */}
      <div className="col-span-12 flex flex-col gap-4 rounded-[28px] border border-border bg-card p-6 lg:col-span-4 lg:h-[340px]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-foreground">
              Groupes actifs
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {categories.length.toLocaleString('fr-FR')} groupes
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
            {browseCats.map((cat) => {
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCat(cat)}
                  className="flex w-full items-center justify-between rounded-2xl border border-transparent bg-elevated px-3.5 py-2 text-left text-foreground transition-colors hover:border-border"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-bold">{cat.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cat.count !== undefined
                        ? `${cat.count.toLocaleString('fr-FR')} flux · ${cat.type.toUpperCase()}`
                        : cat.type.toUpperCase()}
                    </p>
                  </div>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={() => onNavigateSection('movies')}
          className="w-full shrink-0 font-bold uppercase tracking-wider"
        >
          Explorer le catalogue ({totalStreamCount.toLocaleString('fr-FR')})
        </Button>
      </div>
    </div>
  );
}
