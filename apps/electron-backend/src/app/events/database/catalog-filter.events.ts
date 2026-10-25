// Gestionnaires IPC Electron pour le filtrage avancé SQLite et les compteurs TVNest.
import { ipcMain } from 'electron';
import {
    getCategoriesWithCounts,
    getDashboardHighlights,
    getPlaylistStreamCounts,
    queryCatalog,
} from '../../database/operations/catalog-filter.operations';
import type { CatalogFilterQuery } from '../../database/operations/catalog-filter.types';

const LOG_TAG = '[TVNest Catalog DB]';

ipcMain.handle('DB_QUERY_CATALOG', async (_event, query: CatalogFilterQuery) => {
    try {
        return await queryCatalog(query);
    } catch (error) {
        console.error(LOG_TAG, 'Error querying catalog:', error);
        throw error;
    }
});

ipcMain.handle(
    'DB_GET_CATEGORIES_WITH_COUNTS',
    async (_event, playlistId: string) => {
        try {
            return await getCategoriesWithCounts(playlistId);
        } catch (error) {
            console.error(LOG_TAG, 'Error getting categories with counts:', error);
            throw error;
        }
    }
);

ipcMain.handle('DB_GET_PLAYLIST_STREAM_COUNTS', async () => {
    try {
        return await getPlaylistStreamCounts();
    } catch (error) {
        console.error(LOG_TAG, 'Error getting playlist stream counts:', error);
        throw error;
    }
});

ipcMain.handle(
    'DB_GET_DASHBOARD_HIGHLIGHTS',
    async (_event, playlistId: string, preferredLanguage?: string) => {
        try {
            return await getDashboardHighlights(playlistId, preferredLanguage);
        } catch (error) {
            console.error(LOG_TAG, 'Error getting dashboard highlights:', error);
            throw error;
        }
    }
);
