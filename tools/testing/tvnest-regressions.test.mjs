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
      export const queryFilteredCatalog = async () => ({items:[], total:0, years:[], tookMs:0});
      export const withSavedProgress = async (_id, rows) => rows;`,
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

test('switching to the next episode starts it from zero, not at the previous end', async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.MutationObserver = dom.window.MutationObserver;
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const { useTvNestPlayer, getSessionPosition } = await loadSource('apps/web/src/hooks/use-tvnest-player.ts', {
        '@/services/ipc-playback.service': `
      export const probeEmbeddedMpvSupport = async () => ({ supported: false });
      export const resolveMediaPlayback = async () => ({ streamUrl: '' });`,
        '@/services/ipc-playlists.service': 'export const isElectronRuntime = () => false;',
        '@/services/ipc-system.service':
            'export const recordMediaWatchProgress = () => {}; export const flushMediaWatchProgress = () => {};',
        './use-tvnest-mpv-controls': 'export const toMpvVolume = (v) => v; export const useTvNestPlayerControls = () => ({});',
        './use-tvnest-web-engine': 'export const destroyWebEngines = () => {}; export const startWebMediaEngine = async () => {};',
    });
    const ep = (n) => ({ ...item, id: `show-ep-${n}`, kind: 'episode', xtreamId: n, progressSeconds: 0 });
    let current;
    function Harness({ media }) {
        current = useTvNestPlayer({
            media, playing: true, onPlayingChange: () => {},
            hostRef: { current: null }, videoRef: { current: null },
        });
        return null;
    }
    const root = createRoot(document.getElementById('root'));
    const render = (media) => act(async () => root.render(React.createElement(Harness, { media })));
    try {
        await render(ep(1));
        await act(async () => {
            current.setDuration(2070);
            current.setPosition(2050); // 34:10 on a 34:30 episode
        });
        await render(ep(2));
        assert.equal(current.position, 0, 'the next episode does not inherit the previous position');
        assert.equal(getSessionPosition('show-ep-2'), undefined, 'no resume point is invented for it');
    } finally {
        await act(async () => root.unmount());
        delete globalThis.window;
        delete globalThis.document;
        delete globalThis.MutationObserver;
        delete globalThis.requestAnimationFrame;
        delete globalThis.cancelAnimationFrame;
    }
});

test('series "Play" starts after the last finished episode', async () => {
    const { nextUnwatchedEpisode } = await loadSource('apps/web/src/lib/series-episodes.ts');
    const ep = (id, episodeNum, progressSeconds) => ({
        id, seasonNum: 1, episodeNum, title: `E${episodeNum}`, containerExtension: 'mkv',
        streamUrl: `u/${id}`, progressSeconds, durationSeconds: 1500,
    });
    const detail = (eps) => ({ series: { ...item, id: 'show', kind: 'series', title: 'Show' }, seasons: [1], episodesBySeason: { 1: eps } });
    const none = () => undefined;
    assert.equal(nextUnwatchedEpisode(detail([ep('1', 1, 0), ep('2', 2, 0)]), none).id, 'show-ep-1');
    assert.equal(nextUnwatchedEpisode(detail([ep('1', 1, 1490), ep('2', 2, 1480), ep('3', 3, 0)]), none).id, 'show-ep-3');
    assert.equal(nextUnwatchedEpisode(detail([ep('1', 1, 1490), ep('2', 2, 1490)]), none).id, 'show-ep-1', 'all watched: back to the first');
});

test('MPV / VLC progress is saved with its series and matched on Home', async () => {
    const { saveExternalPlaybackProgress } = await loadSource('apps/web/src/services/ipc-system.service.ts', {
        '@/services/ipc-playlists.service': 'export const isElectronRuntime = () => true;',
        '@/services/ipc-playback.service': 'export const resolveMediaPlayback = async () => ({});',
        '@/lib/i18n': 'export const buildMpvLanguageArgs = () => [];',
    });
    const { isSameWatchItem } = await loadSource('apps/web/src/lib/resume-point.ts');
    const saved = [];
    const events = [];
    globalThis.window = {
        electron: { dbSavePlaybackPosition: async (playlistId, data) => saved.push({ playlistId, ...data }) },
        dispatchEvent: (e) => events.push(e.detail),
    };
    const update = { playlistId: 'source-a', contentXtreamId: 7, contentType: 'episode', seriesXtreamId: 70, durationSeconds: 1500 };
    saveExternalPlaybackProgress({ ...update, positionSeconds: 0 });
    saveExternalPlaybackProgress({ ...update, durationSeconds: null, positionSeconds: 400 });
    await new Promise((r) => setImmediate(r));
    assert.equal(saved.length, 0, 'no write before the player reached the resume point, nor without a duration');
    saveExternalPlaybackProgress({ ...update, positionSeconds: 400 });
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(saved.map((s) => [s.playlistId, s.contentXtreamId, s.seriesXtreamId, s.positionSeconds]), [['source-a', 7, 70, 400]]);
    const series = { ...item, id: 'source-a-series-70', kind: 'series', xtreamId: 70, playlistId: 'source-a' };
    const movie = { ...item, id: 'source-a-movie-12', kind: 'movie', xtreamId: 12, playlistId: 'source-a' };
    assert.equal(isSameWatchItem(series, events[0].item), true, 'the Home row of the series gets the new progress');
    assert.equal(isSameWatchItem(movie, { ...movie, id: 'other-id' }), true, 'movies match by provider id');
    assert.equal(isSameWatchItem(movie, { ...movie, playlistId: 'source-b' }), false);
    delete globalThis.window;
});

test('adding an Xtream source explains refusals instead of "[object Object]"', async () => {
    const { describeXtreamFailure, checkXtreamAccount, requestXtream } = await loadSource(
        'apps/web/src/services/xtream-request.service.ts'
    );
    const ipc = (msg) => new Error(`Error invoking remote method 'XTREAM_REQUEST': Error: ${msg}`);
    assert.match(describeXtreamFailure(ipc('HTTP Error 511: Request failed with status code 511')), /refuse l'accès \(code 511\)/);
    assert.match(describeXtreamFailure(ipc('getaddrinfo ENOTFOUND line.example')), /introuvable/);
    assert.match(describeXtreamFailure(ipc('HTTP Error 512: Request failed with status code 512')), /ne reconnaît pas ce compte/);
    assert.match(describeXtreamFailure(new Error("Error invoking remote method 'XTREAM_REQUEST': [object Object]")), /Échec de connexion/);

    const respond = (value) => {
        globalThis.window = { electron: { xtreamRequest: async () => value } };
    };
    const creds = { username: 'u', password: 'p' };
    respond({ portalRequestFailure: { kind: 'http', status: 401 } });
    await assert.rejects(requestXtream('http://x', creds), /Identifiants refusés/, 'a 401 envelope is not a success');
    respond({ payload: { user_info: { auth: 0 } } });
    await assert.rejects(checkXtreamAccount('http://x', creds), /Identifiants incorrects/);
    respond({ payload: { user_info: { auth: 1, status: 'Expired', exp_date: '1700000000' } } });
    await assert.rejects(checkXtreamAccount('http://x', creds), /Abonnement expiré le /);
    respond({ payload: { user_info: { auth: 1, status: 'Active' } } });
    await checkXtreamAccount('http://x', creds);
    delete globalThis.window;
});

test('a hanging series request is abandoned, cancelled and resent', async () => {
    const { requestXtreamQuick } = await loadSource('apps/web/src/services/xtream-request.service.ts');
    const sessions = [];
    const cancelled = [];
    globalThis.window = {
        setTimeout: (cb) => setTimeout(cb, 0), // délais d'essai immédiats pour le test
        clearTimeout,
        electron: {
            xtreamRequest: ({ sessionId }) => {
                sessions.push(sessionId);
                return sessions.length === 1 ? new Promise(() => {}) : Promise.resolve({ payload: { episodes: {} } });
            },
            xtreamCancelSession: async (id) => cancelled.push(id),
        },
    };
    const payload = await requestXtreamQuick('http://x', { action: 'get_series_info' });
    assert.deepEqual(payload, { episodes: {} });
    assert.equal(sessions.length, 2, 'resent once after the first attempt stalled');
    assert.deepEqual(cancelled, [sessions[0]], 'the stalled request is cancelled in Electron');

    window.electron.xtreamRequest = () => new Promise(() => {});
    await assert.rejects(requestXtreamQuick('http://x', {}), /trop de temps/, 'gives up after the last attempt');
    delete globalThis.window;
});

test('the default catalog language filters movies and series, never Live TV', async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const { useCatalogFilters } = await loadSource('apps/web/src/hooks/use-catalog-filters.ts');
    const prefs = { autoFilterByLanguage: true, preferredContentLanguage: 'FR' };
    let current;
    function Harness({ section, language = 'FR' }) {
        current = useCatalogFilters('source-a', section, { ...prefs, preferredContentLanguage: language });
        return null;
    }
    const root = createRoot(document.getElementById('root'));
    const render = (props) => act(async () => root.render(React.createElement(Harness, props)));
    try {
        await render({ section: 'series' });
        assert.equal(current.filters.language, 'FR');
        await act(async () => current.updateFilters({ search: 'news' }, 'live'));
        await render({ section: 'live' });
        assert.equal(current.filters.language, 'ALL', 'Live TV keeps every language');
        assert.equal(current.filters.search, 'news');
        await render({ section: 'live', language: 'EN' });
        assert.equal(current.filters.language, 'ALL', 'changing the preferred language leaves Live TV alone');
        await render({ section: 'series', language: 'EN' });
        assert.equal(current.filters.language, 'EN');
    } finally {
        await act(async () => root.unmount());
        delete globalThis.window;
        delete globalThis.document;
    }
});
