// Constructeur SQL paramétré (Drizzle) pour le filtrage et le tri rapide du catalogue.
import { type SQL, sql } from 'drizzle-orm';
import { getParentalLockActive } from '../../services/parental-lock-state';
import {
    type CatalogFilterQuery,
    LANGUAGE_PATTERNS,
} from './catalog-filter.types';

// Construit l'expression SQL testant l'appartenance d'un flux ou groupe à une langue.
export function buildLanguageMatchSql(langCode?: string): SQL | null {
    if (!langCode || langCode === 'ALL') return null;
    const patterns = LANGUAGE_PATTERNS[langCode.toUpperCase()];
    if (!patterns || patterns.length === 0) return null;

    const checks = patterns.map(
        (pat) => sql`(c.title LIKE ${pat} OR cat.name LIKE ${pat})`
    );
    return sql`(${sql.join(checks, sql` OR `)})`;
}

// Variante pour la liste des groupes : seule la langue du nom du groupe compte.
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

// Assemble la clause WHERE complète pour les requêtes SQLite de `content` + `categories`.
export function buildCatalogWhereSql(query: CatalogFilterQuery): SQL {
    const clauses: SQL[] = [
        sql`cat.playlist_id = ${query.playlistId}`,
        sql`cat.hidden = 0`,
    ];

    if (getParentalLockActive()) {
        clauses.push(sql`cat.locked = 0`);
    }

    if (query.type && query.type !== 'all') {
        clauses.push(sql`c.type = ${query.type}`);
    }

    if (query.categoryName && query.categoryName !== 'ALL') {
        clauses.push(sql`cat.name = ${query.categoryName}`);
    }

    if (query.search && query.search.trim().length > 0) {
        const tokens = query.search
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 6);
        for (const token of tokens) {
            const like = `%${token}%`;
            clauses.push(
                sql`(c.title LIKE ${like} OR COALESCE(c.original_title, '') LIKE ${like} OR cat.name LIKE ${like})`
            );
        }
    }

    const langSql = buildLanguageMatchSql(query.language);
    if (langSql) clauses.push(langSql);

    const qualSql = buildQualitySql(query.quality);
    if (qualSql) clauses.push(qualSql);

    if (query.minRating && query.minRating > 0) {
        clauses.push(sql`CAST(COALESCE(c.rating, '0') AS REAL) >= ${query.minRating}`);
    }

    const yearSql = buildYearSql(query.year);
    if (yearSql) clauses.push(yearSql);

    if (query.onlyFavorites) {
        clauses.push(
            sql`EXISTS (SELECT 1 FROM favorites f2 WHERE f2.content_id = c.id AND f2.playlist_id = ${query.playlistId})`
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

// Assemble la clause ORDER BY avec priorité linguistique optionnelle.
export function buildCatalogOrderBySql(query: CatalogFilterQuery): SQL {
    if (query.onlyHistory) {
        return sql`(SELECT MAX(rv2.viewed_at) FROM recently_viewed rv2 WHERE rv2.content_id = c.id AND rv2.playlist_id = ${query.playlistId}) DESC`;
    }

    const sortBy = query.sortBy || 'recommended';
    switch (sortBy) {
        case 'added_desc':
            return sql`CAST(COALESCE(c.added, '0') AS INTEGER) DESC, c.id DESC`;
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
                return sql`CASE WHEN ${prefSql} THEN 0 ELSE 1 END ASC, CAST(COALESCE(c.rating, '0') AS REAL) DESC, CAST(COALESCE(c.added, '0') AS INTEGER) DESC`;
            }
            return sql`CAST(COALESCE(c.rating, '0') AS REAL) DESC, CAST(COALESCE(c.added, '0') AS INTEGER) DESC, c.id ASC`;
        }
    }
}
