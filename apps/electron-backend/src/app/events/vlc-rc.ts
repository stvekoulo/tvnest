import { createConnection } from 'net';
import {
    assertSafePlaybackUrl,
    sanitizePlayerTextValue,
} from '../util/playback-url-guard';
import { buildHttpHeaderFields } from './external-player-playback-request';
import { ExternalPlaybackSnapshot } from './external-player-runtime';

function sanitizeVlcOptionValue(value?: string): string | undefined {
    const cleaned = sanitizePlayerTextValue(value);
    if (!cleaned) {
        return undefined;
    }
    // VLC RC splits inline per-input options on whitespace followed by `:key=`.
    return cleaned.replace(/\s+:([A-Za-z0-9_-]+=)/g, ' $1');
}

export function buildVlcEnqueueCommands(options: {
    url: string;
    title?: string;
    userAgent?: string;
    referer?: string;
    origin?: string;
    headers?: Record<string, string>;
    startTime?: number;
}): string[] {
    const safeUrl = assertSafePlaybackUrl(options.url);
    const inputOptions: string[] = [];

    // The reused process was launched with a global `--start-time=<resume>`,
    // which VLC applies to every later input too. A per-input start time (0
    // when nothing is resumed) keeps each item at its own offset.
    const startTime =
        typeof options.startTime === 'number' &&
        Number.isFinite(options.startTime) &&
        options.startTime >= 0
            ? Math.floor(options.startTime)
            : 0;
    inputOptions.push(`:start-time=${startTime}`);

    const safeUserAgent = sanitizeVlcOptionValue(options.userAgent);
    const safeReferer = sanitizeVlcOptionValue(options.referer);
    const safeOrigin = sanitizeVlcOptionValue(options.origin);
    const safeTitle = sanitizeVlcOptionValue(options.title);

    if (safeUserAgent) {
        inputOptions.push(`:http-user-agent=${safeUserAgent}`);
    }
    if (safeReferer) {
        inputOptions.push(`:http-referrer=${safeReferer}`);
    } else if (safeOrigin) {
        inputOptions.push(`:http-referrer=${safeOrigin}`);
    }
    // Same field list MPV sends: a real `Origin: ...` header (unless the
    // headers map already carries one) plus every non-empty custom header.
    buildHttpHeaderFields(safeOrigin, options.headers).forEach((field) => {
        const safeField = sanitizeVlcOptionValue(field);
        if (safeField) {
            inputOptions.push(`:http-header=${safeField}`);
        }
    });
    if (safeTitle) {
        inputOptions.push(`:meta-title=${safeTitle}`);
    }

    const inputLine =
        inputOptions.length > 0
            ? `${safeUrl} ${inputOptions.join(' ')}`
            : safeUrl;
    const commands = ['clear', `add ${inputLine}`];
    if (startTime > 0) {
        commands.push(`seek ${startTime}`);
    }
    return commands;
}

export function sendVlcRcCommand(
    port: number,
    command: string,
    onDispatched?: () => void,
    shouldDispatch?: () => boolean
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const client = createConnection({ port, host: '127.0.0.1' });
        let settled = false;
        const finish = (error?: Error, dispatched = true) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutHandle);
            if (!client.destroyed) client.destroy();
            if (error) reject(error);
            else resolve(dispatched);
        };
        const timeoutHandle = setTimeout(
            () => finish(new Error('VLC RC command timed out')),
            2_000
        );

        client.on('connect', () => {
            if (shouldDispatch && !shouldDispatch()) {
                finish(undefined, false);
                return;
            }
            try {
                const safeCommand = Array.from(command)
                    .filter((ch) => {
                        const c = ch.charCodeAt(0);
                        return c !== 0 && c !== 10 && c !== 13;
                    })
                    .join('');
                client.write(`${safeCommand}\n`);
                onDispatched?.();
            } catch (error) {
                finish(
                    error instanceof Error ? error : new Error(String(error))
                );
            }
        });
        client.on('data', (chunk) => {
            if (chunk.toString().includes('>')) finish();
        });
        client.on('error', (error) => finish(error));
    });
}

export async function sendVlcRcCommands(
    port: number,
    commands: string[],
    onCommandSent?: (command: string, index: number) => void,
    shouldDispatch?: () => boolean
): Promise<void> {
    for (const [index, command] of commands.entries()) {
        if (shouldDispatch && !shouldDispatch()) return;
        const dispatched = await sendVlcRcCommand(
            port,
            command,
            () => onCommandSent?.(command, index),
            shouldDispatch
        );
        if (!dispatched) return;
    }
}

export function parseVlcRcNumericResponse(data: string): string {
    return data.match(/>\s*(-?\d+(?:\.\d+)?)/)?.[1] ?? '';
}

export function parseVlcRcPlaybackState(data: string): string | null {
    return (
        data
            .match(/\(\s*state\s+([^)]+)\s*\)/i)?.[1]
            ?.trim()
            .toLowerCase() ?? null
    );
}

function getVlcCommandResponse(port: number, command: string): Promise<string> {
    return new Promise((resolve) => {
        const client = createConnection({ port, host: '127.0.0.1' });
        let data = '';
        let settled = false;
        const finish = (result: string) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutHandle);
            if (!client.destroyed) client.destroy();
            resolve(result);
        };
        const timeoutHandle = setTimeout(() => finish(''), 2_000);

        client.on('connect', () => client.write(`${command}\n`));
        client.on('data', (chunk) => {
            data += chunk.toString();
            if (data.includes('>')) finish(data);
        });
        client.on('error', () => finish(''));
    });
}

export async function getVlcPlaybackState(
    port: number
): Promise<string | null> {
    return parseVlcRcPlaybackState(await getVlcCommandResponse(port, 'status'));
}

export async function getVlcPlaybackSnapshot(
    port: number
): Promise<ExternalPlaybackSnapshot | null> {
    const time = parseInt(
        parseVlcRcNumericResponse(
            await getVlcCommandResponse(port, 'get_time')
        ),
        10
    );
    const duration = parseInt(
        parseVlcRcNumericResponse(
            await getVlcCommandResponse(port, 'get_length')
        ),
        10
    );
    if (Number.isNaN(time)) return null;
    return {
        positionSeconds: time,
        durationSeconds: Number.isNaN(duration) ? null : duration,
    };
}
