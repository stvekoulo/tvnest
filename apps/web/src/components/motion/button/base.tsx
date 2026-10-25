// Bouton de base @beui/button-base avec ressort physique et variantes OLED/Clair.
import {
  AnimatePresence,
  type HTMLMotionProps,
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  forwardRef,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';
import { EASE_OUT, SPRING_PRESS } from '@/lib/ease';
import { useHoverCapable } from '@/lib/hooks/use-hover-capable';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'glass'
  | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pressScale?: number;
  ripple?: boolean;
  children?: ReactNode;
}

type Ripple = { id: number; x: number; y: number; size: number };

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20',
  secondary:
    'border border-border bg-elevated text-foreground hover:border-primary/40 hover:bg-muted/70',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
  outline:
    'border border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted/50',
  glass:
    'border border-white/20 bg-black/55 text-white backdrop-blur-xl hover:bg-black/75',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-xs gap-1.5 rounded-full',
  md: 'h-9 px-4 text-xs gap-2 rounded-full',
  lg: 'h-11 px-6 text-sm gap-2 rounded-full',
  icon: 'h-9 w-9 rounded-full',
  'icon-sm': 'h-8 w-8 rounded-full',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      pressScale = 0.96,
      ripple = false,
      className,
      children,
      onPointerDown,
      ...rest
    },
    ref
  ) {
    const reduce = useReducedMotion();
    const canHover = useHoverCapable();
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const nextId = useRef(0);

    const handlePointerDown = useCallback(
      (event: PointerEvent<HTMLButtonElement>) => {
        if (ripple && !reduce) {
          const rect = event.currentTarget.getBoundingClientRect();
          const sizePx = Math.max(rect.width, rect.height) * 2;
          const id = nextId.current++;
          setRipples((prev) => [
            ...prev,
            {
              id,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              size: sizePx,
            },
          ]);
        }
        onPointerDown?.(event);
      },
      [ripple, reduce, onPointerDown]
    );

    return (
      <motion.button
        ref={ref}
        type="button"
        whileTap={reduce ? undefined : { scale: pressScale }}
        whileHover={reduce || !canHover ? undefined : { scale: 1.015 }}
        transition={SPRING_PRESS}
        onPointerDown={handlePointerDown}
        className={cn(
          'inline-flex items-center justify-center font-medium select-none transition-colors',
          'disabled:pointer-events-none disabled:opacity-50',
          ripple && 'relative overflow-hidden',
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className
        )}
        {...rest}
      >
        {ripple && !reduce ? (
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <AnimatePresence>
              {ripples.map((r) => (
                <motion.span
                  key={r.id}
                  className="absolute rounded-full bg-current"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: r.size,
                    height: r.size,
                    x: '-50%',
                    y: '-50%',
                  }}
                  initial={{ scale: 0.05, opacity: 0.28 }}
                  animate={{ scale: 1, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.3, ease: EASE_OUT }}
                  onAnimationComplete={() =>
                    setRipples((prev) => prev.filter((x) => x.id !== r.id))
                  }
                />
              ))}
            </AnimatePresence>
          </span>
        ) : null}
        {children}
      </motion.button>
    );
  }
);
