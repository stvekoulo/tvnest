// Constructeur SQL paramétré (Drizzle) pour le filtrage et le tri rapide du catalogue.
import { type SQL, sql } from 'drizzle-orm';
import { isParentalLockActive } from '../parental-lock-state';
import {
    type CatalogFilterQuery,
    LANGUAGE_PATTERNS,
} from './catalog-filter.types';

const ADULT_PATTERNS = [
    '%XXX%',
    '%18+%',
    '%+18%',
    '%ADULT%',
    '%PORN%',
    '%EROTIC%',
    '%EROTIQUE%',
    '%NSFW%',
    '%HENTAI%',
    '%X-RATED%',
];

export function escapeSqlLike(raw: string): string {
    return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function buildAdultExclusionSql(includeContentTitle = true): SQL {
    const checks = ADULT_PATTERNS.flatMap((pat) =>
        includeContentTitle
            ? [sql`cat.name NOT LIKE ${pat}`, sql`c.title NOT LIKE ${pat}`]
            : [sql`cat.name NOT LIKE ${pat}`]
    );
    return sql`(${sql.join(checks, sql` AND `)})`;
}

export function buildLanguageMatchSql(langCode?: string): SQL | null {
    if (!langCode || langCode === 'ALL') return null;
    const patterns = LANGUAGE_PATTERNS[langCode.toUpperCase()];
    if (!patterns || patterns.length === 0) return null;

    const checks = patterns.map(
        (pat) => sql`(c.title LIKE ${pat} OR cat.name LIKE ${pat})`
    );
    return sql`(${sql.join(checks, sql` OR `)})`;
}

export function buildCategoryLanguageMatchSql(langCode?: string): SQL | null {
    if (!langCode || langCode === 'ALL') return null;
    const patterns = LANGUAGE_PATTERNS[langCode.toUpperCase()];
    if (!patterns || patterns.length === 0) return null;
    return sql`(${sql.join(
        patterns.map((pat) => sql`cat.name LIKE ${pat}`),
        sql` OR `
    )})`;
}

function buildQualitySql(quality?: string): SQL | null {
    if (!quality || quality === 'ALL') return null;
    switch (quality) {
        case '4K':
            return sql`(c.title LIKE '%4K%' OR c.title LIKE '%UHD%' OR c.title LIKE '%2160%')`;
        case 'FHD':
            return sql`(c.title LIKE '%FHD%' OR c.title LIKE '%1080%' OR c.title LIKE '%FULL HD%')`;
        case 'HD':
            return sql`((c.title LIKE '% HD%' OR c.title LIKE '%|HD%' OR c.title LIKE '%[HD%' OR c.title LIKE '%720%') AND c.title NOT LIKE '%FHD%' AND c.title NOT LIKE '%UHD%')`;
        case 'HEVC':
            return sql`(c.title LIKE '%HEVC%' OR c.title LIKE '%H265%' OR c.title LIKE '%H.265%' OR c.title LIKE '%X265%')`;
        default:
            return null;
    }
}

function buildYearSql(year?: string): SQL | null {
    if (!year || year === 'ALL') return null;
    if (/^\d{4}$/.test(year)) {
        const yNum = Number(year);
        const pParen = `%(${year})%`;
        const pSpace = `% ${year}%`;
        return sql`(c.release_year = ${yNum} OR c.title LIKE ${pParen} OR c.title LIKE ${pSpace})`;
    }
    if (year === '2020s') {
        return sql`((c.release_year >= 2020 AND c.release_year <= 2029) OR c.title LIKE '%(202%' OR c.title LIKE '% 202%')`;
    }
    if (year === '2010s') {
        return sql`((c.release_year >= 2010 AND c.release_year <= 2019) OR c.title LIKE '%(201%' OR c.title LIKE '% 201%')`;
    }
    if (year === 'classic') {
        return sql`((c.release_year > 1900 AND c.release_year < 2010) OR c.title LIKE '%(19%' OR c.title LIKE '%(200%')`;
    }
    return null;
}

function buildSearchClauses(rawSearch: string): SQL[] {
    const tokens = rawSearch
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6);
    if (tokens.length === 0) return [];

    const ftsWords = tokens
        .flatMap((t) => t.match(/[A-Za-z0-9\u00C0-\u024F]{3,}/g) ?? [])
        .slice(0, 6);

    const out: SQL[] = [];
    if (ftsWords.length === tokens.length && ftsWords.length > 0) {
        const ftsMatch = ftsWords
            .map((w) => `"${w.replace(/"/g, '""')}"*`)
            .join(' AND ');
        const catChecks = tokens.map((token) => {
            const like = `%${escapeSqlLike(token)}%`;
            return sql`(cat.name LIKE ${like} ESCAPE '\\' OR COALESCE(c.original_title, '') LIKE ${like} ESCAPE '\\')`;
        });
        out.push(
            sql`(c.id IN (SELECT rowid FROM content_title_fts WHERE content_title_fts MATCH ${ftsMatch}) OR (${sql.join(catChecks, sql` AND `)}))`
        );
        return out;
    }

    for (const token of tokens) {
        const like = `%${escapeSqlLike(token)}%`;
        out.push(
            sql`(c.title LIKE ${like} ESCAPE '\\' OR COALESCE(c.original_title, '') LIKE ${like} ESCAPE '\\' OR cat.name LIKE ${like} ESCAPE '\\')`
        );
    }
    return out;
}

