---
name: iptvnator-theme-style
description: Use when changing TVNest CSS variables, Tailwind tokens, light/dark surface contrast, typography, or Electron title-bar drag regions.
---

# TVNest Theme & Style

## Canonical Sources

- Theme tokens and CSS variables: `apps/web/src/styles/globals.css`
- Tailwind config: `apps/web/tailwind.config.js`
- Theme bootstrap: `apps/web/src/main.tsx`
- UI guidelines: `docs/architecture/iptvnator-ui-guidelines.md`

## Token and Contrast Rules

- Surfaces, text, borders, and accent tokens come from CSS variables in
  `apps/web/src/styles/globals.css`, switched via `.dark` / `.light` on `<html>`.
- Ensure controls (switches, icon buttons, badges, pills) maintain clear WCAG AA
  contrast in both dark and light themes; never place a near-identical foreground
  on an accent or surface token.
- Fonts (`@fontsource-variable/bricolage-grotesque` and
  `@fontsource-variable/plus-jakarta-sans`) are bundled locally; never load
  external Google Fonts stylesheets.
- In Electron drag regions (`-webkit-app-region: drag`), every interactive
  descendant must set `-webkit-app-region: no-drag`.

## Validation

Run `pnpm run typecheck:web`, `pnpm run test:web`, and `pnpm nx build web`, and
verify both dark and light themes.
