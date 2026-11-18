---
name: iptvnator-nx-architecture
description: Use when deciding where TVNest code belongs, changing Nx projects, scoped aliases or tags, editing lint targets, or validating module boundaries.
---

# TVNest Nx Architecture

## Discover Before Deciding

In a fresh worktree, install first:

```bash
pnpm install --frozen-lockfile
pnpm nx show projects
pnpm nx show project <name>
```

Active application projects are `web` (`apps/web`, React 19 + Vite 6) and
`electron-backend` (`apps/electron-backend`, Electron main + preload + workers +
native `libmpv` addon). Shared libraries live under `libs/shared/`:
`libs/shared/database`, `libs/shared/host-health`, `libs/shared/interfaces`,
`libs/shared/logging`, and `libs/shared/m3u-utils`. Tool projects are
`eslint-tools`, `packaging`, `performance-tools`, `release-tools`, and
`repository-skills`.

## Boundaries and File Sizes

- `apps/web` imports shared contracts from `@iptvnator/shared/interfaces` and
  `@iptvnator/shared/m3u-utils`, never directly from `apps/electron-backend`.
- `apps/electron-backend` imports from `@iptvnator/shared/*` aliases declared in
  `tsconfig.base.json`.
- Keep every file in `apps/web/src` at or below 300 lines. Backend production
  TypeScript targets under 300 lines (hard limit 400; 1200 for tests) per
  `tools/eslint/max-lines-config.mjs`. Never add entries to
  `tools/eslint/max-lines-baseline.mjs`.

## Validate the Change

Run `pnpm run typecheck:ci`, `pnpm run test:web`, and affected `pnpm nx test` /
`pnpm nx lint` targets. Canonical guidance:
`docs/architecture/nx-workspace-boundaries.md`.
