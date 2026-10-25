// Contexte et constantes d'animation partagés pour @beui/select.
import type { MotionValue, Variants } from 'motion/react';
import { createContext, useContext } from 'react';
import { EASE_OUT } from '@/lib/ease';
import type { ListboxRow } from '@/lib/hooks/use-listbox';

export const SELECT_UNFOLD_SPRING = {
  type: 'spring',
  visualDuration: 0.2,
  bounce: 0.12,
} as const;

export const SELECT_UNFOLD_EXIT = { duration: 0.18, ease: EASE_OUT } as const;
export const SELECT_RADIUS = 12;
export const SELECT_GAP = 6;
export const SELECT_LIP = 8;

export const SELECT_ITEM_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.08, ease: EASE_OUT },
  },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.12, ease: EASE_OUT },
  },
};

export type SelectPlacement = 'bottom' | 'top';

export interface SelectContextValue {
  value: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  select: (value: string) => void;
  register: (value: string, label: string, disabled: boolean) => void;
  unregister: (value: string) => void;
  labelFor: (value: string | undefined) => string | undefined;
  rows: ListboxRow[];
  close: () => void;
  reduce: boolean;
  progress: MotionValue<number>;
  triggerId: string;
  listId: string;
  disabled: boolean;
  placement: SelectPlacement;
  setPlacement: (placement: SelectPlacement) => void;
}

export const SelectContext = createContext<SelectContextValue | null>(null);
export const ActiveOptionContext = createContext<string | undefined>(undefined);

export function useSelectContext(component: string) {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error(`${component} must be used within <Select>`);
  return ctx;
}
