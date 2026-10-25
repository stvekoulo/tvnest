// Tranche preload Electron : événements temps réel, fenêtre native et fichiers.
import type {
    ElectronBridgeApi,
    ElectronBridgeAppUpdateReleaseNotesRequest,
    ElectronBridgeAppUpdateStatus,
    ElectronBridgeBackGestureSource,
    ElectronBridgeDbOperationEvent,
    ElectronBridgeEpgProgress,
    ElectronBridgePlayerError,
    ElectronBridgePlaylistFetchOptions,
    ElectronBridgePlaylistOpenRequest,
    ElectronBridgeRemoteControlCommand,
    ElectronBridgeRemoteControlStatus,
    ElectronBridgeWindowState,
    EmbeddedMpvSession,
    ExternalPlayerSession,
    PlaybackPositionData,
    PlaylistRefreshEvent,
    PortalDebugEvent,
} from '@iptvnator/shared/interfaces';
import {
    ACKNOWLEDGE_PLAYLIST_OPEN_REQUEST,
    ANNOUNCE_PLAYLIST_OPEN_LISTENER,
    APP_UPDATE_CHECK,
    APP_UPDATE_DOWNLOAD,
    APP_UPDATE_GET_RELEASE_NOTES,
    APP_UPDATE_GET_STATUS,
    APP_UPDATE_INSTALL,
    APP_UPDATE_STATUS_CHANGED,
    OPEN_FILE,
    WINDOW_BACK_REQUESTED,
} from '@iptvnator/shared/interfaces/ipc-commands';
import { ipcRenderer, webFrame, webUtils } from 'electron';
import { adjustFrameZoomLevel } from './preload-zoom-level';

const dbSaveContentProgressListeners = new Set<
    (
        event: Electron.IpcRendererEvent,
        data: ElectronBridgeDbOperationEvent
    ) => void
>();

export const frameZoomPorts = {
    getZoomLevel: () => webFrame.getZoomLevel(),
    setZoomLevel: (level: number) => webFrame.setZoomLevel(level),
};

export type PreloadWindowEventsSlice = Pick<
    ElectronBridgeApi,
    | 'onChannelChange'
    | 'onRemoteControlCommand'
    | 'updateRemoteControlStatus'
    | 'onPlayerError'
    | 'onPortalDebugEvent'
    | 'onEpgProgress'
    | 'onPlaybackPositionUpdate'
    | 'onExternalPlayerSessionUpdate'
    | 'onEmbeddedMpvSessionUpdate'
    | 'onDbOperationEvent'
    | 'onPlaylistRefreshEvent'
    | 'onDbSaveContentProgress'
    | 'removeDbSaveContentProgress'
    | 'getAppVersion'
    | 'platform'
    | 'getAppUpdateStatus'
    | 'checkForAppUpdate'
    | 'downloadAppUpdate'
    | 'installAppUpdate'
    | 'getAppUpdateReleaseNotes'
    | 'onAppUpdateStatusChange'
    | 'minimizeWindow'
    | 'toggleMaximizeWindow'
    | 'toggleFullScreenWindow'
    | 'closeWindow'
    | 'adjustZoomLevel'
    | 'getWindowState'
    | 'onWindowStateChange'
    | 'onWindowBackRequested'
    | 'setWindowCloseGuard'
    | 'confirmWindowClose'
    | 'cancelWindowClose'
    | 'onWindowCloseRequested'
    | 'setPlaybackKeepAwake'
    | 'setParentalLockState'
    | 'fetchPlaylistByUrl'
    | 'updatePlaylistFromFilePath'
    | 'openPlaylistFromFile'
    | 'onPlaylistOpenRequest'
    | 'announcePlaylistOpenListener'
    | 'acknowledgePlaylistOpenRequest'
    | 'getPathForFile'
    | 'saveFileDialog'
    | 'writeFile'
    | 'setUserAgent'
>;

