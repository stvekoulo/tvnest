import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { Module } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { build } from 'esbuild';

const helper = path.resolve(
    'apps/electron-backend/native/build/Release/iptvnator_mpv_helper.exe'
);

test(
    'Cinema resolves and loads Xtream movie, episode and live video in native libmpv',
    {
        skip: process.platform !== 'win32' || !existsSync(helper),
        timeout: 60000,
    },
    async () => {
        const bundle = await build({
            stdin: {
                contents: `
      export { resolveMediaPlayback } from './apps/web/src/services/ipc-playback.service';
      export { buildXtreamStreamUrl } from './apps/web/src/services/xtream-stream-url';
      export { buildLoadPlaybackCommand } from './apps/electron-backend/src/app/services/embedded-mpv-frame-copy-protocol';
    `,
                resolveDir: process.cwd(),
            },
            bundle: true,
            write: false,
            platform: 'node',
            format: 'cjs',
            tsconfig: 'apps/web/tsconfig.json',
        });
        const mod = new Module(path.resolve('tools/testing/native-smoke.cjs'));
        mod.filename = mod.id;
        mod.paths = Module._nodeModulePaths(process.cwd());
        mod._compile(bundle.outputFiles[0].text, mod.filename);
        const {
            resolveMediaPlayback,
            buildXtreamStreamUrl,
            buildLoadPlaybackCommand,
        } = mod.exports;
        const clip = readFileSync(
            'apps/web-e2e/src/fixtures/playback/episode.webm'
        );
        const requests = [];
        const server = createServer((req, res) => {
            requests.push({ url: req.url, agent: req.headers['user-agent'] });
            if (req.headers['user-agent'] !== 'VLC/3.0.18 LibVLC/3.0.18') {
                res.writeHead(403).end();
                return;
            }
            res.writeHead(200, {
                'Content-Type': 'video/webm',
                'Content-Length': clip.length,
            });
            res.end(clip);
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        try {
            const playlist = {
                id: 'test',
                kind: 'xtream',
                title: 'Test',
                channelCount: 0,
                serverUrl: `http://127.0.0.1:${server.address().port}/player_api.php`,
                username: 'test/user',
                password: 'p#?word',
            };
            for (const kind of ['movie', 'episode', 'live']) {
                const media = {
                    id: kind,
                    playlistId: 'test',
                    portalKind: 'xtream',
                    kind,
                    title: kind,
                    xtreamId: 12,
                    containerExtension: 'webm',
                    streamUrl: buildXtreamStreamUrl(playlist, 12, kind, 'webm'),
                };
                const resolved = await resolveMediaPlayback(media, playlist);
                await new Promise((resolve, reject) => {
                    const child = spawn(
                        helper,
                        [
                            '--shm-base',
                            `/impv-smoke-${process.pid}-${kind}`,
                            '--width',
                            '320',
                            '--height',
                            '180',
                            '--volume',
                            '0',
                            '--hwdec',
                            'no',
                        ],
                        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
                    );
                    let buffer = '';
                    let settled = false;
                    let stderr = '';
                    const finish = (error) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        child.stdin.end('quit\n');
                        child.kill();
                        error ? reject(error) : resolve();
                    };
                    const timer = setTimeout(
                        () =>
                            finish(
                                new Error(
                                    `${kind}: native timeout: ${stderr.slice(-600)}`
                                )
                            ),
                        18000
                    );
                    child.on('error', finish);
                    child.on('exit', (code) =>
                        finish(
                            new Error(
                                `${kind}: helper exited ${code}: ${stderr.slice(-600)}`
                            )
                        )
                    );
                    child.stderr.on('data', (data) => {
                        stderr += data;
                    });
                    child.stdout.on('data', (data) => {
                        buffer += data;
                        let newline;
                        while ((newline = buffer.indexOf('\n')) >= 0) {
                            const line = buffer.slice(0, newline);
                            buffer = buffer.slice(newline + 1);
                            let event;
                            try {
                                event = JSON.parse(line);
                            } catch {
                                continue;
                            }
                            if (event.event === 'hello')
                                child.stdin.write(
                                    `${buildLoadPlaybackCommand(resolved)}\n`
                                );
                            if (
                                event.event === 'snapshot' &&
                                event.status === 'error'
                            ) {
                                finish(
                                    new Error(
                                        `${kind}: ${event.error}; HTTP requests: ${requests.length}`
                                    )
                                );
                            }
                            if (
                                event.event === 'snapshot' &&
                                event.status === 'playing' &&
                                event.videoWidth > 0
                            )
                                finish();
                        }
                    });
                });
            }
            assert.ok(requests.length >= 3);
            assert.ok(
                requests.every((request) =>
                    request.url.includes('/test%2Fuser/p%23%3Fword/12.')
                )
            );
            console.log(
                'Native video loaded for movies, episodes and live; HTTP client identity verified.'
            );
        } finally {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
    }
);
