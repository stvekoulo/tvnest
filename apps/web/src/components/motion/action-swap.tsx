// Échange animé d'icônes, textes et boutons multi-états (@beui/action-swap).
import { AnimatePresence, type HTMLMotionProps, motion, useReducedMotion, type Variants } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS, SPRING_SWAP } from '@/lib/ease';
import { cn } from '@/lib/utils';

export type ActionSwapItem = {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
};

export type ActionSwapButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ActionSwapButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type ActionSwapAnimation = 'blur' | 'roll';

export interface ActionSwapButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children' | 'onChange'> {
  items: ActionSwapItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, item: ActionSwapItem) => void;
  variant?: ActionSwapButtonVariant;
  size?: ActionSwapButtonSize;
  animation?: ActionSwapAnimation;
  iconOnly?: boolean;
  cycle?: boolean;
}

export interface ActionSwapTextProps {
  value: string;
  children: ReactNode;
  animation?: ActionSwapAnimation;
  className?: string;
}

export interface ActionSwapIconProps {
  value: string;
  children: ReactNode;
  animation?: ActionSwapAnimation;
  className?: string;
}

const SWAP_BLUR = 'blur(2px)';
const ROLL_BLUR = 'blur(3px)';

const TEXT_VARIANTS: Record<ActionSwapAnimation, Variants> = {
  blur: {
    initial: { opacity: 0, scale: 0.9, filter: SWAP_BLUR },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: SPRING_SWAP },
    exit: { opacity: 0, scale: 0.96, filter: SWAP_BLUR, transition: { duration: 0.16, ease: EASE_OUT } },
  },
  roll: {
    initial: { opacity: 0, y: '90%', filter: ROLL_BLUR },
    animate: { opacity: 1, y: '0%', filter: 'blur(0px)', transition: SPRING_SWAP },
    exit: { opacity: 0, y: '-90%', filter: ROLL_BLUR, transition: { duration: 0.14, ease: EASE_OUT } },
  },
};

const ICON_VARIANTS: Record<ActionSwapAnimation, Variants> = {
  blur: {
    initial: { opacity: 0, scale: 0.25, filter: SWAP_BLUR },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: SPRING_SWAP },
    exit: { opacity: 0, scale: 0.25, filter: SWAP_BLUR, transition: { duration: 0.16, ease: EASE_OUT } },
  },
  roll: {
    initial: { opacity: 0, y: 12, filter: ROLL_BLUR },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING_SWAP },
    exit: { opacity: 0, y: -12, filter: ROLL_BLUR, transition: { duration: 0.14, ease: EASE_OUT } },
  },
};

const VARIANT_CLASS: Record<ActionSwapButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-elevated text-foreground hover:border-primary/40',
  outline: 'border border-border bg-transparent text-foreground hover:bg-muted/60',
  ghost: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
};

const SIZE_CLASS: Record<ActionSwapButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-full px-3 text-xs',
  md: 'h-10 gap-2 rounded-full px-4 text-sm',
  lg: 'h-11 gap-2.5 rounded-full px-5 text-sm',
  icon: 'h-9 w-9 rounded-full',
};

export function ActionSwapText({
  value,
  children,
  animation = 'blur',
  className,
}: ActionSwapTextProps) {
  const reduce = useReducedMotion();
  return (
    <span
      className={cn(
        'relative -my-[0.08em] inline-block max-w-full whitespace-nowrap py-[0.08em] align-bottom',
        className
      )}
      style={{ clipPath: 'inset(0 -999px)' }}
    >
      <span aria-hidden className="invisible inline-block whitespace-nowrap">
        {children}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={`${animation}-${value}`}
          variants={TEXT_VARIANTS[animation]}
          initial={reduce ? false : 'initial'}
          animate={reduce ? { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 } : 'animate'}
          exit={reduce ? undefined : 'exit'}
          className="absolute left-0 top-[0.08em] inline-block max-w-full truncate"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ActionSwapIcon({
  value,
  children,
  animation = 'blur',
  className,
}: ActionSwapIconProps) {
  const reduce = useReducedMotion();
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${animation}-${value}`}
          aria-hidden
          variants={ICON_VARIANTS[animation]}
          initial={reduce ? false : 'initial'}
          animate={reduce ? { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 } : 'animate'}
          exit={reduce ? undefined : 'exit'}
          className="col-start-1 row-start-1 inline-flex items-center justify-center"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ActionSwapButton({
  items,
  value,
  defaultValue,
  onValueChange,
  variant = 'secondary',
  size = 'md',
  animation = 'blur',
  iconOnly = size === 'icon',
  cycle = true,
  className,
  disabled,
  onClick,
  style,
  ...rest
}: ActionSwapButtonProps) {
  const reduce = useReducedMotion();
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.id);
  const currentValue = value ?? internalValue;
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === currentValue));
  const activeItem = items[activeIndex] ?? items[0];
  const hasIcon = items.some((item) => item.icon);
  const nextItem = cycle && items.length > 0 ? items[(activeIndex + 1) % items.length] : undefined;

  if (!activeItem) return null;

  const accessibleLabel =
    activeItem.ariaLabel ??
    (iconOnly && typeof activeItem.label === 'string' ? activeItem.label : undefined);
  const layoutTransition = reduce ? { duration: 0 } : SPRING_LAYOUT;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      layout
      layoutDependency={activeItem.id}
      whileTap={reduce || disabled ? undefined : { scale: 0.96 }}
      transition={{ ...SPRING_PRESS, layout: layoutTransition }}
      style={{ borderRadius: 9999, ...style }}
      className={cn(
        'inline-flex items-center justify-center overflow-hidden font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className
      )}
      aria-label={accessibleLabel}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled || !cycle || !nextItem) return;
        if (value === undefined) setInternalValue(nextItem.id);
        onValueChange?.(nextItem.id, nextItem);
      }}
      {...rest}
    >
      {hasIcon ? (
        <motion.span
          layout="position"
          layoutDependency={activeItem.id}
          transition={layoutTransition}
          className="inline-flex shrink-0"
        >
          <ActionSwapIcon value={activeItem.id} animation={animation} className="h-4 w-4">
            {activeItem.icon ?? null}
          </ActionSwapIcon>
        </motion.span>
      ) : null}
      {!iconOnly ? (
        <motion.span
          layout="position"
          layoutDependency={activeItem.id}
          transition={layoutTransition}
          className="inline-flex min-w-0 max-w-full"
        >
          <ActionSwapText value={activeItem.id} animation={animation}>
            {activeItem.label}
          </ActionSwapText>
        </motion.span>
      ) : null}
    </motion.button>
  );
}
