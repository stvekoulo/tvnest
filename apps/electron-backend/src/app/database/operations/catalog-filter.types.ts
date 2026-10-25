// Types et constantes linguistiques du moteur de filtrage SQLite TVNest.
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
}

export interface CategoryWithCountRow {
    id: number;
    xtream_id: number;
    name: string;
    type: 'live' | 'movie' | 'series';
    hidden: number;
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

// Préfixes et marqueurs courants utilisés par les fournisseurs IPTV par langue.
export const LANGUAGE_PATTERNS: Record<string, string[]> = {
    FR: ['FR -%', 'FR|%', 'FR:%', '[FR]%', '|FR|%', '(FR)%', '%|FR|%', '%[FR]%', '%FRENCH%', '%FRANCAIS%', '%VOSTFR%', '%TRUEFRENCH%', '% VF %', '% VFF %'],
    EN: ['EN -%', 'EN|%', 'UK -%', 'US -%', '[EN]%', '[UK]%', '[US]%', '|EN|%', '|UK|%', '|US|%', '%ENGLISH%'],
    ES: ['ES -%', 'ES|%', '[ES]%', '|ES|%', '(ES)%', '%ESPANOL%', '%LATINO%', '%CASTELLANO%'],
    AR: ['AR -%', 'AR|%', '[AR]%', '|AR|%', '(AR)%', '%ARAB%', '%SHAHID%'],
    DE: ['DE -%', 'DE|%', '[DE]%', '|DE|%', '(DE)%', '%GERMAN%', '%DEUTSCH%'],
    IT: ['IT -%', 'IT|%', '[IT]%', '|IT|%', '(IT)%', '%ITALIA%'],
    PT: ['PT -%', 'PT|%', 'BR -%', '[PT]%', '[BR]%', '|PT|%', '|BR|%', '%PORTUG%', '%BRASIL%'],
    NL: ['NL -%', 'NL|%', '[NL]%', '|NL|%', '%DUTCH%', '%NEDERLAND%'],
    TR: ['TR -%', 'TR|%', '[TR]%', '|TR|%', '%TURK%'],
};
