// Lecteur unique de l'application. Il est monté une seule fois puis déplacé dans le DOM
// (sans être recréé) entre l'emplacement actif (<PlayerSlot>) et le mode Cinéma plein écran :
// aucun rechargement du flux ni retour au début quand on change de vue.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { PLAYER_MOVED_EVENT, StreamSurface } from '@/components/player/stream-surface';
import { cn } from '@/lib/utils';
import { hasNativeWindowFullscreen, isAppFullscreen } from '@/lib/app-fullscreen';
import type { UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

// Délai avant de démonter le lecteur quand plus aucun emplacement n'est affiché : laisse
// le temps à la vue suivante de monter le sien (fermeture du Cinéma, changement de page).
const UNMOUNT_GRACE_MS = 200;

interface SlotInfo {
  el: HTMLElement;
  /** Aperçu sans console (la carte hôte dessine ses propres contrôles). */
  compact: boolean;
}

// Plein écran pour le mode Cinéma (voir lib/app-fullscreen).
// `ownsFullscreen` : on ne quitte que le plein écran que le Cinéma a lui-même activé
// (une fenêtre déjà en plein écran via F11 le reste à la fermeture du Cinéma).
let ownsFullscreen = false;

/** À appeler dans le clic qui ouvre le Cinéma (le mode Web exige un geste utilisateur). */
export function requestAppFullscreen(): void {
  // Le clic et l'effet de secours appellent tous deux cette fonction : une seule demande,
  // sinon deux bascules natives se succèdent et la fenêtre revient à son état initial.
  if (ownsFullscreen) return;
  ownsFullscreen = true;
  if (!hasNativeWindowFullscreen()) {
    if (document.fullscreenElement) {
      ownsFullscreen = false;
      return;
    }
    document.documentElement.requestFullscreen?.().catch(() => {
      ownsFullscreen = false;
    });
    return;
  }
  void isAppFullscreen().then((already) => {
    if (already) {
      ownsFullscreen = false;
      return;
    }
    return window.electron.toggleFullScreenWindow();
  });
}

function releaseAppFullscreen(): void {
  if (!ownsFullscreen) return;
  ownsFullscreen = false;
  if (!hasNativeWindowFullscreen()) {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return;
  }
  void isAppFullscreen().then((on) => (on ? window.electron.toggleFullScreenWindow() : undefined));
}

type RegisterSlot = (slot: SlotInfo | null, el?: HTMLElement) => void;
const SlotContext = createContext<RegisterSlot>(() => {});

export function PlayerSlot({ compact = true, className }: { compact?: boolean; className?: string }) {
  const register = useContext(SlotContext);
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    register({ el, compact });
    return () => register(null, el);
  }, [register, compact]);
  return <div ref={ref} className={cn('h-full w-full', className)} />;
}

interface PlayerHostProps {
  media: UnifiedMedia | null;
  playlist?: UnifiedPlaylist | null;
  playing: boolean;
  onPlayingChange: (v: boolean) => void;
  theaterOpen: boolean;
  onTheaterChange: (open: boolean) => void;
  /** Croix du lecteur (Cinéma ou fiche film/série) : arrête la lecture partout. */
  onStop: () => void;
  onOpenExternal: (player: 'mpv' | 'vlc', item: UnifiedMedia, positionSeconds: number) => void;
  nextEpisode: UnifiedMedia | null;
  onPlayNext: () => void;
  children: ReactNode;
}

export function PlayerHost({
  media,
  playlist,
  playing,
  onPlayingChange,
  theaterOpen,
  onTheaterChange,
  onStop,
  onOpenExternal,
  nextEpisode,
  onPlayNext,
  children,
}: PlayerHostProps) {
  const node = useMemo(() => {
    const el = document.createElement('div');
    el.className = 'h-full w-full';
    return el;
  }, []);
  const [slot, setSlot] = useState<SlotInfo | null>(null);
  const [theaterEl, setTheaterEl] = useState<HTMLDivElement | null>(null);
  const register = useCallback<RegisterSlot>(
    (info, el) => setSlot((prev) => (info ? info : prev?.el === el ? null : prev)),
    []
  );

  const target = theaterOpen ? theaterEl : (slot?.el ?? null);
  const wanted = Boolean(media) && (theaterOpen || slot !== null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (wanted) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), UNMOUNT_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [wanted]);

  useLayoutEffect(() => {
    if (!target || node.parentElement === target) return;
    target.appendChild(node);
    window.dispatchEvent(new Event(PLAYER_MOVED_EVENT));
  }, [target, node]);

  // Le mode Cinéma est le vrai plein écran de la fenêtre ; en sortir (Échap, F, bouton) le
  // referme. La demande part du clic lui-même (geste utilisateur exigé par le navigateur) ;
  // l'effet couvre les ouvertures déclenchées par le code (lecture lancée en Cinéma).
  const openTheater = useCallback(() => {
    requestAppFullscreen();
    onTheaterChange(true);
  }, [onTheaterChange]);
  useEffect(() => {
    if (theaterOpen) requestAppFullscreen();
  }, [theaterOpen]);
  useEffect(() => {
    if (!theaterOpen) releaseAppFullscreen();
  }, [theaterOpen]);
  // Sortie du plein écran par l'utilisateur (Échap, F11, système) : le Cinéma se referme.
  useEffect(() => {
    const onExit = () => {
      if (!ownsFullscreen) return;
      ownsFullscreen = false;
      onTheaterChange(false);
    };
    const onDocChange = () => {
      if (!document.fullscreenElement) onExit();
    };
    document.addEventListener('fullscreenchange', onDocChange);
    const unsubWindow = hasNativeWindowFullscreen()
      ? window.electron.onWindowStateChange?.((s) => {
          if (!s.isFullScreen) onExit();
        })
      : undefined;
    return () => {
      document.removeEventListener('fullscreenchange', onDocChange);
      unsubWindow?.();
    };
  }, [onTheaterChange]);

  const inlineFull = !theaterOpen && slot !== null && !slot.compact;

  return (
    <SlotContext.Provider value={register}>
      {children}
      {theaterOpen ? <div ref={setTheaterEl} className="fixed inset-0 z-50 bg-black" /> : null}
      {mounted && media
        ? createPortal(
            <StreamSurface
              media={media}
              playlist={playlist}
              playing={playing}
              onPlayingChange={onPlayingChange}
              compact={!theaterOpen && (slot?.compact ?? true)}
              onExpandTheater={theaterOpen ? undefined : openTheater}
              onCloseTheater={theaterOpen ? () => onTheaterChange(false) : undefined}
              onStop={theaterOpen || inlineFull ? onStop : undefined}
              onOpenExternal={(player, position) => onOpenExternal(player, media, position)}
              nextEpisode={nextEpisode}
              onPlayNext={onPlayNext}
            />,
            node
          )
        : null}
    </SlotContext.Provider>
  );
}
