// Tranche preload Electron : positions de lecture, téléchargements VOD et enregistrements Live.
import type {
    DownloadMetadataSnapshot,
    ElectronBridgeApi,
    ElectronBridgeDownloadStartPayload,
    ElectronBridgePlaybackPositionInput,
    RecordingProgramSnapshot,
} from '@iptvnator/shared/interfaces';
import { ipcRenderer } from 'electron';

export type PreloadDownloadsSlice = Pick<
    ElectronBridgeApi,
    | 'dbSavePlaybackPosition'
    | 'dbGetPlaybackPosition'
    | 'dbGetSeriesPlaybackPositions'
    | 'dbGetRecentPlaybackPositions'
    | 'dbGetAllPlaybackPositions'
    | 'dbReplaceAllPlaybackPositions'
    | 'dbClearAllPlaybackPositions'
    | 'dbClearPlaybackPosition'
    | 'dbSavePlaybackPositionsBatch'
    | 'dbClearPlaybackPositionsBatch'
    | 'getLocalIpAddresses'
    | 'downloadsStart'
    | 'downloadsCancel'
    | 'downloadsPause'
    | 'downloadsResume'
    | 'downloadsRetry'
    | 'downloadsRedownloadMissing'
    | 'downloadsRemove'
    | 'downloadsGetList'
    | 'downloadsGet'
    | 'downloadsUpdateMetadata'
    | 'downloadsGetDefaultFolder'
    | 'downloadsSelectFolder'
    | 'downloadsRevealFile'
    | 'downloadsPlayFile'
    | 'downloadsClearCompleted'
    | 'onDownloadsUpdate'
    | 'recordingsGetList'
    | 'recordingsGet'
    | 'recordingsStop'
    | 'recordingsRemove'
    | 'recordingsUpdatePrograms'
    | 'recordingsRevealFile'
    | 'recordingsPlayFile'
    | 'onRecordingsUpdate'
>;

