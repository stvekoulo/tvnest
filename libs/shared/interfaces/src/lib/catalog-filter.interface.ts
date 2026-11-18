// Contrat IPC partagé pour le filtrage du catalogue SQLite / M3U / Stalker TVNest.
export type CatalogContentKind = 'all' | 'live' | 'movie' | 'series';

export type CatalogSortBy =
    | 'recommended'
    | 'added_desc'
    | 'rating_desc'
    | 'title_asc'
    | 'title_desc'
    | 'year_desc';

export type CatalogQualityFilter = 'ALL' | '4K' | 'FHD' | 'HD' | 'HEVC';

export interface CatalogFilterQuery {
    playlistId: string;
    type?: CatalogContentKind;
    categoryName?: string;
    search?: string;
    language?: string;
    preferredLanguage?: string;
    quality?: CatalogQualityFilter;
    minRating?: number;
    year?: string;
    onlyFavorites?: boolean;
    onlyHistory?: boolean;
    hasCatchup?: boolean;
    hasEpg?: boolean;
    onlyWithPoster?: boolean;
    sortBy?: CatalogSortBy;
    limit?: number;
    offset?: number;
}

export interface CatalogStreamRow {
    id: number;
    xtream_id: number;
    title: string;
    type: 'live' | 'movie' | 'series';
    category_id: number;
    category_name: string;
    poster_url: string | null;
    backdrop_url: string | null;
    rating: string | null;
    release_year: number | null;
    added: string | null;
    epg_channel_id: string | null;
    tv_archive: number | null;
    direct_source: string | null;
    is_favorite: number;
    stream_url?: string | null;
    user_agent?: string | null;
    referrer?: string | null;
}

export interface CatalogFilterResult {
    items: CatalogStreamRow[];
    total: number;
    limit: number;
    offset: number;
    tookMs: number;
    years?: string[];
}

export interface CategoryWithCountRow {
    id: number;
    xtream_id: number;
    name: string;
    type: 'live' | 'movie' | 'series';
    hidden: number;
    locked?: number;
    stream_count: number;
}

export interface PlaylistStreamCounts {
    total: number;
    live: number;
    movie: number;
    series: number;
}

export interface DashboardHighlightsResult {
    spotlight: CatalogStreamRow[];
    featuredLive: CatalogStreamRow[];
    recentVod: CatalogStreamRow[];
    favorites: CatalogStreamRow[];
    recentlyViewed: CatalogStreamRow[];
    counts: PlaylistStreamCounts;
}
