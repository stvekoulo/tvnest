// Tokens de mouvement beUI partagés (courbes et ressorts physiques).
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

export const EASE_OUT_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

// Retour de pression sur les boutons et surfaces interactives.
export const SPRING_PRESS = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const;

// Échange fluide d'icônes et labels dans un contrôle (@beui/action-swap).
export const SPRING_SWAP = {
  type: 'spring',
  stiffness: 460,
  damping: 30,
  mass: 0.55,
} as const;

// Ouverture de panneaux superposés (@beui/select, modales, popovers).
export const SPRING_PANEL = {
  type: 'spring',
  stiffness: 420,
  damping: 40,
  mass: 0.5,
} as const;

// Glissement d'indicateurs partagés (@beui/tabs, curseur listbox).
export const SPRING_LAYOUT = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.6,
} as const;

// Suivi réactif du pointeur.
export const SPRING_MOUSE = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.4,
} as const;

// Défilement doux de grand conteneur.
export const SPRING_GLIDE = {
  type: 'spring',
  stiffness: 200,
  damping: 28,
  mass: 0.9,
} as const;
