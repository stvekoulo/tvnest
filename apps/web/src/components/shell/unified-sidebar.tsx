// Barre latérale TVNest avec logo officiel 3D, ressort @beui et contraste Noir Absolu OLED.
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Download,
  Film,
  Heart,
  Home,
  Layers,
  Radio,
  Settings,
} from 'lucide-react';
import { motion } from 'motion/react';
import { TvNestLogo } from '@/components/shell/tvnest-logo';
import { t, type TranslationKey, type UiLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { AppSection } from '@/types/iptv.types';

interface UnifiedSidebarProps {
  section: AppSection;
  onSelectSection: (sec: AppSection) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  uiLanguage: UiLanguage;
  counts: {
    playlists: number;
    favorites: number;
    downloads: number;
  };
}

const MAIN_NAV: Array<{
  id: AppSection;
  labelKey: TranslationKey;
  icon: typeof Home;
  badgeKey?: 'playlists' | 'favorites' | 'downloads';
}> = [
  { id: 'dashboard', labelKey: 'dashboard', icon: Home },
  { id: 'live', labelKey: 'live', icon: Radio },
  { id: 'movies', labelKey: 'movies', icon: Film },
  { id: 'series', labelKey: 'series', icon: Clapperboard },
  { id: 'epg', labelKey: 'epg', icon: CalendarRange },
  { id: 'favorites', labelKey: 'favorites', icon: Heart, badgeKey: 'favorites' },
  { id: 'history', labelKey: 'history', icon: Clock },
  { id: 'downloads', labelKey: 'downloads', icon: Download, badgeKey: 'downloads' },
  { id: 'playlists', labelKey: 'playlists', icon: Layers, badgeKey: 'playlists' },
];

export function UnifiedSidebar({
  section,
  onSelectSection,
  collapsed,
  onToggleCollapsed,
  uiLanguage,
  counts,
}: UnifiedSidebarProps) {
  if (collapsed) {
    return (
      <aside className="relative flex w-[72px] shrink-0 flex-col items-center justify-between border-r border-border bg-surface py-5 select-none">
        <div className="flex w-full flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectSection('dashboard')}
            title="TVNest"
            className="rounded-xl p-1 transition-transform hover:scale-105"
          >
            <TvNestLogo size="sm" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Déplier le menu"
            title="Déplier le menu"
            className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-elevated text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>

          <div className="h-px w-8 bg-border" />

          <nav className="flex flex-col items-center gap-1.5">
            {MAIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={t(uiLanguage, item.labelKey)}
                  onClick={() => onSelectSection(item.id)}
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-xl transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                      : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          title={t(uiLanguage, 'settings')}
          onClick={() => onSelectSection('settings')}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-xl transition-colors',
            section === 'settings'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
          )}
        >
          <Settings className="size-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="relative flex w-[228px] shrink-0 flex-col justify-between border-r border-border bg-surface px-4 py-5 select-none">
      <div>
        <div className="mb-6 flex items-center justify-between px-1.5">
          <button
            type="button"
            onClick={() => onSelectSection('dashboard')}
            className="text-left"
          >
            <TvNestLogo size="md" showWordmark subtitle="Cinema & Live Hub" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Réduire en rail compact"
            className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-elevated text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        </div>

        <nav className="space-y-1">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            const badge = item.badgeKey ? counts[item.badgeKey] : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={cn(
                  'relative isolate flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="tvnest-nav-pill"
                    className="absolute inset-0 -z-10 rounded-xl border border-border bg-elevated"
                    transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                  />
                ) : null}

                <span className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'size-4',
                      active ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  {t(uiLanguage, item.labelKey)}
                </span>

                {badge > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => onSelectSection('settings')}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-colors',
            section === 'settings'
              ? 'border border-border bg-elevated font-semibold text-foreground'
              : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
          )}
        >
          <Settings className="size-4" />
          {t(uiLanguage, 'settings')}
        </button>
      </div>
    </aside>
  );
}
