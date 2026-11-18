// Lecteur unique de l'application, déplacé dans le DOM entre <PlayerSlot> et le mode Cinéma.
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

const UNMOUNT_GRACE_MS = 200;

interface SlotInfo {
  el: HTMLElement;
  compact: boolean;
}

let ownsFullscreen = false;
let fullscreenChain: Promise<unknown> = Promise.resolve();

/** À appeler dans le clic qui ouvre le Cinéma (le mode Web exige un geste utilisateur). */
export function requestAppFullscreen(): void {
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
  fullscreenChain = fullscreenChain
    .then(async () => {
      if (!ownsFullscreen) return;
      const already = await isAppFullscreen();
      if (already) {
        ownsFullscreen = false;
        return;
      }
      await window.electron.toggleFullScreenWindow();
    })
    .catch(() => {
      ownsFullscreen = false;
    });
}

function releaseAppFullscreen(): void {
  if (!ownsFullscreen) return;
  ownsFullscreen = false;
  if (!hasNativeWindowFullscreen()) {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return;
  }
  fullscreenChain = fullscreenChain
    .then(async () => {
      if (ownsFullscreen) return;
      const on = await isAppFullscreen();
      if (on) await window.electron.toggleFullScreenWindow();
    })
    .catch(() => {});
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
  embeddedMpvEnabled?: boolean;
  theaterOpen: boolean;
  onTheaterChange: (open: boolean) => void;
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
  embeddedMpvEnabled = true,
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

  const openTheater = useCallback(() => {
    requestAppFullscreen();
    onTheaterChange(true);
  }, [onTheaterChange]);
  useEffect(() => {
    if (theaterOpen) requestAppFullscreen();
    else releaseAppFullscreen();
  }, [theaterOpen]);

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
              preferWebEngine={!embeddedMpvEnabled}
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
