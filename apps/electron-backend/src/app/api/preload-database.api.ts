// Tranche preload Electron : playlists, catégories, favoris, TMDB et filtrage SQLite TVNest.
import type {
    ContentMetadataPatch,
    ElectronBridgeApi,
    ElectronBridgeFavoriteReorderUpdate,
    ElectronBridgePlaylistInput,
    ElectronBridgePlaylistUpsertInput,
    ElectronBridgeXtreamContentStream,
    GlobalSearchPaginationOptions,
    GlobalSearchResultSource,
    Playlist,
    TmdbCacheEntry,
    TmdbCacheMediaType,
    VodSourcePin,
    XtreamBackupFavoriteItem,
    XtreamCategory,
    XtreamFavoriteRemovalRef,
} from '@iptvnator/shared/interfaces';
import { ipcRenderer } from 'electron';
import type {
    CatalogFilterQuery,
    CatalogFilterResult,
    CategoryWithCountRow,
    DashboardHighlightsResult,
    PlaylistStreamCounts,
} from '../database/operations/catalog-filter.types';

export type PreloadDatabaseCoreSlice = Pick<
    ElectronBridgeApi,
    | 'dbCreatePlaylist'
    | 'dbGetPlaylist'
    | 'dbSetPlaylistServerTimezone'
    | 'dbUpsertAppPlaylist'
    | 'dbMigrateAppPlaylists'
    | 'dbRecoverLegacyPlaylists'
    | 'dbUpsertAppPlaylists'
    | 'dbGetAppPlaylists'
    | 'dbGetAppPlaylistMetas'
    | 'dbGetAppPlaylist'
    | 'dbGetAppPlaylistFavoriteChannels'
    | 'dbUpdatePlaylist'
    | 'dbDeletePlaylist'
    | 'dbDeleteXtreamContent'
    | 'dbRestoreXtreamFavorites'
    | 'dbRestoreXtreamUserData'
    | 'dbHasCategories'
    | 'dbGetCategories'
    | 'dbSaveCategories'
    | 'dbGetAllCategories'
    | 'dbUpdateCategoryVisibility'
    | 'dbSetCategoryLocks'
    | 'dbHasContent'
    | 'dbGetContent'
    | 'dbSaveContent'
    | 'dbClearXtreamImportCache'
    | 'dbSearchContent'
    | 'dbGlobalSearch'
    | 'dbGetGlobalRecentlyAdded'
    | 'dbGetRecentlyViewed'
    | 'dbClearRecentlyViewed'
    | 'dbAddFavorite'
    | 'dbRemoveFavorite'
    | 'dbIsFavorite'
    | 'dbGetFavoritesForBackup'
    | 'dbGetFavorites'
    | 'dbGetGlobalFavorites'
    | 'dbGetAllGlobalFavorites'
    | 'dbReorderGlobalFavorites'
    | 'dbGetRecentItems'
    | 'dbAddRecentItem'
    | 'dbClearPlaylistRecentItems'
    | 'dbRemoveRecentItem'
    | 'dbRemoveRecentItemsBatch'
    | 'dbGetContentByXtreamId'
    | 'dbSetContentMetadataIfMissing'
    | 'dbDeleteAllPlaylists'
    | 'dbCancelOperation'
    | 'dbGetAppState'
    | 'dbSetAppState'
    | 'dbGetTmdbMetadata'
    | 'dbSetTmdbMetadata'
    | 'dbGetTmdbCacheStats'
    | 'dbClearTmdbMetadata'
    | 'dbMatchTitles'
    | 'dbFindTitleSources'
    | 'dbGetVodSourcePin'
    | 'dbListVodSourcePins'
    | 'dbClearVodSourcePinsForPlaylist'
    | 'dbSetVodSourcePin'
    | 'dbReplaceVodSourcePins'
    | 'dbClearVodSourcePin'
>;

