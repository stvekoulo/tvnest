import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const webRequire = createRequire(path.resolve('apps/web/package.json'));
const React = webRequire('react');
const { createRoot } = webRequire('react-dom/client');
const { act } = React;

async function loadSource(file, mocks = {}) {
    const result = await build({
        entryPoints: [file],
        bundle: true,
        write: false,
        platform: 'node',
        format: 'cjs',
        tsconfig: 'apps/web/tsconfig.json',
        external: ['react'],
        plugins: [
            {
                name: 'test-boundaries',
                setup(b) {
                    b.onResolve({ filter: /.*/ }, (args) =>
                        args.path in mocks
                            ? { path: args.path, namespace: 'mock' }
                            : undefined
                    );
                    b.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
                        contents: mocks[args.path],
                    }));
                },
            },
        ],
    });
    const mod = new Module(path.resolve('apps/web/regression-test.cjs'));
    mod.filename = path.resolve('apps/web/regression-test.cjs');
    mod.paths = Module._nodeModulePaths(path.resolve('apps/web'));
    mod._compile(result.outputFiles[0].text, mod.filename);
    return mod.exports;
}

const playlist = {
    id: 'source-a',
    kind: 'xtream',
    title: 'Test',
    channelCount: 0,
    serverUrl: 'https://example.test/player_api.php?unused=1',
    username: ' user/name ',
    password: ' p#?word ',
};
const item = {
    id: 'film-1',
    kind: 'movie',
    portalKind: 'xtream',
    playlistId: playlist.id,
    title: 'Film',
    category: '',
    xtreamId: 12,
    containerExtension: 'mkv',
    streamUrl: 'https://example.test/movie/user/pass/12.mkv',
};

test('Xtream URLs normalize API endpoints and encode each credential segment', async () => {
    const { buildXtreamStreamUrl } = await loadSource(
        'apps/web/src/services/ipc-catalog.service.ts',
        {
            '@/services/ipc-playlists.service':
                'export const isElectronRuntime = () => false; export const getFallbackRawPlaylist = () => null;',
        }
    );
    for (const [kind, route, ext] of [
        ['live', 'live', 'ts'],
        ['movie', 'movie', 'mkv'],
        ['episode', 'series', 'mp4'],
    ]) {
        assert.equal(
            buildXtreamStreamUrl(playlist, 12, kind, ext),
            `https://example.test/${route}/user%2Fname/p%23%3Fword/12.${ext}`
        );
    }
});

test('Cinema uses the IPTV client user agent by default and preserves overrides', async () => {
    const { resolveMediaPlayback } = await loadSource(
        'apps/web/src/services/ipc-playback.service.ts',
        {
            '@/services/ipc-playlists.service':
                'export const isElectronRuntime = () => false; export const getFallbackRawPlaylist = () => null;',
        }
    );
    for (const kind of ['movie', 'episode', 'live']) {
        const resolved = await resolveMediaPlayback(
            { ...item, kind },
            playlist
        );
        assert.equal(resolved.userAgent, 'VLC/3.0.18 LibVLC/3.0.18');
        assert.equal(resolved.headers['User-Agent'], resolved.userAgent);
    }
    assert.equal(
        (
            await resolveMediaPlayback(
                { ...item, userAgent: 'Custom/1' },
                playlist
            )
        ).userAgent,
        'Custom/1'
    );
    assert.equal(
        (
            await resolveMediaPlayback(item, {
                ...playlist,
                userAgent: 'Portal/2',
            })
        ).userAgent,
        'Portal/2'
    );
});

test('catalog filters and reset stay in their section and source', async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const { useCatalogQuery } = await loadSource(
        'apps/web/src/hooks/use-catalog-query.ts',
        {
            '@/services/ipc-catalog.service': `
      export const fetchCategoriesWithCounts = async () => [];
      export const fetchDashboardHighlights = async () => ({spotlight:[],liveChannels:[],recentMovies:[],recentSeries:[],favorites:[],continueWatching:[]});
      export const queryFilteredCatalog = async () => ({items:[], total:0, years:[], tookMs:0});`,
            '@/services/ipc-system.service':
                "export const fetchCurrentEpgForChannels = async () => ({}); export const WATCH_PROGRESS_EVENT = 'tvnest:watch-progress';",
        }
    );
    let current;
    const prefs = {
        autoFilterByLanguage: false,
        preferredContentLanguage: 'FR',
    };
    const onError = (message) => assert.fail(message);
    function Harness({ source = playlist, section = 'series' }) {
        current = useCatalogQuery(source, section, prefs, onError);
        return null;
    }
    const root = createRoot(document.getElementById('root'));
    const render = async (props = {}) =>
        act(async () => root.render(React.createElement(Harness, props)));
    try {
        await render();
        const patch = {
            search: 'test',
            language: 'EN',
            quality: '4K',
            minRating: 8,
            year: '2025',
            onlyFavorites: true,
            hasEpg: true,
            hasCatchup: true,
            sortBy: 'year-desc',
        };
        await act(async () => current.updateFilters(patch));
        for (const section of [
            'movies',
            'live',
            'epg',
            'favorites',
            'history',
        ]) {
            await render({ section });
            assert.equal(current.filters.language, 'ALL');
            assert.equal(current.filters.search, '');
            assert.equal(current.filters.quality, 'ALL');
        }
        await render();
        assert.deepEqual(current.filters, patch);
        await render({ source: { ...playlist, id: 'source-b' } });
        assert.equal(current.filters.quality, 'ALL');
        await render();
        assert.deepEqual(current.filters, patch);
        await render({ section: 'movies' });
        await act(async () => current.resetFilters());
        await render();
        assert.deepEqual(current.filters, patch);
        await act(async () => current.resetFilters());
        assert.equal(current.filters.quality, 'ALL');
    } finally {
        await act(async () => root.unmount());
        dom.window.close();
    }
});

