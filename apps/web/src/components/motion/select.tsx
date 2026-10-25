// Sélecteur déroulant @beui/select à dépliement par ressort physique.
import { ChevronDown } from 'lucide-react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import {
  SELECT_RADIUS,
  SELECT_UNFOLD_EXIT,
  SELECT_UNFOLD_SPRING,
  SelectContext,
  type SelectContextValue,
  type SelectPlacement,
  useSelectContext,
} from './select-context';

export {
  SelectContent,
  type SelectContentProps,
  SelectItem,
  type SelectItemProps,
} from './select-content';

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  children,
}: SelectProps) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [internal, setInternal] = useState(defaultValue);
  const [labels, setLabels] = useState<
    Map<string, { label: string; disabled: boolean }>
  >(new Map());
  const [placement, setPlacement] = useState<SelectPlacement>('bottom');

  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const openControlled = openProp !== undefined;
  const open = openControlled ? openProp : internalOpen;
  const progress = useMotionValue(open ? 1 : 0);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!openControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, openControlled]
  );

  const close = useCallback(() => {
    const trigger = document.getElementById(`${baseId}-trigger`);
    if (
      rootRef.current?.contains(document.activeElement) &&
      document.activeElement !== trigger
    ) {
      trigger?.focus();
    }
    setOpen(false);
  }, [baseId, setOpen]);

  const select = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
      close();
    },
    [controlled, onValueChange, close]
  );

  const register = useCallback((v: string, label: string, itemDisabled: boolean) => {
    setLabels((m) => {
      const entry = m.get(v);
      if (entry?.label === label && entry.disabled === itemDisabled) return m;
      return new Map(m).set(v, { label, disabled: itemDisabled });
    });
  }, []);

  const unregister = useCallback((v: string) => {
    setLabels((m) => {
      if (!m.has(v)) return m;
      const next = new Map(m);
      next.delete(v);
      return next;
    });
  }, []);

  useEffect(() => {
    const animation = animate(
      progress,
      open ? 1 : 0,
      reduce
        ? { duration: 0.12 }
        : open
          ? SELECT_UNFOLD_SPRING
          : SELECT_UNFOLD_EXIT
    );
    return () => animation.stop();
  }, [open, progress, reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open, setOpen, close]);

  const rows = useMemo(
    () =>
      Array.from(labels, ([id, entry]) => ({
        id,
        label: entry.label,
        disabled: entry.disabled,
      })),
    [labels]
  );

  const ctx = useMemo<SelectContextValue>(
    () => ({
      value: current,
      open,
      setOpen,
      select,
      register,
      unregister,
      labelFor: (v) => (v === undefined ? undefined : labels.get(v)?.label),
      rows,
      close,
      reduce,
      progress,
      triggerId: `${baseId}-trigger`,
      listId: `${baseId}-list`,
      disabled,
      placement,
      setPlacement,
    }),
    [
      current,
      open,
      setOpen,
      select,
      register,
      unregister,
      labels,
      rows,
      close,
      reduce,
      progress,
      baseId,
      disabled,
      placement,
    ]
  );

  return (
    <SelectContext.Provider value={ctx}>
      <div ref={rootRef} className={cn('relative', className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps {
  className?: string;
  children: ReactNode;
}

export function SelectTrigger({ className, children }: SelectTriggerProps) {
  const ctx = useSelectContext('SelectTrigger');
  const isTop = ctx.placement === 'top';
  const nearRadius = useTransform(
    ctx.progress,
    [0, 0.2, 0.4, 1],
    [SELECT_RADIUS, 0, 0, SELECT_RADIUS]
  );
  const rotate = useTransform(ctx.progress, (p) =>
    ctx.reduce ? (ctx.open ? 180 : 0) : Math.min(1, Math.max(0, p)) * 180
  );

  return (
    <motion.button
      type="button"
      id={ctx.triggerId}
      disabled={ctx.disabled}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      aria-controls={ctx.listId}
      onClick={() => ctx.setOpen(!ctx.open)}
      onKeyDown={(event) => {
        if (
          !ctx.open &&
          (event.key === 'ArrowDown' || event.key === 'ArrowUp')
        ) {
          event.preventDefault();
          ctx.setOpen(true);
        }
      }}
      style={{
        borderTopLeftRadius: ctx.reduce || !isTop ? SELECT_RADIUS : nearRadius,
        borderTopRightRadius: ctx.reduce || !isTop ? SELECT_RADIUS : nearRadius,
        borderBottomLeftRadius:
          ctx.reduce || isTop ? SELECT_RADIUS : nearRadius,
        borderBottomRightRadius:
          ctx.reduce || isTop ? SELECT_RADIUS : nearRadius,
      }}
      className={cn(
        'relative z-10 flex h-9 w-full items-center justify-between gap-2 border border-border bg-elevated px-3 text-xs font-medium text-foreground outline-none transition-colors',
        'hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/40',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">{children}</span>
      <motion.span
        aria-hidden
        style={{ rotate }}
        className="shrink-0 text-muted-foreground"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </motion.span>
    </motion.button>
  );
}

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export function SelectValue({ placeholder, className }: SelectValueProps) {
  const ctx = useSelectContext('SelectValue');
  const label = ctx.labelFor(ctx.value);
  return (
    <span
      className={cn(
        'truncate',
        label ? 'text-foreground' : 'text-muted-foreground',
        className
      )}
    >
      {label ?? placeholder ?? 'Sélectionner'}
    </span>
  );
}
