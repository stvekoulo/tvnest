import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    assertSafePlaybackUrl,
    sanitizeHttpHeaderPair,
    sanitizePlayerTextValue,
} from './playback-url-guard';

describe('playback-url-guard', () => {
    const validMediaFile = path.resolve('tools/testing/fixtures/episode.webm');

    it('accepts valid http/https stream URLs and existing local media files', () => {
        expect(
            assertSafePlaybackUrl('https://cdn.example.test/live/12.m3u8?token=abc')
        ).toBe('https://cdn.example.test/live/12.m3u8?token=abc');
        expect(assertSafePlaybackUrl(validMediaFile)).toBe(validMediaFile);
        const fileUrl = pathToFileURL(validMediaFile).href;
        expect(assertSafePlaybackUrl(fileUrl)).toBe(fileUrl);
    });

    it('rejects CLI option flags, VLC colon options, control chars, and pseudo-protocols', () => {
        expect(() => assertSafePlaybackUrl('--script=C:/evil.lua')).toThrow();
        expect(() => assertSafePlaybackUrl(':sout=#std{mux=ts,dst=evil}')).toThrow();
        expect(() => assertSafePlaybackUrl('lavfi://testsrc')).toThrow();
        expect(() => assertSafePlaybackUrl('edl://!new_stream;file.mp4')).toThrow();
        expect(() => assertSafePlaybackUrl('avdevice://dshow:video=webcam')).toThrow();
        expect(() =>
            assertSafePlaybackUrl('https://example.test/live.m3u8\r\nX-Injected: 1')
        ).toThrow();
    });

    it('rejects non-media local files and missing media paths', () => {
        expect(() =>
            assertSafePlaybackUrl(path.resolve('package.json'))
        ).toThrow();
        expect(() =>
            assertSafePlaybackUrl(path.resolve('tools/testing/fixtures/missing.mp4'))
        ).toThrow();
    });

    it('sanitizes HTTP header pairs and strips CRLF / control characters', () => {
        expect(
            sanitizeHttpHeaderPair('User-Agent', 'VLC/3.0.20\r\nX-Evil: 1')
        ).toEqual(['User-Agent', 'VLC/3.0.20X-Evil: 1']);
        expect(sanitizeHttpHeaderPair('Bad Header', 'value')).toBeNull();
        expect(sanitizeHttpHeaderPair('Referer', '\r\n')).toBeNull();
        expect(sanitizePlayerTextValue('  Titre\r\nPropre  ')).toBe('TitrePropre');
    });
});