test('resume is offered only for a meaningful, unfinished position', async () => {
    const { shouldOfferResume, formatClock } = await loadSource('apps/web/src/lib/resume-point.ts');
    assert.equal(shouldOfferResume(0, 3000), false);
    assert.equal(shouldOfferResume(12, 3000), false, 'a few seconds is not a started viewing');
    assert.equal(shouldOfferResume(754, 3000), true);
    assert.equal(shouldOfferResume(754), true, 'unknown duration still offers resume');
    assert.equal(shouldOfferResume(2950, 3000), false, 'the credits count as watched');
    assert.equal(shouldOfferResume(2900, 3000), false, 'past 95 % counts as watched');
    assert.equal(formatClock(754), '12:34');
    assert.equal(formatClock(4521), '1:15:21');
});

test('next episode follows episode order and crosses into the next season', async () => {
    const { listEpisodeMedia, nextEpisodeIn } = await loadSource('apps/web/src/lib/series-episodes.ts');
    const ep = (id, seasonNum, episodeNum) => ({
        id, seasonNum, episodeNum, title: `E${episodeNum}`, containerExtension: 'mkv', streamUrl: `u/${id}`,
    });
    const detail = {
        series: { ...item, id: 'show', kind: 'series', title: 'Show' },
        seasons: [2, 1],
        episodesBySeason: { 1: [ep('12', 1, 2), ep('11', 1, 1)], 2: [ep('21', 2, 1)] },
    };
    const queue = listEpisodeMedia(detail);
    assert.deepEqual(queue.map((e) => e.id), ['show-ep-11', 'show-ep-12', 'show-ep-21']);
    assert.equal(nextEpisodeIn(queue, 'show-ep-11').id, 'show-ep-12');
    assert.equal(nextEpisodeIn(queue, 'show-ep-12').id, 'show-ep-21', 'last of a season goes to the next season');
    assert.equal(nextEpisodeIn(queue, 'show-ep-21'), null, 'nothing after the last episode');
    assert.equal(nextEpisodeIn(queue, 'unknown'), null);
});

test('series detail resumes the last started episode, session position first', async () => {
    const { findResumeEpisode } = await loadSource('apps/web/src/lib/series-episodes.ts');
    const ep = (id, episodeNum, progressSeconds, durationSeconds = 1500) => ({
        id, seasonNum: 1, episodeNum, title: `E${episodeNum}`, containerExtension: 'mkv',
        streamUrl: `u/${id}`, progressSeconds, durationSeconds,
    });
    const detail = {
        series: { ...item, id: 'show', kind: 'series', title: 'Show' },
        seasons: [1],
        episodesBySeason: { 1: [ep('1', 1, 1490), ep('2', 2, 300), ep('3', 3, 0)] },
    };
    const none = () => undefined;
    const point = findResumeEpisode(detail, none);
    assert.equal(point.item.id, 'show-ep-2', 'a finished episode is not a resume point');
    assert.equal(point.positionSeconds, 300);
    assert.equal(point.label, 'S1E2 · 5:00');
    assert.equal(findResumeEpisode(detail, (id) => (id === 'show-ep-3' ? 90 : undefined)).item.id, 'show-ep-3');
    assert.equal(findResumeEpisode({ ...detail, episodesBySeason: { 1: [ep('3', 3, 0)] } }, none), null);
});

test('watch progress: no startup overwrite, throttled saves, seeks and flush, episode series id', async () => {
    const { recordMediaWatchProgress, flushMediaWatchProgress } = await loadSource(
        'apps/web/src/services/ipc-system.service.ts',
        {
            '@/services/ipc-playlists.service': 'export const isElectronRuntime = () => true;',
            '@/services/ipc-playback.service': 'export const resolveMediaPlayback = async () => ({});',
            '@/lib/i18n': 'export const buildMpvLanguageArgs = () => [];',
        }
    );
    const saved = [];
    const recent = [];
    globalThis.window = {
        electron: {
            dbSavePlaybackPosition: async (_playlistId, data) => saved.push(data),
            dbAddRecentItem: async (contentId) => recent.push(contentId),
        },
        dispatchEvent: () => true,
    };
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const episode = {
        ...item, id: 'show-ep-7', kind: 'episode', xtreamId: 7,
        seriesXtreamId: 70, seriesContentId: 700, seasonNumber: 1, episodeNumber: 2,
    };

    recordMediaWatchProgress(episode, 600, 1500); // resume point announced before playback
    recordMediaWatchProgress(episode, 0.4, 1500); // engine glitch before seeking to it
    assert.equal(saved.length, 0, 'a jump that is not playback never overwrites the resume point');
    assert.deepEqual(recent, [700], 'an episode puts its series in the history');

    recordMediaWatchProgress(episode, 600, 1500);
    recordMediaWatchProgress(episode, 601, 1500);
    recordMediaWatchProgress(episode, 603, 1500);
    await flush();
    assert.deepEqual(saved.map((s) => s.positionSeconds), [601], 'first real progress is saved, then throttled');
    assert.equal(saved[0].seriesXtreamId, 70);
    assert.equal(saved[0].episodeNumber, 2);

    recordMediaWatchProgress(episode, 120, 1500); // seek backwards
    await flush();
    assert.equal(saved.at(-1).positionSeconds, 120, 'a backward seek is saved right away');

    recordMediaWatchProgress(episode, 122, 1500);
    flushMediaWatchProgress(episode.id, true); // pause / stop
    await flush();
    assert.equal(saved.at(-1).positionSeconds, 122, 'the last position is written when playback stops');
    delete globalThis.window;
});
