// Filtrage équivalent côté backend pour les playlists M3U/Stalker stockées dans `playlists.payload`.
import { isLikelyM3uVod } from '@iptvnator/shared/m3u-utils';
import {
    type CatalogFilterQuery,
    type CatalogFilterResult,
    type CatalogStreamRow,
    type CategoryWithCountRow,
    LANGUAGE_PATTERNS,
    type PlaylistStreamCounts,
} from './catalog-filter.types';

interface RawM3uItem {
    name?: string;
    url?: string;
    tvg?: { id?: string; logo?: string };
    group?: { title?: string };
    http?: { 'user-agent'?: string; referrer?: string };
}

function matchesWildcard(text: string, sqlLikePattern: string): boolean {
    const escaped = sqlLikePattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(text);
}

function matchesLanguageM3u(
    row: CatalogStreamRow,
    langCode?: string
): boolean {
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
    favoritesStr: string | null
): CatalogStreamRow[] {
    if (!payloadStr) return [];
    try {
        const parsed = JSON.parse(payloadStr) as { items?: RawM3uItem[] };
        const favArr: string[] = favoritesStr ? JSON.parse(favoritesStr) : [];
        const favSet = new Set(Array.isArray(favArr) ? favArr : []);
        const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];

        return rawItems
            .filter((it) => Boolean(it?.url && it?.name))
            .map((it, idx) => {
                const isVod = isLikelyM3uVod({
                    url: it.url || '',
                    radio: 'false',
                });
                const logo = it.tvg?.logo?.trim() || null;
                return {
                    id: idx + 1,
                    xtream_id: idx + 1,
                    title: it.name || `Flux ${idx + 1}`,
                    type: isVod ? 'movie' : 'live',
                    category_id: idx + 1,
                    category_name: it.group?.title?.trim() || 'Non classé',
                    poster_url: logo,
                    backdrop_url: logo,
                    rating: null,
                    release_year: null,
                    added: null,
                    epg_channel_id: it.tvg?.id?.trim() || null,
                    tv_archive: 0,
                    direct_source: it.url || null,
                    is_favorite: it.url && favSet.has(it.url) ? 1 : 0,
                    stream_url: it.url || null,
                    user_agent: it.http?.['user-agent'] || null,
                    referrer: it.http?.referrer || null,
                };
            });
    } catch {
        return [];
    }
}

export function countM3uPayloadStreams(
    payloadStr: string | null,
    favoritesStr: string | null
): PlaylistStreamCounts {
    const rows = extractM3uRowsFromPayload(payloadStr, favoritesStr);
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
    favoritesStr: string | null
): CategoryWithCountRow[] {
    const rows = extractM3uRowsFromPayload(payloadStr, favoritesStr);
    const map = new Map<string, { type: 'live' | 'movie'; count: number }>();
    for (const r of rows) {
        const key = `${r.type}::${r.category_name}`;
        const prev = map.get(key);
        map.set(key, {
            type: r.type === 'movie' ? 'movie' : 'live',
            count: (prev?.count || 0) + 1,
        });
    }
    return Array.from(map.entries()).map(([key, meta], idx) => ({
        id: idx + 1,
        xtream_id: idx + 1,
        name: key.split('::')[1] || 'Non classé',
        type: meta.type,
        hidden: 0,
        stream_count: meta.count,
    }));
}

export function filterM3uRows(
    rows: CatalogStreamRow[],
    query: CatalogFilterQuery,
    startedAt: number
): CatalogFilterResult {
    const tokens = (query.search || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const filtered = rows.filter((r) => {
        if (query.type && query.type !== 'all' && r.type !== query.type) {
            return false;
        }
        if (
            query.categoryName &&
            query.categoryName !== 'ALL' &&
            r.category_name !== query.categoryName
        ) {
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
        if (query.onlyFavorites && !r.is_favorite) return false;
        if (query.hasEpg && !r.epg_channel_id) return false;
        if (
            query.onlyWithPoster &&
            !(r.poster_url?.startsWith('http://') || r.poster_url?.startsWith('https://'))
        ) {
            return false;
        }
        return true;
    });

    if (query.sortBy === 'title_asc') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (query.sortBy === 'title_desc') {
        filtered.sort((a, b) => b.title.localeCompare(a.title));
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
    };
}
