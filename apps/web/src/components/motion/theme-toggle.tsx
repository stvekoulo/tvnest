// Commutateur de thème @beui/theme-toggle avec View Transition clip-path.
import { Moon, Sun } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { type ComponentPropsWithoutRef } from 'react';
import { ActionSwapIcon } from '@/components/motion/action-swap';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export type ThemeVariant = 'rectangle' | 'circle' | 'circle-blur';

export type RectStart =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'bottom-up';

export interface ThemeToggleProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'onClick'> {
  variant?: ThemeVariant;
  start?: RectStart;
  iconClassName?: string;
}

const RECT_FROM: Record<RectStart, string> = {
  'top-left': 'inset(0 100% 100% 0)',
  'top-right': 'inset(0 0 100% 100%)',
  'bottom-left': 'inset(100% 100% 0 0)',
  'bottom-right': 'inset(100% 0 0 100%)',
  center: 'inset(50% 50% 50% 50%)',
  'bottom-up': 'inset(100% 0 0 0)',
};

const CIRCLE_ORIGIN: Record<RectStart, string> = {
  'top-left': '0% 0%',
  'top-right': '100% 0%',
  'bottom-left': '0% 100%',
  'bottom-right': '100% 100%',
  center: '50% 50%',
  'bottom-up': '50% 100%',
};

export function useThemeToggle({
  variant = 'circle-blur',
  start = 'top-right',
}: { variant?: ThemeVariant; start?: RectStart } = {}) {
  const { setTheme, resolvedTheme } = useTheme();
  const reduce = useReducedMotion() ?? false;
  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    if (reduce || !('startViewTransition' in document)) {
      setTheme(next);
      return;
    }

    const root = document.documentElement;
    if (variant === 'rectangle') {
      root.style.setProperty('--beui-vt-from', RECT_FROM[start]);
      root.dataset.beuiVt = 'rect';
    } else {
      root.style.setProperty('--beui-vt-origin', CIRCLE_ORIGIN[start]);
      root.dataset.beuiVt = variant;
    }

    const vt = (
      document as Document & {
        startViewTransition(cb: () => void): { finished: Promise<void> };
      }
    ).startViewTransition(() => setTheme(next));

    vt.finished.finally(() => {
      delete root.dataset.beuiVt;
    });
  };

  return { isDark, toggle };
}

export function ThemeToggle({
  variant = 'circle-blur',
  start = 'top-right',
  className,
  iconClassName = 'h-4 w-4',
  ...rest
}: ThemeToggleProps) {
  const { isDark, toggle } = useThemeToggle({ variant, start });

  return (
    <button
      type="button"
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre Noir Absolu'}
      onClick={toggle}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-elevated text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground',
        className
      )}
      {...rest}
    >
      <ActionSwapIcon
        value={isDark ? 'dark' : 'light'}
        animation="blur"
        className={iconClassName}
      >
        {isDark ? (
          <Sun className={iconClassName} />
        ) : (
          <Moon className={iconClassName} />
        )}
      </ActionSwapIcon>
    </button>
  );
}
