// Filtrage côté worker SQLite pour les playlists M3U/Stalker stockées dans `playlists.payload`.
import { isParentalLockActive } from '../parental-lock-state';
import {
    getBaseM3uRows,
    hashStreamKey,
    isAdultM3uRow,
    matchesWildcard,
    parseJsonStringSet,
} from './catalog-filter-m3u-cache';
import {
    type CatalogFilterQuery,
    type CatalogFilterResult,
    type CatalogStreamRow,
    type CategoryWithCountRow,
    LANGUAGE_PATTERNS,
    type PlaylistStreamCounts,
} from './catalog-filter.types';

export { hashStreamKey, isAdultM3uRow } from './catalog-filter-m3u-cache';

function matchesLanguageM3u(row: CatalogStreamRow, langCode?: string): boolean {
    if (!langCode || langCode === 'ALL') return true;
    const patterns = LANGUAGE_PATTERNS[langCode.toUpperCase()];
    if (!patterns) return true;
    return patterns.some(
        (pat) =>
            matchesWildcard(row.title, pat) ||
            matchesWildcard(row.category_name, pat)
    );
}

export function extractM3uRowsFromPayload(
    payloadStr: string | null,
    favoritesStr: string | null,
    playlistId?: string
): CatalogStreamRow[] {
    if (!payloadStr) return [];
    const base = getBaseM3uRows(payloadStr, playlistId);
    const favSet = parseJsonStringSet(favoritesStr);
    const hideAdult = isParentalLockActive();
    const out: CatalogStreamRow[] = [];

    for (const row of base) {
        if (hideAdult && isAdultM3uRow(row)) continue;
        const isFav =
            (row.stream_url && favSet.has(row.stream_url)) ||
            favSet.has(String(row.xtream_id))
                ? 1
                : 0;
        out.push(isFav === row.is_favorite ? row : { ...row, is_favorite: isFav });
    }
    return out;
}

export function countM3uPayloadStreams(
    payloadStr: string | null,
    favoritesStr: string | null,
    playlistId?: string
): PlaylistStreamCounts {
    const rows = extractM3uRowsFromPayload(payloadStr, favoritesStr, playlistId);
    let live = 0;
    let movie = 0;
    for (const r of rows) {
        if (r.type === 'movie') movie++;
        else live++;
    }
    return { total: rows.length, live, movie, series: 0 };
}

export function extractM3uCategoriesWithCounts(
    payloadStr: string | null,
    favoritesStr: string | null,
    language?: string,
    playlistId?: string
): CategoryWithCountRow[] {
    const patterns =
        language && language !== 'ALL'
            ? LANGUAGE_PATTERNS[language.toUpperCase()]
            : undefined;
    const rows = extractM3uRowsFromPayload(payloadStr, favoritesStr, playlistId).filter(
        (r) => !patterns || patterns.some((pat) => matchesWildcard(r.category_name, pat))
    );
    const map = new Map<string, { type: 'live' | 'movie'; count: number }>();
    for (const r of rows) {
        const key = `${r.type}::${r.category_name}`;
        const prev = map.get(key);
        map.set(key, {
            type: r.type === 'movie' ? 'movie' : 'live',
            count: (prev?.count || 0) + 1,
        });
    }
    return Array.from(map.entries()).map(([key, meta]) => {
        const name = key.split('::')[1] || 'Non classé';
        const cid = hashStreamKey(key);
        return {
            id: cid,
            xtream_id: cid,
            name,
            type: meta.type,
            hidden: 0,
            locked: 0,
            stream_count: meta.count,
        };
    });
}

export function filterM3uRows(
    rows: CatalogStreamRow[],
    query: CatalogFilterQuery,
    startedAt: number,
    recentlyViewedStr?: string | null
): CatalogFilterResult {
    const tokens = (query.search || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const recentOrder = query.onlyHistory
        ? Array.from(parseJsonStringSet(recentlyViewedStr))
        : null;
    const recentSet = recentOrder ? new Set(recentOrder) : null;
    const yearsSet = new Set<string>();

    const filtered = rows.filter((r) => {
        if (r.release_year) yearsSet.add(String(r.release_year));
        if (query.type && query.type !== 'all' && r.type !== query.type) return false;
        if (query.categoryName && query.categoryName !== 'ALL' && r.category_name !== query.categoryName) {
            return false;
        }
        if (tokens.length > 0) {
            const hay = `${r.title} ${r.category_name}`.toLowerCase();
            if (!tokens.every((t) => hay.includes(t))) return false;
        }
        if (!matchesLanguageM3u(r, query.language)) return false;
        if (query.quality && query.quality !== 'ALL') {
            const up = r.title.toUpperCase();
            if (query.quality === '4K' && !/(4K|UHD|2160)/.test(up)) return false;
            if (query.quality === 'FHD' && !/(FHD|1080|FULL HD)/.test(up)) return false;
            if (query.quality === 'HD' && (!/( HD|\|HD|\[HD|720)/.test(up) || /(FHD|UHD)/.test(up))) return false;
            if (query.quality === 'HEVC' && !/(HEVC|H265|H\.265|X265)/.test(up)) return false;
        }
        if (query.year && query.year !== 'ALL') {
            const ry = r.release_year;
            if (/^\d{4}$/.test(query.year) && ry !== Number(query.year)) return false;
            if (query.year === '2020s' && (!ry || ry < 2020 || ry > 2029)) return false;
            if (query.year === '2010s' && (!ry || ry < 2010 || ry > 2019)) return false;
            if (query.year === 'classic' && (!ry || ry >= 2010)) return false;
        }
        if (query.onlyFavorites && !r.is_favorite) return false;
        if (recentSet) {
            const matched =
                (r.stream_url && recentSet.has(r.stream_url)) ||
                recentSet.has(String(r.xtream_id));
            if (!matched) return false;
        }
        if (query.hasEpg && !r.epg_channel_id) return false;
        if (
            query.onlyWithPoster &&
            !(r.poster_url?.startsWith('http://') || r.poster_url?.startsWith('https://'))
        ) {
            return false;
        }
        return true;
    });

    if (recentOrder && recentOrder.length > 0) {
        const rank = new Map(recentOrder.map((key, idx) => [key, idx]));
        filtered.sort((a, b) => {
            const ra = rank.get(a.stream_url || '') ?? rank.get(String(a.xtream_id)) ?? 999999;
            const rb = rank.get(b.stream_url || '') ?? rank.get(String(b.xtream_id)) ?? 999999;
            return rb - ra;
        });
    } else if (query.sortBy === 'title_asc') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (query.sortBy === 'title_desc') {
        filtered.sort((a, b) => b.title.localeCompare(a.title));
    } else if (query.sortBy === 'year_desc') {
        filtered.sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
    } else if (query.preferredLanguage && query.preferredLanguage !== 'ALL') {
        filtered.sort((a, b) => {
            const ma = matchesLanguageM3u(a, query.preferredLanguage) ? 0 : 1;
            const mb = matchesLanguageM3u(b, query.preferredLanguage) ? 0 : 1;
            return ma - mb;
        });
    }

    const limit = Math.min(Math.max(query.limit || 120, 1), 500);
    const offset = Math.max(query.offset || 0, 0);
    return {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
        tookMs: Math.round(performance.now() - startedAt),
        years: Array.from(yearsSet).sort((a, b) => Number(b) - Number(a)).slice(0, 60),
    };
}
