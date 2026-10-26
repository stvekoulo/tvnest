// Barre supérieure native TVNest (frameless) avec contrôles @beui, thème OLED/Clair et recherche.
import { Loader2, Maximize2, Minimize2, Minus, Plus, Search, Square, Tv, X } from 'lucide-react';
import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import { ThemeToggle } from '@/components/motion/theme-toggle';
import { toggleAppFullscreen, useAppFullscreen } from '@/lib/app-fullscreen';
import { t, type UiLanguage } from '@/lib/i18n';
import { controlNativeWindow } from '@/services/ipc-system.service';
import type { UnifiedPlaylist } from '@/types/iptv.types';

interface WindowTitlebarProps {
  isElectron: boolean;
  playlists: UnifiedPlaylist[];
  activePlaylist: UnifiedPlaylist | null;
  onSelectPlaylist: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  /** Le champ de recherche perd le focus. */
  onSearchBlur?: () => void;
  syncLabel: string | null;
  uiLanguage: UiLanguage;
  onOpenAddSource: () => void;
}

export function WindowTitlebar({
  isElectron,
  playlists,
  activePlaylist,
  onSelectPlaylist,
  searchQuery,
  onSearchChange,
  onSearchBlur,
  syncLabel,
  uiLanguage,
  onOpenAddSource,
}: WindowTitlebarProps) {
  const fullscreen = useAppFullscreen();
  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 select-none sm:px-5"
    >
      {/* Sélecteur @beui/select de la source IPTV active avec compteurs SQLite */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {/* Se rétrécit sur une fenêtre étroite pour laisser la place aux boutons. */}
        <div className="min-w-0 max-w-72 flex-1 lg:w-72 lg:flex-none">
          <Select
            value={activePlaylist?.id || ''}
            onValueChange={onSelectPlaylist}
            disabled={playlists.length === 0}
          >
            <SelectTrigger className="rounded-full">
              <Tv className="size-3.5 shrink-0 text-primary" />
              <SelectValue placeholder={t(uiLanguage, 'noPlaylist')} />
            </SelectTrigger>
            <SelectContent>
              {playlists.map((pl) => (
                <SelectItem key={pl.id} value={pl.id}>
                  {`${pl.title} (${pl.channelCount.toLocaleString('fr-FR')})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {syncLabel ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[11px] font-medium text-primary">
            <Loader2 className="size-3 animate-spin" />
            {syncLabel}
          </span>
        ) : null}
      </div>

      {/* Recherche globale @beui/input + Thème OLED/Clair + Fenêtre */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex shrink-0 items-center gap-1.5 sm:gap-2.5"
      >
        <div className="hidden w-64 md:block lg:w-72">
          <Input
            value={searchQuery}
            onChange={onSearchChange}
            onBlur={onSearchBlur}
            placeholder={t(uiLanguage, 'searchPlaceholder')}
            leftIcon={<Search />}
            classNames={{ field: 'rounded-full' }}
            rightIcon={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="rounded-full p-1 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>

        <ThemeToggle className="rounded-full" />

        <Button size="sm" variant="primary" ripple onClick={onOpenAddSource}>
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">{t(uiLanguage, 'addSource')}</span>
        </Button>

        <button
          type="button"
          aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          title={fullscreen ? 'Quitter le plein écran (F11)' : 'Plein écran (F11)'}
          onClick={() => void toggleAppFullscreen()}
          className="hidden size-8 items-center sm:inline-flex justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>

        {isElectron ? (
          <div className="ml-1 flex items-center gap-1 border-l border-border pl-2.5">
            <button
              type="button"
              aria-label="Réduire"
              onClick={() => controlNativeWindow('minimize')}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Agrandir"
              onClick={() => controlNativeWindow('maximize')}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Square className="size-3" />
            </button>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => controlNativeWindow('close')}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-rose-600 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
