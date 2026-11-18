// Cache LRU et utilitaires d'extraction M3U/Stalker pour le worker SQLite TVNest.
import { isLikelyM3uVod } from '@iptvnator/shared/m3u-utils';
import type { CatalogStreamRow } from './catalog-filter.types';

interface RawM3uItem {
    id?: string;
    name?: string;
    url?: string;
    tvg?: { id?: string; logo?: string };
    group?: { title?: string };
    http?: { 'user-agent'?: string; referrer?: string };
}

const ADULT_LABEL_RE =
    /\b(xxx|18\+|adult|adulte|porn|porno|erotic|erotique|nsfw|hentai|x-rated)\b|\+18/i;
const YEAR_IN_TITLE_RE = /\b(19\d{2}|20\d{2})\b/;

const regexCache = new Map<string, RegExp>();
const parsedRowsCache = new Map<string, CatalogStreamRow[]>();
const MAX_PARSED_CACHE = 6;

export function hashStreamKey(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return ((hash >>> 0) & 0x7fffffff) || 1;
}

export function isAdultM3uRow(
    row: Pick<CatalogStreamRow, 'title' | 'category_name'>
): boolean {
    return (
        ADULT_LABEL_RE.test(row.category_name) || ADULT_LABEL_RE.test(row.title)
    );
}

export function matchesWildcard(text: string, sqlLikePattern: string): boolean {
    let compiled = regexCache.get(sqlLikePattern);
    if (!compiled) {
        if (regexCache.size >= 256) {
            const oldest = regexCache.keys().next().value;
            if (oldest !== undefined) regexCache.delete(oldest);
        }
        const escaped = sqlLikePattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/%/g, '.*');
        compiled = new RegExp(`^${escaped}$`, 'i');
        regexCache.set(sqlLikePattern, compiled);
    }
    return compiled.test(text);
}

export function parseJsonStringSet(raw: string | null | undefined): Set<string> {
    if (!raw) return new Set();
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        const out = new Set<string>();
        for (const entry of parsed) {
            if (typeof entry === 'string' && entry) out.add(entry);
            else if (entry && typeof entry === 'object') {
                const url = (entry as { url?: unknown }).url;
                const id = (entry as { id?: unknown }).id;
                if (typeof url === 'string' && url) out.add(url);
                if (typeof id === 'string' && id) out.add(id);
            }
        }
        return out;
    } catch {
        return new Set();
    }
}

export function getBaseM3uRows(
    payloadStr: string,
    cacheId?: string
): CatalogStreamRow[] {
    const cacheKey = `${cacheId || 'm3u'}::${payloadStr.length}::${payloadStr.slice(0, 48)}::${payloadStr.slice(-48)}`;
    const cached = parsedRowsCache.get(cacheKey);
    if (cached) {
        parsedRowsCache.delete(cacheKey);
        parsedRowsCache.set(cacheKey, cached);
        return cached;
    }

    try {
        const parsed = JSON.parse(payloadStr) as { items?: RawM3uItem[] };
        const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
        const baseRows: CatalogStreamRow[] = [];

        for (let idx = 0; idx < rawItems.length; idx++) {
            const it = rawItems[idx];
            if (!it?.url || !it?.name) continue;
            const isVod = isLikelyM3uVod({ url: it.url, radio: 'false' });
            const logo = it.tvg?.logo?.trim() || null;
            const catName = it.group?.title?.trim() || 'Non classé';
            const stableId = hashStreamKey(`${it.url}::${it.name}`);
            const yearMatch = YEAR_IN_TITLE_RE.exec(it.name);
            baseRows.push({
                id: stableId,
                xtream_id: stableId,
                title: it.name || `Flux ${idx + 1}`,
                type: isVod ? 'movie' : 'live',
                category_id: hashStreamKey(catName),
                category_name: catName,
                poster_url: logo,
                backdrop_url: logo,
                rating: null,
                release_year: yearMatch ? Number(yearMatch[1]) : null,
                added: null,
                epg_channel_id: it.tvg?.id?.trim() || null,
                tv_archive: 0,
                direct_source: it.url,
                is_favorite: 0,
                stream_url: it.url,
                user_agent: it.http?.['user-agent'] || null,
                referrer: it.http?.referrer || null,
            });
        }

        if (parsedRowsCache.size >= MAX_PARSED_CACHE) {
            const oldest = parsedRowsCache.keys().next().value;
            if (oldest !== undefined) parsedRowsCache.delete(oldest);
        }
        parsedRowsCache.set(cacheKey, baseRows);
        return baseRows;
    } catch {
        return [];
    }
}
