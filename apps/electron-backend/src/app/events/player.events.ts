import { dialog, ipcMain } from 'electron';
import {
    CLOSE_EXTERNAL_PLAYER_SESSION,
    type ExternalPlayerName,
    PLAYBACK_SET_KEEP_AWAKE,
    PlayerContentInfo,
} from '@iptvnator/shared/interfaces';
import { setPlaybackKeepAwake } from '../services/playback-keep-awake.service';
import { waitForLoginShellPath } from '../startup/login-shell-path';
import {
    MPV_PLAYER_PATH,
    store,
    VLC_PLAYER_PATH,
} from '../services/store.service';
import {
    normalizePlayerPathForStore,
    resolveExternalPlayerLaunchContext as resolveLaunchContext,
} from './external-player-launch-context';
import {
    externalPlayerSessions,
    traceExternalPlayer,
} from './external-player-runtime';
import { openMpvPlayer, setMpvReuseInstance } from './mpv-session.service';
import { openVlcPlayer, setVlcReuseInstance } from './vlc-session.service';

export {
    buildExternalPlayerSpawnSpec,
    buildPlayerArgsWithCustomArguments,
    isRunningInFlatpak,
    parseExternalPlayerArguments,
    resolveExternalPlayerLaunchContext,
    shouldReuseMpvInstance,
    shouldReuseVlcInstance,
    shouldUseMpvSocketBridge,
} from './external-player-launch-context';
export {
    buildVlcEnqueueCommands,
    parseVlcRcNumericResponse,
    parseVlcRcPlaybackState,
} from './vlc-session.service';

/**
 * A player resolved to a bare name (no configured path, no well-known
 * install found) is looked up through PATH, so it waits for the login shell
 * PATH; a path to an executable starts right away. So does a Flatpak host
 * launch: `flatpak-spawn --host` resolves the name with the host's PATH,
 * which the sandbox's login shell lookup cannot change.
 */
async function waitForPathIfBareName(
    player: ExternalPlayerName,
    configuredPath: string | undefined
): Promise<void> {
    const context = resolveLaunchContext(player, configuredPath);
    if (context.mode !== 'flatpak-host' && !/[\\/]/.test(context.playerPath)) {
        await waitForLoginShellPath();
    }
}

export default class PlayerEvents {
    static bootstrapPlayerEvents(): Electron.IpcMain {
        return ipcMain;
    }
}

ipcMain.handle(
    'OPEN_MPV_PLAYER',
    async (
        _event,
        url: string,
        title: string,
        thumbnail?: string,
        userAgent?: string,
        referer?: string,
        origin?: string,
        contentInfo?: PlayerContentInfo,
        startTime?: number,
        headers?: Record<string, string>
    ) => {
        await waitForPathIfBareName('mpv', store.get(MPV_PLAYER_PATH));
        return openMpvPlayer({
            url,
            title,
            thumbnail,
            userAgent,
            referer,
            origin,
            contentInfo,
            startTime,
            headers,
        });
    }
);

function sanitizePlayerExecutablePath(
    rawPath: string | null | undefined
): string {
    const normalized = normalizePlayerPathForStore(
        typeof rawPath === 'string'
            ? Array.from(rawPath)
                  .filter((ch) => {
                      const c = ch.charCodeAt(0);
                      return c > 0x1f && c !== 0x7f;
                  })
                  .join('')
            : rawPath
    );
    if (/^\\\\/.test(normalized)) {
        throw new Error('Network UNC paths are not allowed for player binaries');
    }
    return normalized;
}

ipcMain.handle(
    'SELECT_EXTERNAL_PLAYER_EXECUTABLE',
    async (_event, player: ExternalPlayerName): Promise<string | null> => {
        const filters =
            process.platform === 'win32'
                ? [{ name: 'Executable', extensions: ['exe', 'cmd', 'bat'] }]
                : process.platform === 'darwin'
                  ? [{ name: 'Application', extensions: ['app'] }, { name: 'Binary', extensions: ['*'] }]
                  : [{ name: 'Binary', extensions: ['*'] }];
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            title: player === 'vlc' ? 'Choisir VLC' : 'Choisir MPV',
            filters,
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        const chosen = sanitizePlayerExecutablePath(result.filePaths[0]);
        store.set(player === 'vlc' ? VLC_PLAYER_PATH : MPV_PLAYER_PATH, chosen);
        return chosen;
    }
);

ipcMain.handle(
    'SET_MPV_PLAYER_PATH',
    (_event, mpvPlayerPath: string | null | undefined) => {
        const normalizedPlayerPath =
            sanitizePlayerExecutablePath(mpvPlayerPath);
        traceExternalPlayer('set mpv player path', {
            playerPath: normalizedPlayerPath,
        });
        store.set(MPV_PLAYER_PATH, normalizedPlayerPath);
    }
);

ipcMain.handle('SET_MPV_REUSE_INSTANCE', (_event, reuseInstance: boolean) => {
    setMpvReuseInstance(reuseInstance);
});

ipcMain.handle(
    'OPEN_VLC_PLAYER',
    async (
        _event,
        url: string,
        title: string,
        thumbnail?: string,
        userAgent?: string,
        referer?: string,
        origin?: string,
        contentInfo?: PlayerContentInfo,
        startTime?: number,
        headers?: Record<string, string>
    ) => {
        await waitForPathIfBareName('vlc', store.get(VLC_PLAYER_PATH));
        return openVlcPlayer({
            url,
            title,
            thumbnail,
            userAgent,
            referer,
            origin,
            contentInfo,
            startTime,
            headers,
        });
    }
);

ipcMain.handle(
    'SET_VLC_PLAYER_PATH',
    (_event, vlcPlayerPath: string | null | undefined) => {
        const normalizedPlayerPath =
            sanitizePlayerExecutablePath(vlcPlayerPath);
        traceExternalPlayer('set vlc player path', {
            playerPath: normalizedPlayerPath,
        });
        store.set(VLC_PLAYER_PATH, normalizedPlayerPath);
    }
);

ipcMain.handle('SET_VLC_REUSE_INSTANCE', (_event, reuseInstance: boolean) => {
    setVlcReuseInstance(reuseInstance);
});

ipcMain.handle(
    CLOSE_EXTERNAL_PLAYER_SESSION,
    async (_event, sessionId: string) => {
        return externalPlayerSessions.closeSession(sessionId);
    }
);

ipcMain.handle(PLAYBACK_SET_KEEP_AWAKE, (event, active: boolean) => {
    setPlaybackKeepAwake(event.sender, active === true);
});
