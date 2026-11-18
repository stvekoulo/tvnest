import { getStalkerPlaybackContextHeaders } from '../services/stalker-playback-context.service';
import {
    sanitizeHttpHeaderPair,
    sanitizePlayerTextValue,
} from '../util/playback-url-guard';

export interface EffectiveExternalPlaybackRequest {
    mergedHeaders: Record<string, string>;
    effectiveOrigin?: string;
    effectiveReferer?: string;
    effectiveUserAgent?: string;
    headerFields: string[];
}

export function buildHttpHeaderFields(
    origin?: string,
    headers?: Record<string, string>
): string[] {
    const fields: string[] = [];
    const normalizedHeaders = headers ?? {};
    const safeOrigin = sanitizePlayerTextValue(origin);

    if (
        safeOrigin &&
        normalizedHeaders['Origin'] === undefined &&
        normalizedHeaders['origin'] === undefined
    ) {
        fields.push(`Origin: ${safeOrigin}`);
    }

    Object.entries(normalizedHeaders).forEach(([name, value]) => {
        const pair = sanitizeHttpHeaderPair(name, value);
        if (!pair) return;
        fields.push(`${pair[0]}: ${pair[1]}`);
    });

    return fields;
}

export function isStalkerDirectStreamProfile(
    headers: Record<string, string>
): boolean {
    const icyMetaData = headers['Icy-MetaData'] ?? headers['icy-metadata'];
    const userAgent = headers['User-Agent'] ?? headers['user-agent'];

    return (
        String(icyMetaData).trim() === '1' &&
        String(userAgent).trim().toLowerCase() === 'ksplayer'
    );
}

export function resolveEffectiveExternalPlaybackRequest(options: {
    url: string;
    userAgent?: string;
    referer?: string;
    origin?: string;
    headers?: Record<string, string>;
}): EffectiveExternalPlaybackRequest {
    const fallbackHeaders = getStalkerPlaybackContextHeaders(options.url) ?? {};
    const rawMergedHeaders = isStalkerDirectStreamProfile(fallbackHeaders)
        ? fallbackHeaders
        : {
              ...fallbackHeaders,
              ...(options.headers ?? {}),
          };
    const mergedHeaders: Record<string, string> = {};
    Object.entries(rawMergedHeaders).forEach(([name, value]) => {
        const pair = sanitizeHttpHeaderPair(name, value);
        if (pair) {
            mergedHeaders[pair[0]] = pair[1];
        }
    });
    const effectiveOrigin = sanitizePlayerTextValue(
        options.origin ??
            mergedHeaders['Origin'] ??
            mergedHeaders['origin'] ??
            undefined
    );
    const effectiveReferer = sanitizePlayerTextValue(
        options.referer ??
            mergedHeaders['Referer'] ??
            mergedHeaders['referer'] ??
            undefined
    );
    const effectiveUserAgent = sanitizePlayerTextValue(
        options.userAgent ??
            mergedHeaders['User-Agent'] ??
            mergedHeaders['user-agent'] ??
            undefined
    );

    return {
        mergedHeaders,
        effectiveOrigin,
        effectiveReferer,
        effectiveUserAgent,
        headerFields: buildHttpHeaderFields(effectiveOrigin, mergedHeaders),
    };
}
