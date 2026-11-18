import { existsSync } from 'node:fs';
import { extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const ALLOWED_LOCAL_MEDIA_EXTENSIONS = new Set([
    '.mp4',
    '.mkv',
    '.avi',
    '.ts',
    '.m2ts',
    '.mov',
    '.webm',
    '.flv',
    '.m4v',
    '.mp3',
    '.aac',
    '.flac',
    '.ogg',
    '.m4a',
    '.wav',
    '.m3u8',
]);

export function hasAsciiControlChars(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) {
            return true;
        }
    }
    return false;
}

export function stripAsciiControlChars(value: string): string {
    let out = '';
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code > 0x1f && code !== 0x7f) {
            out += value[i];
        }
    }
    return out;
}

export function sanitizePlayerTextValue(
    value?: string | null
): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const cleaned = stripAsciiControlChars(value).trim();
    return cleaned.length > 0 ? cleaned : undefined;
}

export function sanitizeHttpHeaderPair(
    name: string,
    value: unknown
): [string, string] | null {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || !HEADER_NAME_RE.test(cleanName)) {
        return null;
    }
    if (value === undefined || value === null) {
        return null;
    }
    const cleanValue = stripAsciiControlChars(String(value)).trim();
    if (!cleanValue) {
        return null;
    }
    return [cleanName, cleanValue];
}

/**
 * Ensures a playback URL handed to MPV, VLC or libmpv is a safe http(s) stream
 * URL or an existing local media file, never a CLI flag (`--...`, `:...`) or an
 * unsafe pseudo-protocol (`lavfi://`, `edl://`, `avdevice://`, `memory://`).
 */
export function assertSafePlaybackUrl(rawUrl: string): string {
    if (typeof rawUrl !== 'string') {
        throw new Error('Playback URL is required');
    }
    if (hasAsciiControlChars(rawUrl)) {
        throw new Error('Playback URL contains control characters');
    }
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('-') || trimmed.startsWith(':')) {
        throw new Error('Unsupported playback URL');
    }

    if (/^https?:\/\//i.test(trimmed)) {
        let parsed: URL;
        try {
            parsed = new URL(trimmed);
        } catch {
            throw new Error('Invalid playback URL');
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Unsupported playback protocol');
        }
        return trimmed;
    }

    let localPath: string | null = null;
    if (/^file:\/\//i.test(trimmed)) {
        try {
            localPath = fileURLToPath(trimmed);
        } catch {
            throw new Error('Invalid local playback file URL');
        }
    } else if (isAbsolute(trimmed)) {
        localPath = trimmed;
    }

    if (localPath) {
        const ext = extname(localPath).toLowerCase();
        if (!ALLOWED_LOCAL_MEDIA_EXTENSIONS.has(ext) || !existsSync(localPath)) {
            throw new Error('Local media file is unavailable or unsupported');
        }
        return trimmed;
    }

    throw new Error('Unsupported playback URL protocol');
}
