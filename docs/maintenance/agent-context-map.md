# Agent context map

Read the row for your task before editing. For a cross-domain change, read each
affected contract. Common constraints remain in [AGENTS.md](../../AGENTS.md);
Claude imports it.

## Development and maintenance

| Area / code ownership | Canonical documents | Repository skill |
| --- | --- | --- |
| Bootstrap, project placement, dependencies, aliases and lint configuration; `nx.json`, `package.json`, `apps/web/project.json`, `apps/electron-backend/project.json` | [Nx boundaries](../architecture/nx-workspace-boundaries.md), [security overrides](../architecture/dependency-security-overrides.md) | [Nx architecture](../../.codex/skills/iptvnator-nx-architecture/SKILL.md) |
| Workflow, docs and skills maintenance | [Agent workflow](../development/agent-workflow.md) | Use the area's skill below |
| Unit tests, regression tests, lint and typechecks; `tools/testing/tvnest-regressions.test.mjs`, `tools/typecheck` | [Validation map](../architecture/validation-map.md) | Use the area's validation section |
| Bundle size and performance counters; `tools/performance` | [Performance journeys](../architecture/performance-journeys.md) | Read the contract directly |
| Electron entry/events/preload and security; `apps/electron-backend` | [Debugging and trace flags](../development/electron-debugging.md), [Electron security](../architecture/electron-security.md) | Read the security contract directly |
| Releases, notes, native assets, Windows installer CI; `tools/release`, `.github/workflows/build-windows.yml` | [Release pipeline](../architecture/release-pipeline.md), [note format](../../.changes/README.md) | [Release notes](../../.codex/skills/release-notes/SKILL.md), [release cut](../../.codex/skills/release-cut/SKILL.md) |

## Data, sources and networking

| Area / code ownership | Required contracts | Repository skill |
| --- | --- | --- |
| SQLite schema/startup; `libs/shared/database`; Electron DB events/workers/operations in `apps/electron-backend/src/app/database` | [DB worker](../architecture/sqlite-db-worker.md), [migration ownership and tests](../../libs/shared/database/README.md) | [SQLite worker](../../.codex/skills/iptvnator-sqlite-db-worker/SKILL.md) |
| M3U import, XMLTV, source lifecycle and OS file opening; `libs/shared/m3u-utils`, `apps/web/src/services` | [M3U module](../architecture/m3u-playlist-module.md) | Read contract directly |
| Xtream API, SQLite catalog queries and playback URLs; `apps/web/src/services`, `apps/electron-backend/src/app/events/xtream.events.ts` | [Xtream compatibility](../architecture/xtream-portal-compatibility.md), [category management](../architecture/category-management.md) | [Xtream](../../.codex/skills/xtream-electron/SKILL.md) |
| Stalker/Ministra protocol, identity, handshake and `create_link`; `libs/shared/interfaces`, `apps/electron-backend/src/app/events/stalker.events.ts` | [Stalker portal](../architecture/stalker-portal.md), [Stalker EPG](../architecture/stalker-epg.md) | [Stalker](../../.codex/skills/stalker-portal/SKILL.md) |
| Outbound HTTP validation, SSRF guards and host health; `libs/shared/host-health`, `apps/electron-backend/src/app/util/validated-axios.ts` | [Connectivity guard](../architecture/host-connectivity-guard.md), [Electron security](../architecture/electron-security.md) | Read the security contract directly |
| Backup and restore; playlist persistence | [Backup/restore](../architecture/playlist-backup-restore.md), [database migrations](../../libs/shared/database/README.md) | [SQLite worker](../../.codex/skills/iptvnator-sqlite-db-worker/SKILL.md) |

## Playback, navigation and React UI

| Area / code ownership | Required contracts | Repository skill |
| --- | --- | --- |
| React player, web streaming engines (HLS and MPEG-TS), OSD controls, tracks and resume; `apps/web/src/components/player`, `apps/web/src/hooks` | [Player controls](../architecture/player-controls-contract.md), [inline playback](../architecture/embedded-inline-playback.md) | [UI design](../../.codex/skills/iptvnator-ui-design/SKILL.md) |
| Embedded MPV, native HWND / frame-copy engines, addon, pinned runtime and packaging; `apps/electron-backend/native`, `tools/embedded-mpv` | [Native MPV](../architecture/embedded-mpv-native.md), [runtime build and licensing](../../tools/embedded-mpv/README.md) | Read the contract directly |
| React workspace shell, catalog, EPG, themes and Tailwind tokens; `apps/web/src` | [UI guidelines](../architecture/iptvnator-ui-guidelines.md), [workspace shell](../architecture/workspace-shell.md) | [UI design](../../.codex/skills/iptvnator-ui-design/SKILL.md), [theme/style](../../.codex/skills/iptvnator-theme-style/SKILL.md) |
| Parental lock: PIN, per-category locks, worker-side filtering; `apps/electron-backend/src/app/database/parental-lock-state.ts`, `apps/web/src/components` | [Parental lock](../architecture/parental-lock.md) | [SQLite worker](../../.codex/skills/iptvnator-sqlite-db-worker/SKILL.md) |
| Downloads and live recordings; `apps/electron-backend/src/app/events/database/downloads.events.ts`, `apps/web/src/components/views/downloads-view.tsx` | [Download manager](../architecture/download-manager.md) | Read the contract directly |

## Maintenance rules

Keep unique behavior contracts in the authoritative document, procedures in a
skill or development guide, and universal constraints in [AGENTS.md](../../AGENTS.md).
Use normal Markdown links for document destinations so `pnpm run agents:validate`
can check them.

The [migration ledger](agent-guidance-migration.md) is historical audit evidence.
