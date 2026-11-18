// Gestionnaires IPC Electron délégués au worker SQLite pour le catalogue TVNest.
import type { CatalogFilterQuery } from '../../database/operations/catalog-filter.types';
import { handleWorkerRequest } from './worker-events.utils';

handleWorkerRequest('DB_QUERY_CATALOG', (query: CatalogFilterQuery) => query);

handleWorkerRequest(
    'DB_GET_CATEGORIES_WITH_COUNTS',
    (playlistId: string, language?: string) => ({ playlistId, language })
);

handleWorkerRequest('DB_GET_PLAYLIST_STREAM_COUNTS', () => ({}));

handleWorkerRequest(
    'DB_GET_DASHBOARD_HIGHLIGHTS',
    (playlistId: string, preferredLanguage?: string) => ({
        playlistId,
        preferredLanguage,
    })
);

handleWorkerRequest(
    'DB_SET_CATEGORY_LOCKED',
    (categoryId: number, locked: boolean) => ({ categoryId, locked })
);
