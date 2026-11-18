// Synchronisation géométrique de la surface native libmpv et détection des surcouches DOM.
import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { isElectronRuntime } from '@/services/ipc-playlists.service';

export type Bounds = { x: number; y: number; width: number; height: number };

const HIDDEN_BOUNDS: Bounds = { x: -100000, y: -100000, width: 1, height: 1 };
const OVERLAY_SELECTOR = '[data-tvnest-overlay], [role="listbox"][aria-hidden="false"]';
const POSITION_POLL_MS = 500;

export function boundsDiffer(a: Bounds, b: Bounds): boolean {
  return (
    Math.abs(a.x - b.x) > 0.5 ||
    Math.abs(a.y - b.y) > 0.5 ||
    Math.abs(a.width - b.width) > 0.5 ||
    Math.abs(a.height - b.height) > 0.5
  );
}

export function useDomOverlayActive(enabled: boolean): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    const check = () => setActive(document.querySelector(OVERLAY_SELECTOR) !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'data-tvnest-overlay'],
    });
    return () => observer.disconnect();
  }, [enabled]);
  return active;
}

export function useMpvBoundsSync({
  hostRef,
  sessionIdRef,
  mpvModeRef,
  overlayActive,
  hasError,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  sessionIdRef: MutableRefObject<string | null>;
  mpvModeRef: MutableRefObject<'frame-copy' | 'native' | null>;
  overlayActive: boolean;
  hasError: boolean;
}) {
  const nativeHiddenRef = useRef(false);
  const lastBoundsRef = useRef<Bounds | null>(null);
  const boundsFrameRef = useRef<number | null>(null);

  const measureBounds = useCallback((): Bounds | null => {
    if (mpvModeRef.current === 'native' && nativeHiddenRef.current) return HIDDEN_BOUNDS;
    const el = hostRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null;
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }, [hostRef, mpvModeRef]);

  const syncBounds = useCallback(() => {
    if (boundsFrameRef.current !== null) cancelAnimationFrame(boundsFrameRef.current);
    boundsFrameRef.current = requestAnimationFrame(() => {
      boundsFrameRef.current = null;
      const sid = sessionIdRef.current;
      const bounds = measureBounds();
      if (!sid || !bounds || !isElectronRuntime()) return;
      lastBoundsRef.current = bounds;
      window.electron.setEmbeddedMpvBounds(sid, bounds).catch(() => {});
    });
  }, [measureBounds, sessionIdRef]);

  useEffect(() => {
    nativeHiddenRef.current = overlayActive || hasError;
    syncBounds();
  }, [overlayActive, hasError, syncBounds]);

  const startBoundsTracking = useCallback(() => {
    const host = hostRef.current;
    const resizeObs = new ResizeObserver(() => syncBounds());
    if (host) resizeObs.observe(host);
    window.addEventListener('resize', syncBounds);
    window.addEventListener('scroll', syncBounds, true);
    const poll = window.setInterval(() => {
      if (mpvModeRef.current !== 'native' || !lastBoundsRef.current) return;
      const now = measureBounds();
      if (now && boundsDiffer(now, lastBoundsRef.current)) syncBounds();
    }, POSITION_POLL_MS);
    syncBounds();
    return () => {
      resizeObs.disconnect();
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('scroll', syncBounds, true);
      window.clearInterval(poll);
      if (boundsFrameRef.current !== null) {
        cancelAnimationFrame(boundsFrameRef.current);
        boundsFrameRef.current = null;
      }
      lastBoundsRef.current = null;
    };
  }, [hostRef, measureBounds, mpvModeRef, syncBounds]);

  return { measureBounds, startBoundsTracking };
}
