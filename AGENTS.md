# Repository guidance

TVNest is a React 19 + Vite + Electron desktop IPTV and cinema hub backed by
SQLite (`better-sqlite3` + Drizzle) and embedded `libmpv`. Read the relevant
contracts below before changing a subsystem; do not load every document.

## Bootstrap and commands

- Use Node `>=22.22.3` and the repository's `pnpm` (`pnpm@10.33.0`).
- In a fresh worktree, run `pnpm install --frozen-lockfile` before Nx discovery,
  tests, lint or builds (`apps/web` is part of `pnpm-workspace.yaml`).
- Repeat the install after checkout changes, pulls, resets or rebases. Compare
  `pnpm-lock.yaml` with `node_modules/.pnpm/lock.yaml`; a difference means stale
  dependencies.
- Verify discovery with `pnpm nx show projects`. Inspect the owning project's
  targets before choosing checks. Prefer the smallest relevant Nx target.
- Development: `pnpm run serve:frontend` (`apps/web` on `127.0.0.1:4200`) and
  `pnpm run serve:backend` (`apps/electron-backend`).
- Tests: `pnpm run test:web` and `pnpm nx test <project>`; typecheck:
  `pnpm run typecheck:ci`; lint: `pnpm nx lint <project>`.
- Find checks in the [validation map](docs/architecture/validation-map.md).

## Implementation invariants

- Use scoped aliases from `tsconfig.base.json`, such as `@iptvnator/shared/*`,
  and `@/*` inside `apps/web`. Do not bypass public project boundaries.
- Nx projects keep `scope:*`, `domain:*` and `type:*` tags.
- Keep `apps/web/src` files strictly at or below 300 lines; backend production
  TypeScript targets under 300 lines (hard limit 400; 1200 for tests). Never add
  entries to `tools/eslint/max-lines-baseline.mjs`.
- Preserve existing persisted data (`%APPDATA%\TVNest` and `~/.tvnest`).
  Migrations must apply in dependency order, preserve data and be idempotent.
- Choose runtime behavior through explicit preload bridge capabilities rather
  than assuming every `window.electron` method exists.
- Use shared redacting logging (`@iptvnator/shared/logging`) before emitting
  settings, portal URLs, stderr or trace data. Never log credentials or bound SQL.
- Keep `BrowserWindow` sandboxed (`sandbox: true`) by default and maintain strict
  CSP in `apps/web/index.html` with locally bundled fonts.

## Validation and completion

- Before finishing, assess affected projects and test impact. Bug fixes include
  regression coverage in `tools/testing/tvnest-regressions.test.mjs` or Jest.
- Run `pnpm run typecheck:ci`, `pnpm run test:web`, and affected `pnpm nx test`
  / `pnpm nx lint` targets before claiming completion.
- Every user-visible change needs a note under `.changes/`; follow the
  [release-note format](.changes/README.md) and validate with
  `pnpm run release:notes:validate`.
- After changing guidance, run `pnpm run agents:validate`; after editing a
  repository skill or a literal path it documents, run `pnpm run skills:validate`.
  Keep `release-cut` and `release-notes` copies byte-identical for Codex and Claude.
- Save finalized plans in `.plans/YYYY-MM-DD-short-topic.md`.

## Read by task

| Task | Required starting point |
| --- | --- |
| Project layout, imports, dependencies, lint configuration | [Nx boundaries](docs/architecture/nx-workspace-boundaries.md) |
| Development workflow, docs and skills maintenance | [Agent workflow](docs/development/agent-workflow.md) |
| Electron debugging, security, preload and IPC | [Electron security](docs/architecture/electron-security.md), [Electron debugging](docs/development/electron-debugging.md) |
| SQLite, worker IPC, persistence migrations | [DB worker](docs/architecture/sqlite-db-worker.md), [database migrations](libs/shared/database/README.md) |
| M3U, XMLTV, startup, source health, OS playlist opening | [M3U contracts](docs/architecture/m3u-playlist-module.md) |
| Xtream / Stalker | [Xtream compatibility](docs/architecture/xtream-portal-compatibility.md), [Stalker contracts](docs/architecture/stalker-portal.md) |
| Player controls, embedded MPV, native runtime and packaging | [Controls contract](docs/architecture/player-controls-contract.md), [Embedded MPV](docs/architecture/embedded-mpv-native.md) |
| Parental lock, downloads, networking | [Parental lock](docs/architecture/parental-lock.md), [Download manager](docs/architecture/download-manager.md), [Host connectivity](docs/architecture/host-connectivity-guard.md) |
| Release or packaging metadata | [Release pipeline](docs/architecture/release-pipeline.md), [Context map](docs/maintenance/agent-context-map.md) |

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- Inspect project configuration files (`apps/web/project.json`, `apps/electron-backend/project.json`) and `pnpm nx show projects`.
- Run project tasks through local `pnpm nx`, not a global Nx installation.
- Never guess unfamiliar flags: consult `--help`.

<!-- nx configuration end-->
