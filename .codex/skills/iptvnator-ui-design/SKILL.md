---
name: iptvnator-ui-design
description: Use when changing user-visible React UI in TVNest, including catalog grids, EPG guide, player OSD, detail views, settings, or dialogs.
---

# TVNest React UI Design

## Inspect First

- Shell and navigation: `apps/web/src/App.tsx`,
  `apps/web/src/components/shell/unified-sidebar.tsx`,
  `apps/web/src/components/shell/window-titlebar.tsx`
- Player surfaces: `apps/web/src/components/player/stream-surface.tsx` and
  `apps/web/src/components/player/`
- Shared primitives: `apps/web/src/components/motion/`
- Guidelines: `docs/architecture/iptvnator-ui-guidelines.md`

## Design and Accessibility Contract

- Keep every file in `apps/web/src` at or below 300 lines; extract focused
  subcomponents and hooks cleanly.
- Hidden overlays (`opacity-0`) must also disable hit-testing (`pointer-events-none`
  and `inert`) so underlying video surfaces remain clickable.
- Floating popovers above native `libmpv` views must register dismissal handlers
  (`Escape` and outside pointer down) so `avoidNativeView` never stays stuck on.
- Interactive elements must be real `<button>` elements (or carry keyboard and
  ARIA attributes) with visible `:focus-visible` rings and accessible labels.
- Never use em-dashes in UI copy; keep labels concise and consistent with the
  active language (`apps/web/src/lib/i18n.ts`).

## Validation

Run `pnpm run typecheck:web`, `pnpm run test:web`, `pnpm nx lint web`, and
`pnpm nx build web`.