export const preloadDownloadsApi: PreloadDownloadsSlice = {
    dbSavePlaybackPosition: (playlistId: string, data: ElectronBridgePlaybackPositionInput) =>
        ipcRenderer.invoke('DB_SAVE_PLAYBACK_POSITION', playlistId, data),
    dbGetPlaybackPosition: (playlistId: string, contentXtreamId: number, contentType: 'vod' | 'episode') =>
        ipcRenderer.invoke('DB_GET_PLAYBACK_POSITION', playlistId, contentXtreamId, contentType),
    dbGetSeriesPlaybackPositions: (playlistId: string, seriesXtreamId: number) =>
        ipcRenderer.invoke('DB_GET_SERIES_PLAYBACK_POSITIONS', playlistId, seriesXtreamId),
    dbGetRecentPlaybackPositions: (playlistId: string, limit?: number) =>
        ipcRenderer.invoke('DB_GET_RECENT_PLAYBACK_POSITIONS', playlistId, limit),
    dbGetAllPlaybackPositions: (playlistId: string) =>
        ipcRenderer.invoke('DB_GET_ALL_PLAYBACK_POSITIONS', playlistId),
    dbReplaceAllPlaybackPositions: (playlistId: string, items: ElectronBridgePlaybackPositionInput[]) =>
        ipcRenderer.invoke('DB_REPLACE_ALL_PLAYBACK_POSITIONS', playlistId, items),
    dbClearAllPlaybackPositions: (playlistId: string) =>
        ipcRenderer.invoke('DB_CLEAR_ALL_PLAYBACK_POSITIONS', playlistId),
    dbClearPlaybackPosition: (playlistId: string, contentXtreamId: number, contentType: 'vod' | 'episode') =>
        ipcRenderer.invoke('DB_CLEAR_PLAYBACK_POSITION', playlistId, contentXtreamId, contentType),
    dbSavePlaybackPositionsBatch: (playlistId: string, items: ElectronBridgePlaybackPositionInput[]) =>
        ipcRenderer.invoke('DB_SAVE_PLAYBACK_POSITIONS_BATCH', playlistId, items),
    dbClearPlaybackPositionsBatch: (playlistId: string, items: { contentXtreamId: number; contentType: 'vod' | 'episode' }[]) =>
        ipcRenderer.invoke('DB_CLEAR_PLAYBACK_POSITIONS_BATCH', playlistId, items),
    getLocalIpAddresses: () => ipcRenderer.invoke('get-local-ip-addresses'),
    downloadsStart: (data: ElectronBridgeDownloadStartPayload) =>
        ipcRenderer.invoke('DOWNLOADS_START', data),
    downloadsCancel: (downloadId: number) =>
        ipcRenderer.invoke('DOWNLOADS_CANCEL', downloadId),
    downloadsPause: (downloadId: number) =>
        ipcRenderer.invoke('DOWNLOADS_PAUSE', downloadId),
    downloadsResume: (downloadId: number, folder: string) =>
        ipcRenderer.invoke('DOWNLOADS_RESUME', downloadId, folder),
    downloadsRetry: (downloadId: number, folder: string) =>
        ipcRenderer.invoke('DOWNLOADS_RETRY', downloadId, folder),
    downloadsRedownloadMissing: (downloadId: number) =>
        ipcRenderer.invoke('DOWNLOADS_REDOWNLOAD_MISSING', downloadId),
    downloadsRemove: (downloadId: number) =>
        ipcRenderer.invoke('DOWNLOADS_REMOVE', downloadId),
    downloadsGetList: (playlistId?: string) =>
        ipcRenderer.invoke('DOWNLOADS_GET_LIST', playlistId),
    downloadsGet: (downloadId: number) =>
        ipcRenderer.invoke('DOWNLOADS_GET', downloadId),
    downloadsUpdateMetadata: (downloadId: number, snapshot: DownloadMetadataSnapshot) =>
        ipcRenderer.invoke('DOWNLOADS_UPDATE_METADATA', downloadId, snapshot),
    downloadsGetDefaultFolder: () =>
        ipcRenderer.invoke('DOWNLOADS_GET_DEFAULT_FOLDER'),
    downloadsSelectFolder: () => ipcRenderer.invoke('DOWNLOADS_SELECT_FOLDER'),
    downloadsRevealFile: (filePath: string) =>
        ipcRenderer.invoke('DOWNLOADS_REVEAL_FILE', filePath),
    downloadsPlayFile: (filePath: string) =>
        ipcRenderer.invoke('DOWNLOADS_PLAY_FILE', filePath),
    downloadsClearCompleted: (playlistId?: string) =>
        ipcRenderer.invoke('DOWNLOADS_CLEAR_COMPLETED', playlistId),
    onDownloadsUpdate: (callback: () => void) => {
        const handler = () => callback();
        ipcRenderer.on('DOWNLOADS_UPDATE_EVENT', handler);
        return () => ipcRenderer.off('DOWNLOADS_UPDATE_EVENT', handler);
    },
    recordingsGetList: (playlistId?: string) =>
        ipcRenderer.invoke('RECORDINGS_GET_LIST', playlistId),
    recordingsGet: (recordingId: number) =>
        ipcRenderer.invoke('RECORDINGS_GET', recordingId),
    recordingsStop: (recordingId: number) =>
        ipcRenderer.invoke('RECORDINGS_STOP', recordingId),
    recordingsRemove: (recordingId: number) =>
        ipcRenderer.invoke('RECORDINGS_REMOVE', recordingId),
    recordingsUpdatePrograms: (targetPath: string, programs: RecordingProgramSnapshot[]) =>
        ipcRenderer.invoke('RECORDINGS_UPDATE_PROGRAMS', targetPath, programs),
    recordingsRevealFile: (filePath: string) =>
        ipcRenderer.invoke('RECORDINGS_REVEAL_FILE', filePath),
    recordingsPlayFile: (filePath: string) =>
        ipcRenderer.invoke('RECORDINGS_PLAY_FILE', filePath),
    onRecordingsUpdate: (callback: () => void) => {
        const handler = () => callback();
        ipcRenderer.on('RECORDINGS_UPDATE_EVENT', handler);
        return () => ipcRenderer.off('RECORDINGS_UPDATE_EVENT', handler);
    },
};
