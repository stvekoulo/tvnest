---
name: iptvnator-sqlite-db-worker
description: Use when changing Electron SQLite IPC, database-worker operations, catalog filtering, parental-lock worker state, or worker packaging.
---

# TVNest SQLite DB Worker

## Ownership and Flow

- Renderer services: `apps/web/src/services/ipc-catalog.service.ts`
- Preload API: `apps/electron-backend/src/app/api/main.preload.ts`
- IPC handlers: `apps/electron-backend/src/app/events/database/` and
  `apps/electron-backend/src/app/events/database/catalog-filter.events.ts`
- Client: `apps/electron-backend/src/app/services/database-worker-client.ts`
- Protocol: `apps/electron-backend/src/app/workers/database-worker.types.ts`
- Dispatcher: `apps/electron-backend/src/app/workers/database.worker.ts`
- Connection: `apps/electron-backend/src/app/workers/database.worker-connection.ts`
- SQL operations: `apps/electron-backend/src/app/database/operations/`
- Shared schema: `libs/shared/database/src/lib/schema.ts`
- Bundler: `apps/electron-backend/build-worker.js`
- Canonical guide: `docs/architecture/sqlite-db-worker.md`

All heavy SQLite work (including `catalog-filter` queries, category counts,
stream counts, dashboard highlights, imports, favorites, and deletes) executes
inside `database.worker.ts` rather than blocking the Electron main thread.

Inside synchronous `better-sqlite3` transactions, prepared writes must use
`.run()`. Batch `IN (...)` queries in chunks of 500 to stay well below
`SQLITE_MAX_VARIABLE_NUMBER`.

## Rebuild and Verify

```bash
pnpm nx test electron-backend
pnpm nx test database
pnpm nx run electron-backend:build-worker
```

For SQL output, `IPTVNATOR_TRACE_DB=1` and `IPTVNATOR_TRACE_SQL=1` emit only
redacted summaries via `libs/shared/logging/src/lib/sql-trace-summary.ts`;
never log expanded SQL or bound values.
