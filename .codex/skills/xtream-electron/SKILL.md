---
name: xtream-electron
description: Use when changing Xtream portal import, refresh, SQLite catalog queries, favorites reconciliation, VOD/series details, or stream URL construction.
---

# Xtream Electron

## Read First

- `docs/architecture/xtream-portal-compatibility.md`
- `docs/architecture/sqlite-db-worker.md`
- Backend operations: `apps/electron-backend/src/app/database/operations/`
- Electron transport: `apps/electron-backend/src/app/events/xtream.events.ts`
- Frontend services: `apps/web/src/services/xtream-request.service.ts`,
  `apps/web/src/services/ipc-portals.service.ts`, and
  `apps/web/src/services/ipc-catalog.service.ts`

## Data and Refresh Contracts

- Xtream identity is `(playlist_id, type, xtream_id)`. Distinguishing SQLite row
  `id` from provider `xtream_id` is mandatory because `deleteXtreamContent`
  recreates `content` rows on portal refresh.
- After re-importing Xtream categories and streams, preserve `locked` and
  `hidden` category flags, update playlist metadata (`count`, `updateDate`), and
  reconcile `favorites.content_id` so favorites survive portal refreshes.
- Encode `username` and `password` segments with `encodeURIComponent` when
  building Xtream playback URLs (`apps/web/src/services/xtream-stream-url.ts`).

## Validation

Run `pnpm nx test electron-backend`, `pnpm nx test database`, and
`pnpm run test:web`.