export const preloadDatabaseCoreApi: PreloadDatabaseCoreSlice = {
    dbCreatePlaylist: (playlist: ElectronBridgePlaylistUpsertInput) =>
        ipcRenderer.invoke('DB_CREATE_PLAYLIST', playlist),
    dbGetPlaylist: (playlistId: string) =>
        ipcRenderer.invoke('DB_GET_PLAYLIST', playlistId),
    dbSetPlaylistServerTimezone: (
        playlistId: string,
        conn: { serverUrl: string; username: string; password: string },
        tz: string
    ) => ipcRenderer.invoke('DB_SET_PLAYLIST_SERVER_TIMEZONE', playlistId, conn, tz),
    dbUpsertAppPlaylist: (playlist: Playlist, _op?: string) =>
        ipcRenderer.invoke('DB_UPSERT_APP_PLAYLIST', playlist),
    dbMigrateAppPlaylists: (playlists: Playlist[]) =>
        ipcRenderer.invoke('DB_MIGRATE_APP_PLAYLISTS', playlists),
    dbRecoverLegacyPlaylists: () =>
        ipcRenderer.invoke('DB_RECOVER_LEGACY_PLAYLISTS'),
    dbUpsertAppPlaylists: (playlists: Playlist[]) =>
        ipcRenderer.invoke('DB_UPSERT_APP_PLAYLISTS', playlists),
    dbGetAppPlaylists: () => ipcRenderer.invoke('DB_GET_APP_PLAYLISTS'),
    dbGetAppPlaylistMetas: () => ipcRenderer.invoke('DB_GET_APP_PLAYLIST_METAS'),
    dbGetAppPlaylist: (playlistId: string, _op?: string) =>
        ipcRenderer.invoke('DB_GET_APP_PLAYLIST', playlistId),
    dbGetAppPlaylistFavoriteChannels: (playlistId: string) =>
        ipcRenderer.invoke('DB_GET_APP_PLAYLIST_FAVORITE_CHANNELS', playlistId),
    dbUpdatePlaylist: (playlistId: string, updates: Partial<Playlist> | ElectronBridgePlaylistInput) =>
        ipcRenderer.invoke('DB_UPDATE_PLAYLIST', playlistId, updates),
    dbDeletePlaylist: (playlistId: string, operationId?: string) =>
        ipcRenderer.invoke('DB_DELETE_PLAYLIST', playlistId, operationId),
    dbDeleteXtreamContent: (playlistId: string, operationId?: string) =>
        ipcRenderer.invoke('DB_DELETE_XTREAM_CONTENT', playlistId, operationId),
    dbRestoreXtreamFavorites: (playlistId: string, favorites: XtreamBackupFavoriteItem[], restoreId?: string) =>
        ipcRenderer.invoke('DB_RESTORE_XTREAM_FAVORITES', playlistId, favorites, restoreId),
    dbRestoreXtreamUserData: (playlistId: string, favs: unknown[], recent: unknown[], op?: string) =>
        ipcRenderer.invoke('DB_RESTORE_XTREAM_USER_DATA', playlistId, favs, recent, op),
    dbHasCategories: (playlistId: string, type: string) =>
        ipcRenderer.invoke('DB_HAS_CATEGORIES', playlistId, type),
    dbGetCategories: (playlistId: string, type: string) =>
        ipcRenderer.invoke('DB_GET_CATEGORIES', playlistId, type),
    dbSaveCategories: (playlistId: string, cats: XtreamCategory[], type: string, hidden?: number[], locked?: number[]) =>
        ipcRenderer.invoke('DB_SAVE_CATEGORIES', playlistId, cats, type, hidden, locked),
    dbGetAllCategories: (playlistId: string, type: string) =>
        ipcRenderer.invoke('DB_GET_ALL_CATEGORIES', playlistId, type),
    dbUpdateCategoryVisibility: (categoryIds: number[], hidden: boolean) =>
        ipcRenderer.invoke('DB_UPDATE_CATEGORY_VISIBILITY', categoryIds, hidden),
    dbSetCategoryLocks: (playlistId: string, type: string, lockedXtreamIds: number[]) =>
        ipcRenderer.invoke('DB_SET_CATEGORY_LOCKS', playlistId, type, lockedXtreamIds),
    dbHasContent: (playlistId: string, type: string) =>
        ipcRenderer.invoke('DB_HAS_CONTENT', playlistId, type),
    dbGetContent: (playlistId: string, type: string) =>
        ipcRenderer.invoke('DB_GET_CONTENT', playlistId, type),
    dbSaveContent: (playlistId: string, streams: ElectronBridgeXtreamContentStream[], type: string, op?: string) =>
        ipcRenderer.invoke('DB_SAVE_CONTENT', playlistId, streams, type, op),
    dbClearXtreamImportCache: (playlistId: string, type: 'live' | 'movie' | 'series') =>
        ipcRenderer.invoke('DB_CLEAR_XTREAM_IMPORT_CACHE', playlistId, type),
    dbSearchContent: (playlistId: string, term: string, types: string[], excludeHidden?: boolean) =>
        ipcRenderer.invoke('DB_SEARCH_CONTENT', playlistId, term, types, excludeHidden),
    dbGlobalSearch: (term: string, types: string[], excludeHidden?: boolean, sources?: GlobalSearchResultSource[], opts?: GlobalSearchPaginationOptions) =>
        sources?.length || opts
            ? ipcRenderer.invoke('DB_GLOBAL_SEARCH', term, types, excludeHidden, sources, opts)
            : ipcRenderer.invoke('DB_GLOBAL_SEARCH', term, types, excludeHidden),
    dbGetGlobalRecentlyAdded: (kind: 'all' | 'vod' | 'series', limit?: number, plType?: 'xtream' | 'stalker' | 'm3u-file' | 'm3u-text' | 'm3u-url') =>
        ipcRenderer.invoke('DB_GET_GLOBAL_RECENTLY_ADDED', kind, limit, plType),
    dbGetRecentlyViewed: () => ipcRenderer.invoke('DB_GET_RECENTLY_VIEWED'),
    dbClearRecentlyViewed: () => ipcRenderer.invoke('DB_CLEAR_RECENTLY_VIEWED'),
    dbAddFavorite: (contentId: number, playlistId: string, backdropUrl?: string) =>
        ipcRenderer.invoke('DB_ADD_FAVORITE', contentId, playlistId, backdropUrl),
    dbRemoveFavorite: (contentId: XtreamFavoriteRemovalRef, playlistId: string) =>
        ipcRenderer.invoke('DB_REMOVE_FAVORITE', contentId, playlistId),
    dbIsFavorite: (contentId: number, playlistId: string) =>
        ipcRenderer.invoke('DB_IS_FAVORITE', contentId, playlistId),
    dbGetFavoritesForBackup: (playlistId: string) =>
        ipcRenderer.invoke('DB_GET_FAVORITES_FOR_BACKUP', playlistId),
    dbGetFavorites: (playlistId: string) =>
        ipcRenderer.invoke('DB_GET_FAVORITES', playlistId),
    dbGetGlobalFavorites: () => ipcRenderer.invoke('DB_GET_GLOBAL_FAVORITES'),
    dbGetAllGlobalFavorites: () => ipcRenderer.invoke('DB_GET_ALL_GLOBAL_FAVORITES'),
    dbReorderGlobalFavorites: (updates: ElectronBridgeFavoriteReorderUpdate[]) =>
        ipcRenderer.invoke('DB_REORDER_GLOBAL_FAVORITES', updates),
    dbGetRecentItems: (playlistId: string) =>
        ipcRenderer.invoke('DB_GET_RECENT_ITEMS', playlistId),
    dbAddRecentItem: (contentId: number, playlistId: string, backdropUrl?: string) =>
        ipcRenderer.invoke('DB_ADD_RECENT_ITEM', contentId, playlistId, backdropUrl),
    dbClearPlaylistRecentItems: (playlistId: string) =>
        ipcRenderer.invoke('DB_CLEAR_PLAYLIST_RECENT_ITEMS', playlistId),
    dbRemoveRecentItem: (contentId: number, playlistId: string) =>
        ipcRenderer.invoke('DB_REMOVE_RECENT_ITEM', contentId, playlistId),
    dbRemoveRecentItemsBatch: (items: { contentId: number; playlistId: string }[]) =>
        ipcRenderer.invoke('DB_REMOVE_RECENT_ITEMS_BATCH', items),
    dbGetContentByXtreamId: (xtreamId: number, playlistId: string, contentType?: 'live' | 'movie' | 'series', identity?: ContentMetadataPatch) =>
        ipcRenderer.invoke('DB_GET_CONTENT_BY_XTREAM_ID', xtreamId, playlistId, contentType, ...(identity ? [identity] : [])),
    dbSetContentMetadataIfMissing: (contentId: number, patch?: ContentMetadataPatch) =>
        ipcRenderer.invoke('DB_SET_CONTENT_METADATA_IF_MISSING', contentId, patch),
    dbDeleteAllPlaylists: (op?: string) => ipcRenderer.invoke('DB_DELETE_ALL_PLAYLISTS', op),
    dbCancelOperation: (op: string) => ipcRenderer.invoke('DB_CANCEL_OPERATION', op),
    dbGetAppState: (key: string) => ipcRenderer.invoke('DB_GET_APP_STATE', key),
    dbSetAppState: (key: string, value: string) => ipcRenderer.invoke('DB_SET_APP_STATE', key, value),
    dbGetTmdbMetadata: (mediaType: TmdbCacheMediaType, lookupKey: string, language: string) =>
        ipcRenderer.invoke('DB_GET_TMDB_METADATA', mediaType, lookupKey, language),
    dbSetTmdbMetadata: (entry: TmdbCacheEntry) => ipcRenderer.invoke('DB_SET_TMDB_METADATA', entry),
    dbGetTmdbCacheStats: () => ipcRenderer.invoke('DB_GET_TMDB_CACHE_STATS'),
    dbClearTmdbMetadata: () => ipcRenderer.invoke('DB_CLEAR_TMDB_METADATA'),
    dbMatchTitles: (titles: string[]) => ipcRenderer.invoke('DB_MATCH_TITLES', titles),
    dbFindTitleSources: (req: { title: string; year?: number | null; excludePlaylistId?: string | null }) =>
        ipcRenderer.invoke('DB_FIND_TITLE_SOURCES', req),
    dbGetVodSourcePin: (matchKeys: string[]) => ipcRenderer.invoke('DB_GET_VOD_SOURCE_PIN', matchKeys),
    dbListVodSourcePins: (playlistId: string) => ipcRenderer.invoke('DB_LIST_VOD_SOURCE_PINS', playlistId),
    dbClearVodSourcePinsForPlaylist: (playlistId: string) =>
        ipcRenderer.invoke('DB_CLEAR_VOD_SOURCE_PINS_FOR_PLAYLIST', playlistId),
    dbSetVodSourcePin: (pin: VodSourcePin, retireKeys?: string[], aliasKeys?: string[]) =>
        ipcRenderer.invoke('DB_SET_VOD_SOURCE_PIN', pin, retireKeys ?? [], aliasKeys ?? []),
    dbReplaceVodSourcePins: (playlistId: string, pins: VodSourcePin[]) =>
        ipcRenderer.invoke('DB_REPLACE_VOD_SOURCE_PINS', playlistId, pins),
    dbClearVodSourcePin: (matchKeys: string[]) => ipcRenderer.invoke('DB_CLEAR_VOD_SOURCE_PIN', matchKeys),
};

// Extensions SQLite TVNest pour filtrage, facettes, compteurs et tranches d'accueil.
export const preloadCatalogFilterApi = {
    dbQueryCatalog: (query: CatalogFilterQuery): Promise<CatalogFilterResult> =>
        ipcRenderer.invoke('DB_QUERY_CATALOG', query),
    dbGetCategoriesWithCounts: (playlistId: string, language?: string): Promise<CategoryWithCountRow[]> =>
        ipcRenderer.invoke('DB_GET_CATEGORIES_WITH_COUNTS', playlistId, language),
    dbGetPlaylistStreamCounts: (): Promise<Record<string, PlaylistStreamCounts>> =>
        ipcRenderer.invoke('DB_GET_PLAYLIST_STREAM_COUNTS'),
    dbGetDashboardHighlights: (
        playlistId: string,
        preferredLanguage?: string
    ): Promise<DashboardHighlightsResult> =>
        ipcRenderer.invoke('DB_GET_DASHBOARD_HIGHLIGHTS', playlistId, preferredLanguage),
};
