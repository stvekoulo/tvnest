import type { ChildProcess } from 'child_process';
import { redactSensitiveData } from '@iptvnator/shared/logging';
import {
    sendPlayerErrorNotification,
    traceExternalPlayer,
} from './external-player-runtime';

function shouldIgnoreMpvStdoutLine(line: string): boolean {
    return /^(\(Paused\)\s*)?AV:\s/.test(line);
}

/**
 * Reports what a reusable MPV child prints: stream errors on stdout or stderr
 * reach the renderer as player errors; the periodic status line is ignored.
 */
export function attachMpvOutputHandlers(proc: ChildProcess): void {
    if (proc.stdout) {
        proc.stdout.on('data', (data) => {
            const lines = data
                .toString()
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);

            for (const output of lines) {
                if (shouldIgnoreMpvStdoutLine(output)) {
                    continue;
                }

                traceExternalPlayer('mpv stdout', { output });

                if (
                    output.includes('Failed to open') ||
                    output.includes('Error opening') ||
                    output.includes('Protocol not found') ||
                    output.includes('Connection refused') ||
                    output.includes('error') ||
                    output.includes('403') ||
                    output.includes('404')
                ) {
                    const redacted = String(redactSensitiveData(output));
                    console.error('[MPV ERROR from stdout]:', redacted);
                    sendPlayerErrorNotification('MPV', redacted);
                }
            }
        });
    }

    if (proc.stderr) {
        proc.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                const redacted = String(redactSensitiveData(output));
                console.error('[MPV stderr]:', redacted);

                if (
                    output.includes('Failed to open') ||
                    output.includes('Exiting... (Errors when loading file)') ||
                    output.includes('Error opening') ||
                    output.includes('Protocol not found') ||
                    output.includes('Connection refused') ||
                    output.includes('error') ||
                    output.includes('403') ||
                    output.includes('404')
                ) {
                    console.error('[MPV ERROR]:', redacted);
                    sendPlayerErrorNotification('MPV', redacted);
                }
            }
        });
    }
}
