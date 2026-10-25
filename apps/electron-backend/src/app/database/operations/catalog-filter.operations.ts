// Opérations SQLite de recherche avancée, compteurs réels et tranches d'accueil TVNest.
import { sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import {
    countM3uPayloadStreams,
    extractM3uCategoriesWithCounts,
    extractM3uRowsFromPayload,
    filterM3uRows,
} from './catalog-filter-m3u';
import {
    buildCatalogOrderBySql,
    buildCatalogWhereSql,
    buildCategoryLanguageMatchSql,
} from './catalog-filter-sql';
import type {
    CatalogFilterQuery,
    CatalogFilterResult,
    CatalogStreamRow,
    CategoryWithCountRow,
    DashboardHighlightsResult,
    PlaylistStreamCounts,
} from './catalog-filter.types';

interface PlaylistMetaRow {
    id: string;
    type: string;
    count: number | null;
    payload: string | null;
    favorites: string | null;
}

// Exécute une requête filtrée, triée et paginée sur SQLite (Xtream) ou payload (M3U).
export async function queryCatalog(
    query: CatalogFilterQuery
): Promise<CatalogFilterResult> {
    const startedAt = performance.now();
    const db = await getDatabase();
    const limit = Math.min(Math.max(query.limit || 120, 1), 500);
    const offset = Math.max(query.offset || 0, 0);

    const plRows = (await db.all(sql`
        SELECT id, type, count, payload, favorites
        FROM playlists
        WHERE id = ${query.playlistId}
        LIMIT 1
    `)) as PlaylistMetaRow[];

    const pl = plRows[0];
    if (!pl) {
        return { items: [], total: 0, limit, offset, tookMs: 0 };
    }

    if (pl.type !== 'xtream') {
        const m3uRows = extractM3uRowsFromPayload(pl.payload, pl.favorites);
        return filterM3uRows(m3uRows, { ...query, limit, offset }, startedAt);
    }

    const whereSql = buildCatalogWhereSql(query);
    const orderSql = buildCatalogOrderBySql(query);

    const countRows = (await db.all(sql`
        SELECT COUNT(*) as total
        FROM content c
        INNER JOIN categories cat ON c.category_id = cat.id
        WHERE ${whereSql}
    `)) as Array<{ total: number }>;

    const items = (await db.all(sql`
        SELECT
            c.id,
            c.xtream_id,
            c.title,
            c.type,
            c.category_id,
            cat.name as category_name,
            c.poster_url,
            c.backdrop_url,
            c.rating,
            c.release_year,
            c.added,
            c.epg_channel_id,
            c.tv_archive,
            c.direct_source,
            CASE WHEN fav.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
        FROM content c
        INNER JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN favorites fav
            ON fav.content_id = c.id AND fav.playlist_id = ${query.playlistId}
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${limit}
        OFFSET ${offset}
    `)) as CatalogStreamRow[];

    return {
        items,
        total: Number(countRows[0]?.total || 0),
        limit,
        offset,
        tookMs: Math.round(performance.now() - startedAt),
    };
}

// Retourne les catégories visibles d'une playlist avec leur nombre réel de flux,
// limitées aux groupes de la langue demandée (`language`, 'ALL' = toutes).
export async function getCategoriesWithCounts(
    playlistId: string,
    language?: string
): Promise<CategoryWithCountRow[]> {
    const db = await getDatabase();
    const plRows = (await db.all(sql`
        SELECT id, type, payload, favorites
        FROM playlists
        WHERE id = ${playlistId}
        LIMIT 1
    `)) as PlaylistMetaRow[];

    const pl = plRows[0];
    if (!pl) return [];
    if (pl.type !== 'xtream') {
        return extractM3uCategoriesWithCounts(pl.payload, pl.favorites, language);
    }

    const rows = (await db.all(sql`
        SELECT
            cat.id,
            cat.xtream_id,
            cat.name,
            CASE WHEN cat.type = 'movies' THEN 'movie' ELSE cat.type END as type,
            cat.hidden,
            COUNT(c.id) as stream_count
        FROM categories cat
        LEFT JOIN content c ON c.category_id = cat.id
        WHERE cat.playlist_id = ${playlistId} AND cat.hidden = 0
            AND ${buildCategoryLanguageMatchSql(language) ?? sql`1 = 1`}
        GROUP BY cat.id
        HAVING COUNT(c.id) > 0
        ORDER BY cat.id ASC
    `)) as CategoryWithCountRow[];

    return rows;
}

// Retourne le nombre réel de flux par playlist (corrige `LIVE TV (0)` dans la barre de titre).
export async function getPlaylistStreamCounts(): Promise<
    Record<string, PlaylistStreamCounts>
> {
    const db = await getDatabase();
    const out: Record<string, PlaylistStreamCounts> = {};

    const sqlCounts = (await db.all(sql`
        SELECT
            cat.playlist_id as playlist_id,
            c.type as stream_type,
            COUNT(c.id) as cnt
        FROM content c
        INNER JOIN categories cat ON c.category_id = cat.id
        WHERE cat.hidden = 0
        GROUP BY cat.playlist_id, c.type
    `)) as Array<{ playlist_id: string; stream_type: string; cnt: number }>;

    for (const row of sqlCounts) {
        const entry = out[row.playlist_id] || {
            total: 0,
            live: 0,
            movie: 0,
            series: 0,
        };
        const n = Number(row.cnt || 0);
        entry.total += n;
        if (row.stream_type === 'live') entry.live += n;
        else if (row.stream_type === 'movie') entry.movie += n;
        else if (row.stream_type === 'series') entry.series += n;
        out[row.playlist_id] = entry;
    }

    const m3uPlaylists = (await db.all(sql`
        SELECT id, type, count, payload, favorites
        FROM playlists
        WHERE type <> 'xtream'
    `)) as PlaylistMetaRow[];

    for (const pl of m3uPlaylists) {
        if (pl.payload) {
            out[pl.id] = countM3uPayloadStreams(pl.payload, pl.favorites);
        } else if (pl.count && pl.count > 0) {
            out[pl.id] = { total: pl.count, live: pl.count, movie: 0, series: 0 };
        }
    }

    return out;
}

// Prépare les sélections éditoriales réelles de la page d'accueil sans charger 150k lignes.
export async function getDashboardHighlights(
    playlistId: string,
    preferredLanguage?: string
): Promise<DashboardHighlightsResult> {
    const [countsMap, vodWithArt, serWithArt, liveSlice, favSlice, histSlice] =
        await Promise.all([
            getPlaylistStreamCounts(),
            queryCatalog({
                playlistId,
                type: 'movie',
                preferredLanguage,
                onlyWithPoster: true,
                sortBy: 'recommended',
                limit: 10,
            }),
            queryCatalog({
                playlistId,
                type: 'series',
                preferredLanguage,
                onlyWithPoster: true,
                sortBy: 'recommended',
                limit: 8,
            }),
            queryCatalog({
                playlistId,
                type: 'live',
                preferredLanguage,
                sortBy: 'recommended',
                limit: 12,
            }),
            queryCatalog({
                playlistId,
                onlyFavorites: true,
                limit: 40,
            }),
            queryCatalog({
                playlistId,
                onlyHistory: true,
                limit: 24,
            }),
        ]);

    const spotlightCandidates = [
        ...vodWithArt.items.slice(0, 5),
        ...serWithArt.items.slice(0, 4),
    ];
    const spotlight =
        spotlightCandidates.length > 0
            ? spotlightCandidates.slice(0, 8)
            : liveSlice.items.slice(0, 6);

    // Pas de tronquage : le front sépare films et séries en deux rangées.
    const recentVod = [...vodWithArt.items, ...serWithArt.items];

    return {
        spotlight,
        featuredLive: liveSlice.items,
        recentVod,
        favorites: favSlice.items,
        recentlyViewed: histSlice.items,
        counts: countsMap[playlistId] || {
            total: 0,
            live: 0,
            movie: 0,
            series: 0,
        },
    };
}
