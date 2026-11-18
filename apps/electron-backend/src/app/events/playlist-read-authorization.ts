import { extname, isAbsolute, resolve } from 'node:path';

const ALLOWED_PLAYLIST_EXTENSIONS = new Set(['.m3u', '.m3u8', '.pls', '.txt']);
const authorizedPlaylistPaths = new Set<string>();

export function authorizePlaylistReadPath(filePath: string): string {
    const normalized = resolve(filePath.trim());
    authorizedPlaylistPaths.add(normalized);
    return normalized;
}

export function assertAuthorizedPlaylistReadPath(
    filePath: unknown,
    isKnownDbPath = false
): string {
    if (typeof filePath !== 'string' || !filePath.trim()) {
        throw new Error('Playlist file path is required');
    }
    const trimmed = filePath.trim();
    if (!isAbsolute(trimmed)) {
        throw new Error('Playlist file path must be absolute');
    }
    const normalized = resolve(trimmed);
    const ext = extname(normalized).toLowerCase();
    if (!ALLOWED_PLAYLIST_EXTENSIONS.has(ext)) {
        throw new Error('Unsupported playlist file extension');
    }
    if (!authorizedPlaylistPaths.has(normalized) && !isKnownDbPath) {
        throw new Error(
            'Playlist file path was not authorized by the file dialog or OS open request'
        );
    }
    return normalized;
}