export const preloadWindowEventsApi: PreloadWindowEventsSlice = {
    onChannelChange: (cb: (data: { direction: 'up' | 'down' }) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: { direction: 'up' | 'down' }) => cb(d);
        ipcRenderer.on('CHANNEL_CHANGE', h);
        return () => ipcRenderer.off('CHANNEL_CHANGE', h);
    },
    onRemoteControlCommand: (cb: (d: ElectronBridgeRemoteControlCommand) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: ElectronBridgeRemoteControlCommand) => cb(d);
        ipcRenderer.on('REMOTE_CONTROL_COMMAND', h);
        return () => ipcRenderer.off('REMOTE_CONTROL_COMMAND', h);
    },
    updateRemoteControlStatus: (status: ElectronBridgeRemoteControlStatus) => {
        ipcRenderer.send('REMOTE_CONTROL_STATUS_UPDATE', status);
    },
    onPlayerError: (cb: (d: ElectronBridgePlayerError) => void) => {
        ipcRenderer.on('player-error', (_e, d) => cb(d));
    },
    onPortalDebugEvent: (cb: (d: PortalDebugEvent) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: PortalDebugEvent) => cb(d);
        ipcRenderer.on('PORTAL_DEBUG_EVENT', h);
        return () => ipcRenderer.off('PORTAL_DEBUG_EVENT', h);
    },
    onEpgProgress: (cb: (d: ElectronBridgeEpgProgress) => void) => {
        ipcRenderer.on('EPG_PROGRESS_UPDATE', (_e, d) => cb(d));
    },
    onPlaybackPositionUpdate: (cb: (d: PlaybackPositionData) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: PlaybackPositionData) => cb(d);
        ipcRenderer.on('playback-position-update', h);
        return () => ipcRenderer.off('playback-position-update', h);
    },
    onExternalPlayerSessionUpdate: (cb: (d: ExternalPlayerSession) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: ExternalPlayerSession) => cb(d);
        ipcRenderer.on('EXTERNAL_PLAYER_SESSION_UPDATE', h);
        return () => ipcRenderer.off('EXTERNAL_PLAYER_SESSION_UPDATE', h);
    },
    onEmbeddedMpvSessionUpdate: (cb: (d: EmbeddedMpvSession) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: EmbeddedMpvSession) => cb(d);
        ipcRenderer.on('EMBEDDED_MPV_SESSION_UPDATE', h);
        return () => ipcRenderer.off('EMBEDDED_MPV_SESSION_UPDATE', h);
    },
    onDbOperationEvent: (cb: (d: ElectronBridgeDbOperationEvent) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: ElectronBridgeDbOperationEvent) => cb(d);
        ipcRenderer.on('DB_OPERATION_EVENT', h);
        return () => ipcRenderer.off('DB_OPERATION_EVENT', h);
    },
    onPlaylistRefreshEvent: (cb: (d: PlaylistRefreshEvent) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: PlaylistRefreshEvent) => cb(d);
        ipcRenderer.on('PLAYLIST:REFRESH_EVENT', h);
        return () => ipcRenderer.off('PLAYLIST:REFRESH_EVENT', h);
    },
    onDbSaveContentProgress: (cb: (count: number) => void) => {
        const h = (_e: Electron.IpcRendererEvent, d: ElectronBridgeDbOperationEvent) => {
            if (d.operation === 'save-content' && d.status === 'progress') {
                cb(d.increment ?? d.current ?? 0);
            }
        };
        dbSaveContentProgressListeners.add(h);
        ipcRenderer.on('DB_OPERATION_EVENT', h);
    },
    removeDbSaveContentProgress: () => {
        dbSaveContentProgressListeners.forEach((h) => ipcRenderer.off('DB_OPERATION_EVENT', h));
        dbSaveContentProgressListeners.clear();
    },
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    platform: process.platform,
    getAppUpdateStatus: () => ipcRenderer.invoke(APP_UPDATE_GET_STATUS),
    checkForAppUpdate: () => ipcRenderer.invoke(APP_UPDATE_CHECK),
    downloadAppUpdate: () => ipcRenderer.invoke(APP_UPDATE_DOWNLOAD),
    installAppUpdate: () => ipcRenderer.invoke(APP_UPDATE_INSTALL),
    getAppUpdateReleaseNotes: (req?: ElectronBridgeAppUpdateReleaseNotesRequest) =>
        ipcRenderer.invoke(APP_UPDATE_GET_RELEASE_NOTES, req),
    onAppUpdateStatusChange: (cb: (s: ElectronBridgeAppUpdateStatus) => void) => {
        const h = (_e: Electron.IpcRendererEvent, s: ElectronBridgeAppUpdateStatus) => cb(s);
        ipcRenderer.on(APP_UPDATE_STATUS_CHANGED, h);
        return () => ipcRenderer.off(APP_UPDATE_STATUS_CHANGED, h);
    },
    minimizeWindow: () => ipcRenderer.invoke('WINDOW:MINIMIZE'),
    toggleMaximizeWindow: () => ipcRenderer.invoke('WINDOW:TOGGLE_MAXIMIZE'),
    toggleFullScreenWindow: () => ipcRenderer.invoke('WINDOW:TOGGLE_FULLSCREEN'),
    closeWindow: () => ipcRenderer.invoke('WINDOW:CLOSE'),
    adjustZoomLevel: (action) => adjustFrameZoomLevel(frameZoomPorts, action),
    getWindowState: () => ipcRenderer.invoke('WINDOW:GET_STATE'),
    onWindowStateChange: (cb: (s: ElectronBridgeWindowState) => void) => {
        const h = (_e: Electron.IpcRendererEvent, s: ElectronBridgeWindowState) => cb(s);
        ipcRenderer.on('WINDOW:STATE_CHANGED', h);
        return () => ipcRenderer.off('WINDOW:STATE_CHANGED', h);
    },
    onWindowBackRequested: (cb: (src: ElectronBridgeBackGestureSource) => void) => {
        const h = (_e: Electron.IpcRendererEvent, src: unknown) => {
            if (src === 'app-command' || src === 'swipe') cb(src);
        };
        ipcRenderer.on(WINDOW_BACK_REQUESTED, h);
        return () => ipcRenderer.off(WINDOW_BACK_REQUESTED, h);
    },
    setWindowCloseGuard: (active: boolean) =>
        ipcRenderer.invoke('WINDOW:SET_CLOSE_GUARD', active),
    confirmWindowClose: () => ipcRenderer.invoke('WINDOW:CONFIRM_CLOSE'),
    cancelWindowClose: (requestId?: number) =>
        ipcRenderer.invoke('WINDOW:CANCEL_CLOSE', requestId),
    onWindowCloseRequested: (cb: (requestId: number) => void) => {
        const h = (_e: Electron.IpcRendererEvent, id: number) => cb(id);
        ipcRenderer.on('WINDOW:CLOSE_REQUESTED', h);
        return () => ipcRenderer.off('WINDOW:CLOSE_REQUESTED', h);
    },
    setPlaybackKeepAwake: (active: boolean) =>
        ipcRenderer.invoke('PLAYBACK:SET_KEEP_AWAKE', active === true),
    setParentalLockState: (active: boolean) =>
        ipcRenderer.invoke('PARENTAL_LOCK:SET_STATE', active === true),
    fetchPlaylistByUrl: (url: string, title?: string, opts?: ElectronBridgePlaylistFetchOptions) =>
        ipcRenderer.invoke('fetch-playlist-by-url', url, title, opts),
    updatePlaylistFromFilePath: (filePath: string, title: string) =>
        ipcRenderer.invoke('update-playlist-from-file-path', filePath, title),
    openPlaylistFromFile: () => ipcRenderer.invoke('open-playlist-from-file'),
    onPlaylistOpenRequest: (cb: (req: ElectronBridgePlaylistOpenRequest) => void) => {
        const h = (_e: Electron.IpcRendererEvent, req: ElectronBridgePlaylistOpenRequest) => cb(req);
        ipcRenderer.on(OPEN_FILE, h);
        return () => ipcRenderer.off(OPEN_FILE, h);
    },
    announcePlaylistOpenListener: () => ipcRenderer.invoke(ANNOUNCE_PLAYLIST_OPEN_LISTENER),
    acknowledgePlaylistOpenRequest: (id: string) =>
        ipcRenderer.invoke(ACKNOWLEDGE_PLAYLIST_OPEN_REQUEST, id),
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    saveFileDialog: (defaultPath: string, filters?: { name: string; extensions: string[] }[]) =>
        ipcRenderer.invoke('save-file-dialog', defaultPath, filters),
    writeFile: (filePath: string, content: string) =>
        ipcRenderer.invoke('write-file', filePath, content),
    setUserAgent: (ua?: string | null, referer?: string | null, scope?: string | null, creds?: { authorization?: string | null; cookie?: string | null } | null) =>
        ipcRenderer.invoke('set-user-agent', ua, referer, scope, creds),
};