export function buildCatalogWhereSql(query: CatalogFilterQuery): SQL {
    const clauses: SQL[] = [
        sql`cat.playlist_id = ${query.playlistId}`,
        sql`cat.hidden = 0`,
    ];

    if (isParentalLockActive()) {
        clauses.push(sql`cat.locked = 0`);
        clauses.push(buildAdultExclusionSql(true));
    }

    if (query.type && query.type !== 'all') {
        clauses.push(sql`c.type = ${query.type}`);
    }

    if (query.categoryName && query.categoryName !== 'ALL') {
        clauses.push(sql`cat.name = ${query.categoryName}`);
    }

    if (query.search && query.search.trim().length > 0) {
        clauses.push(...buildSearchClauses(query.search));
    }

    const langSql = buildLanguageMatchSql(query.language);
    if (langSql) clauses.push(langSql);

    const qualSql = buildQualitySql(query.quality);
    if (qualSql) clauses.push(qualSql);

    if (query.minRating && query.minRating > 0) {
        clauses.push(
            sql`CAST(COALESCE(c.rating, '0') AS REAL) >= ${query.minRating}`
        );
    }

    const yearSql = buildYearSql(query.year);
    if (yearSql) clauses.push(yearSql);

    if (query.onlyFavorites) {
        clauses.push(
            sql`EXISTS (
                SELECT 1 FROM favorites f2
                WHERE f2.playlist_id = ${query.playlistId}
                  AND (
                      f2.content_id = c.id
                      OR (f2.content_id IS NULL AND f2.type = c.type AND f2.xtream_id = c.xtream_id AND f2.identity_conflict = 0)
                  )
            )`
        );
    }

    if (query.onlyHistory) {
        clauses.push(
            sql`EXISTS (SELECT 1 FROM recently_viewed rv WHERE rv.content_id = c.id AND rv.playlist_id = ${query.playlistId})`
        );
    }

    if (query.hasCatchup) {
        clauses.push(sql`COALESCE(c.tv_archive, 0) > 0`);
    }

    if (query.hasEpg) {
        clauses.push(
            sql`(c.epg_channel_id IS NOT NULL AND TRIM(c.epg_channel_id) <> '')`
        );
    }

    if (query.onlyWithPoster) {
        clauses.push(
            sql`(
                (c.poster_url IS NOT NULL AND (c.poster_url LIKE 'http://%' OR c.poster_url LIKE 'https://%'))
                OR (c.backdrop_url IS NOT NULL AND (c.backdrop_url LIKE 'http://%' OR c.backdrop_url LIKE 'https://%'))
            )`
        );
    }

    return sql.join(clauses, sql` AND `);
}

export function buildCatalogOrderBySql(query: CatalogFilterQuery): SQL {
    if (query.onlyHistory) {
        return sql`(SELECT MAX(rv2.viewed_at) FROM recently_viewed rv2 WHERE rv2.content_id = c.id AND rv2.playlist_id = ${query.playlistId}) DESC`;
    }

    const sortBy = query.sortBy || 'recommended';
    switch (sortBy) {
        case 'added_desc':
            return sql`c.added DESC, c.id DESC`;
        case 'rating_desc':
            return sql`CAST(COALESCE(c.rating, '0') AS REAL) DESC, c.id DESC`;
        case 'title_asc':
            return sql`c.title COLLATE NOCASE ASC`;
        case 'title_desc':
            return sql`c.title COLLATE NOCASE DESC`;
        case 'year_desc':
            return sql`COALESCE(c.release_year, 0) DESC, CAST(COALESCE(c.rating, '0') AS REAL) DESC`;
        case 'recommended':
        default: {
            const prefSql = buildLanguageMatchSql(query.preferredLanguage);
            if (prefSql && (!query.language || query.language === 'ALL')) {
                return sql`CASE WHEN ${prefSql} THEN 0 ELSE 1 END ASC, CAST(COALESCE(c.rating, '0') AS REAL) DESC, c.added DESC`;
            }
            return sql`CAST(COALESCE(c.rating, '0') AS REAL) DESC, c.added DESC, c.id ASC`;
        }
    }
}
