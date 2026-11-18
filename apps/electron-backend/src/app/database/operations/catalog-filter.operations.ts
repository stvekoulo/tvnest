// Opérations SQLite de recherche avancée, compteurs réels et tranches d'accueil TVNest.
import { sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import type { AppDatabase } from '../database.types';
import { isParentalLockActive } from '../parental-lock-state';
import {
    countM3uPayloadStreams,
    extractM3uCategoriesWithCounts,
    extractM3uRowsFromPayload,
    filterM3uRows,
} from './catalog-filter-m3u';
import {
    buildAdultExclusionSql,
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

interface PlaylistMetaLightRow {
    id: string;
    type: string;
    count: number | null;
    favorites: string | null;
    recently_viewed: string | null;
}

interface PlaylistPayloadRow extends PlaylistMetaLightRow {
    payload: string | null;
}

async function resolveDb(dbParam?: AppDatabase): Promise<AppDatabase> {
    return dbParam ?? (await getDatabase());
}

async function readPlaylistPayload(db: AppDatabase, playlistId: string): Promise<string | null> {
    const rows = (await db.all(sql`
        SELECT payload FROM playlists WHERE id = ${playlistId} LIMIT 1
    `)) as Array<{ payload: string | null }>;
    return rows[0]?.payload ?? null;
}

export async function queryCatalog(
    query: CatalogFilterQuery,
    dbParam?: AppDatabase
): Promise<CatalogFilterResult> {
    const startedAt = performance.now();
    const db = await resolveDb(dbParam);
    const limit = Math.min(Math.max(query.limit || 120, 1), 500);
    const offset = Math.max(query.offset || 0, 0);

    const plRows = (await db.all(sql`
        SELECT id, type, count, favorites, recently_viewed
        FROM playlists WHERE id = ${query.playlistId} LIMIT 1
    `)) as PlaylistMetaLightRow[];
    const pl = plRows[0];
    if (!pl) return { items: [], total: 0, limit, offset, tookMs: 0, years: [] };

    if (pl.type !== 'xtream') {
        const payload = await readPlaylistPayload(db, pl.id);
        const m3uRows = extractM3uRowsFromPayload(payload, pl.favorites, pl.id);
        return filterM3uRows(m3uRows, { ...query, limit, offset }, startedAt, pl.recently_viewed);
    }

    const whereSql = buildCatalogWhereSql(query);
    const orderSql = buildCatalogOrderBySql(query);

    const countRows = (await db.all(sql`
        SELECT COUNT(*) as total FROM content c
        INNER JOIN categories cat ON c.category_id = cat.id
        WHERE ${whereSql}
    `)) as Array<{ total: number }>;

    const items = (await db.all(sql`
        SELECT
            c.id, c.xtream_id, c.title, c.type, c.category_id,
            cat.name as category_name, c.poster_url, c.backdrop_url,
            c.rating, c.release_year, c.added, c.epg_channel_id,
            c.tv_archive, c.direct_source,
            CASE WHEN EXISTS (
                SELECT 1 FROM favorites fav
                WHERE fav.playlist_id = ${query.playlistId}
                  AND (fav.content_id = c.id OR (fav.content_id IS NULL AND fav.type = c.type AND fav.xtream_id = c.xtream_id AND fav.identity_conflict = 0))
            ) THEN 1 ELSE 0 END as is_favorite
        FROM content c
        INNER JOIN categories cat ON c.category_id = cat.id
        WHERE ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${limit} OFFSET ${offset}
    `)) as CatalogStreamRow[];

    let years: string[] | undefined;
    if (offset === 0 && query.type !== 'live') {
        const typeClause = query.type && query.type !== 'all' ? sql`AND c.type = ${query.type}` : sql``;
        const lockClause = isParentalLockActive()
            ? sql`AND cat.locked = 0 AND ${buildAdultExclusionSql(false)}`
            : sql``;
        const yearRows = (await db.all(sql`
            SELECT DISTINCT CAST(c.release_year AS TEXT) as y
            FROM content c INNER JOIN categories cat ON c.category_id = cat.id
            WHERE cat.playlist_id = ${query.playlistId} AND cat.hidden = 0
              ${lockClause} ${typeClause}
              AND c.release_year IS NOT NULL AND c.release_year >= 1900
            ORDER BY c.release_year DESC LIMIT 60
        `)) as Array<{ y: string }>;
        years = yearRows.map((r) => r.y).filter(Boolean);
    }

    return {
        items,
        total: Number(countRows[0]?.total || 0),
        limit,
        offset,
        tookMs: Math.round(performance.now() - startedAt),
        years,
    };
}

export async function getCategoriesWithCounts(
    playlistId: string,
    language?: string,
    dbParam?: AppDatabase
): Promise<CategoryWithCountRow[]> {
    const db = await resolveDb(dbParam);
    const plRows = (await db.all(sql`
        SELECT id, type, favorites, recently_viewed, count
        FROM playlists WHERE id = ${playlistId} LIMIT 1
    `)) as PlaylistMetaLightRow[];
    const pl = plRows[0];
    if (!pl) return [];
    if (pl.type !== 'xtream') {
        const payload = await readPlaylistPayload(db, pl.id);
        return extractM3uCategoriesWithCounts(payload, pl.favorites, language, pl.id);
    }

    const parentalClause = isParentalLockActive()
        ? sql`AND cat.locked = 0 AND ${buildAdultExclusionSql(false)}`
        : sql``;

    return (await db.all(sql`
        SELECT
            cat.id, cat.xtream_id, cat.name,
            CASE WHEN cat.type = 'movies' THEN 'movie' ELSE cat.type END as type,
            cat.hidden, cat.locked, COUNT(c.id) as stream_count
        FROM categories cat
        LEFT JOIN content c ON c.category_id = cat.id
        WHERE cat.playlist_id = ${playlistId} AND cat.hidden = 0
          ${parentalClause}
          AND ${buildCategoryLanguageMatchSql(language) ?? sql`1 = 1`}
        GROUP BY cat.id
        HAVING COUNT(c.id) > 0
        ORDER BY cat.id ASC
    `)) as CategoryWithCountRow[];
}

export async function getPlaylistStreamCounts(
    dbParam?: AppDatabase
): Promise<Record<string, PlaylistStreamCounts>> {
    const db = await resolveDb(dbParam);
    const out: Record<string, PlaylistStreamCounts> = {};
    const parentalClause = isParentalLockActive()
        ? sql`AND cat.locked = 0 AND ${buildAdultExclusionSql(true)}`
        : sql``;

    const sqlCounts = (await db.all(sql`
        SELECT cat.playlist_id as playlist_id, c.type as stream_type, COUNT(c.id) as cnt
        FROM content c INNER JOIN categories cat ON c.category_id = cat.id
        WHERE cat.hidden = 0 ${parentalClause}
        GROUP BY cat.playlist_id, c.type
    `)) as Array<{ playlist_id: string; stream_type: string; cnt: number }>;

    for (const row of sqlCounts) {
        const entry = out[row.playlist_id] || { total: 0, live: 0, movie: 0, series: 0 };
        const n = Number(row.cnt || 0);
        entry.total += n;
        if (row.stream_type === 'live') entry.live += n;
        else if (row.stream_type === 'movie') entry.movie += n;
        else if (row.stream_type === 'series') entry.series += n;
        out[row.playlist_id] = entry;
    }

    const m3uPlaylists = (await db.all(sql`
        SELECT id, type, count, payload, favorites, recently_viewed
        FROM playlists WHERE type <> 'xtream'
    `)) as PlaylistPayloadRow[];

    for (const pl of m3uPlaylists) {
        if (pl.payload) {
            out[pl.id] = countM3uPayloadStreams(pl.payload, pl.favorites, pl.id);
        } else if (pl.count && pl.count > 0) {
            out[pl.id] = { total: pl.count, live: pl.count, movie: 0, series: 0 };
        }
    }
    return out;
}

export async function getDashboardHighlights(
    playlistId: string,
    preferredLanguage?: string,
    dbParam?: AppDatabase
): Promise<DashboardHighlightsResult> {
    const db = await resolveDb(dbParam);
    const [countsMap, vodWithArt, serWithArt, liveSlice, favSlice, histSlice] =
        await Promise.all([
            getPlaylistStreamCounts(db),
            queryCatalog({ playlistId, type: 'movie', preferredLanguage, onlyWithPoster: true, sortBy: 'recommended', limit: 10 }, db),
            queryCatalog({ playlistId, type: 'series', preferredLanguage, onlyWithPoster: true, sortBy: 'recommended', limit: 8 }, db),
            queryCatalog({ playlistId, type: 'live', preferredLanguage, sortBy: 'recommended', limit: 12 }, db),
            queryCatalog({ playlistId, onlyFavorites: true, limit: 40 }, db),
            queryCatalog({ playlistId, onlyHistory: true, limit: 24 }, db),
        ]);

    const spotlightCandidates = [...vodWithArt.items.slice(0, 5), ...serWithArt.items.slice(0, 4)];
    const spotlight =
        spotlightCandidates.length > 0 ? spotlightCandidates.slice(0, 8) : liveSlice.items.slice(0, 6);

    return {
        spotlight,
        featuredLive: liveSlice.items,
        recentVod: [...vodWithArt.items, ...serWithArt.items],
        favorites: favSlice.items,
        recentlyViewed: histSlice.items,
        counts: countsMap[playlistId] || { total: 0, live: 0, movie: 0, series: 0 },
    };
}
