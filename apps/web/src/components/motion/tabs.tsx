// Composant @beui/tabs avec indicateur pill animé par ressort et support OLED/Clair.
import {
  motion,
  MotionConfig,
  type Transition,
  useReducedMotion,
} from 'motion/react';
import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from 'react';
import { EASE_OUT } from '@/lib/ease';
import { cn } from '@/lib/utils';

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
};

const TabsCtx = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
}

const transition: Transition = {
  type: 'spring',
  stiffness: 340,
  damping: 32,
  mass: 0.85,
};

export function Tabs({
  defaultValue = '',
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange]
  );

  const ctx = useMemo(
    () => ({ value: current, setValue, layoutId }),
    [current, setValue, layoutId]
  );

  return (
    <MotionConfig transition={reduce ? { duration: 0 } : transition}>
      <TabsCtx.Provider value={ctx}>
        <motion.div layoutRoot className={className}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
}

export function TabsList({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-2xl border border-border bg-elevated p-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
  activeTextClassName = 'text-primary font-semibold',
  inactiveTextClassName = 'text-muted-foreground hover:text-foreground',
  onClick,
  ...props
}: {
  value: string;
  indicatorClassName?: string;
  activeTextClassName?: string;
  inactiveTextClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'>) {
  const { value: current, setValue, layoutId } = useTabs();
  const active = current === value;

  return (
    <button
      {...props}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) setValue(value);
      }}
      className={cn(
        'relative isolate inline-flex items-center justify-center rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors outline-none select-none',
        active ? activeTextClassName : inactiveTextClassName,
        className
      )}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          layout
          className={cn(
            'absolute inset-0 -z-10 rounded-xl border border-primary/25 bg-primary/15',
            indicatorClassName
          )}
        />
      ) : null}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {children}
      </span>
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: current } = useTabs();
  const reduce = useReducedMotion();
  if (current !== value) return null;

  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
