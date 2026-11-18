---
name: stalker-portal
description: Use when changing Stalker or Ministra portal authentication, channel genre import, create_link playback resolution, or Electron Stalker transport.
---

# Stalker Portal

## Read First

- `docs/architecture/stalker-portal.md`
- `docs/architecture/stalker-epg.md`
- Wire-format and identity contracts: `libs/shared/interfaces/src/lib/`
- Electron transport: `apps/electron-backend/src/app/events/stalker.events.ts`
- Frontend portal & playback services:
  `apps/web/src/services/ipc-portals.service.ts` and
  `apps/web/src/services/ipc-playback.service.ts`

## Protocol Contract

- Preserve `portalUrl`, `macAddress`, `serialNumber`, `deviceId1`, `deviceId2`,
  and `token` across `UnifiedPlaylist` mapping and SQLite persistence.
- Import real `itv` genres via `get_genres` before `get_all_channels` so Live TV
  categories reflect portal groups rather than a single synthetic group.
- Resolve Stalker `ffrt` / `ffmpeg` command templates through `handshake` and
  `create_link` before handing the resolved `http(s)` URL to Embedded MPV, web
  players, or external MPV/VLC, and scope `Cookie` / `Authorization` headers to
  the Stalker host.

## Validation

Run `pnpm nx test shared-interfaces`, `pnpm nx test electron-backend`, and
`pnpm run test:web`.
