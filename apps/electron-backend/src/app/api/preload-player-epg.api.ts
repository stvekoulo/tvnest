// Tranche preload Electron : lecteurs MPV/VLC, EPG XMLTV, paramètres et sondes réseau.
import type {
    ElectronBridgeApi,
    ElectronBridgeCurrentProgramsOptions,
    ElectronBridgeEpgGuideWindow,
    ElectronBridgeEpgLookupOptions,
    ElectronBridgeTrustOptions,
    EmbeddedMpvBounds,
    EmbeddedMpvRecordingStartOptions,
    EmbeddedMpvSession,
    EmbeddedMpvSubtitleStyle,
    EmbeddedMpvSupport,
    ExternalPlayerSession,
    PlayerContentInfo,
    Playlist,
    PlaylistRefreshPayload,
    ResolvedPortalPlayback,
    Settings,
    SourceProbeContext,
    StreamProbeHeaders,
} from '@iptvnator/shared/interfaces';
import { ipcRenderer } from 'electron';
import {
    attachEmbeddedMpvFrameView,
    detachEmbeddedMpvFrameView,
} from './embedded-mpv-frame-pump';

export type PreloadPlayerEpgSlice = Pick<
    ElectronBridgeApi,
    | 'openInMpv'
    | 'openInVlc'
    | 'closeExternalPlayerSession'
    | 'getEmbeddedMpvSupport'
    | 'prepareEmbeddedMpv'
    | 'createEmbeddedMpvSession'
    | 'loadEmbeddedMpvPlayback'
    | 'setEmbeddedMpvBounds'
    | 'setEmbeddedMpvPaused'
    | 'seekEmbeddedMpv'
    | 'seekEmbeddedMpvBy'
    | 'setEmbeddedMpvVolume'
    | 'setEmbeddedMpvAudioTrack'
    | 'setEmbeddedMpvSubtitleTrack'
    | 'addEmbeddedMpvSubtitle'
    | 'setEmbeddedMpvSubtitleDelay'
    | 'setEmbeddedMpvSubtitleStyle'
    | 'selectEmbeddedMpvSubtitleFile'
    | 'setEmbeddedMpvSpeed'
    | 'setEmbeddedMpvAspect'
    | 'startEmbeddedMpvRecording'
    | 'stopEmbeddedMpvRecording'
    | 'getEmbeddedMpvDefaultRecordingFolder'
    | 'selectEmbeddedMpvRecordingFolder'
    | 'disposeEmbeddedMpvSession'
    | 'attachEmbeddedMpvFrameView'
    | 'detachEmbeddedMpvFrameView'
    | 'autoUpdatePlaylists'
    | 'fetchEpg'
    | 'getChannelPrograms'
    | 'getCurrentProgramsBatch'
    | 'getEpgChannelMetadata'
    | 'getEpgChannels'
    | 'getEpgProgramsForChannels'
    | 'getEpgProgramCoverage'
    | 'forceFetchEpg'
    | 'openEpgFileDialog'
    | 'clearEpgData'
    | 'reconcileEpgSources'
    | 'clearEpgDataForSource'
    | 'checkEpgFreshness'
    | 'searchEpgPrograms'
    | 'getEpgMapping'
    | 'getEpgMappingsBatch'
    | 'setEpgMapping'
    | 'deleteEpgMapping'
    | 'searchEpgChannels'
    | 'setMpvPlayerPath'
    | 'setVlcPlayerPath'
    | 'updateSettings'
    | 'getAiSettings'
    | 'cancelSourceProbe'
    | 'probeM3uSource'
    | 'stalkerRequest'
    | 'resetHostConnectivityGuard'
    | 'xtreamRequest'
    | 'xtreamCancelSession'
    | 'xtreamProbeUrl'
    | 'probeStreamUrl'
    | 'refreshPlaylist'
    | 'cancelPlaylistRefresh'
>;

export const preloadPlayerEpgApi: PreloadPlayerEpgSlice = {
    openInMpv: (
        url: string,
        title: string,
        thumbnail: string,
        ua: string | undefined,
        referer?: string,
        origin?: string,
        info?: PlayerContentInfo,
        startTime?: number,
        headers?: Record<string, string>
    ): Promise<ExternalPlayerSession> =>
        ipcRenderer.invoke('OPEN_MPV_PLAYER', url, title, thumbnail, ua, referer, origin, info, startTime, headers),
    openInVlc: (
        url: string,
        title: string,
        thumbnail: string,
        ua: string | undefined,
        referer?: string,
        origin?: string,
        info?: PlayerContentInfo,
        startTime?: number,
        headers?: Record<string, string>
    ): Promise<ExternalPlayerSession> =>
        ipcRenderer.invoke('OPEN_VLC_PLAYER', url, title, thumbnail, ua, referer, origin, info, startTime, headers),
    closeExternalPlayerSession: (id: string) =>
        ipcRenderer.invoke('CLOSE_EXTERNAL_PLAYER_SESSION', id),
    getEmbeddedMpvSupport: (): Promise<EmbeddedMpvSupport> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SUPPORT'),
    prepareEmbeddedMpv: (): Promise<EmbeddedMpvSupport> =>
        ipcRenderer.invoke('EMBEDDED_MPV_PREPARE'),
    createEmbeddedMpvSession: (bounds: EmbeddedMpvBounds, title?: string, vol?: number): Promise<EmbeddedMpvSession> =>
        ipcRenderer.invoke('EMBEDDED_MPV_CREATE_SESSION', bounds, title, vol),
    loadEmbeddedMpvPlayback: (id: string, playback: ResolvedPortalPlayback): Promise<void> =>
        ipcRenderer.invoke('EMBEDDED_MPV_LOAD_PLAYBACK', id, playback),
    setEmbeddedMpvBounds: (id: string, bounds: EmbeddedMpvBounds): Promise<void> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_BOUNDS', id, bounds),
    setEmbeddedMpvPaused: (id: string, paused: boolean): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_PAUSED', id, paused),
    seekEmbeddedMpv: (id: string, sec: number): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SEEK', id, sec),
    seekEmbeddedMpvBy: (id: string, delta: number): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SEEK_BY', id, delta),
    setEmbeddedMpvVolume: (id: string, vol: number): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_VOLUME', id, vol),
    setEmbeddedMpvAudioTrack: (id: string, trackId: number): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_AUDIO_TRACK', id, trackId),
    setEmbeddedMpvSubtitleTrack: (id: string, trackId: number): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_SUBTITLE_TRACK', id, trackId),
    addEmbeddedMpvSubtitle: (id: string, filePath: string): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_ADD_SUBTITLE', id, filePath),
    setEmbeddedMpvSubtitleDelay: (id: string, sec: number): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_SUBTITLE_DELAY', id, sec),
    setEmbeddedMpvSubtitleStyle: (id: string, style: EmbeddedMpvSubtitleStyle): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_SUBTITLE_STYLE', id, style),
    selectEmbeddedMpvSubtitleFile: (): Promise<string | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SELECT_SUBTITLE_FILE'),
    setEmbeddedMpvSpeed: (id: string, speed: number): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_SPEED', id, speed),
    setEmbeddedMpvAspect: (id: string, aspect: string): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SET_ASPECT', id, aspect),
    startEmbeddedMpvRecording: (id: string, opts: EmbeddedMpvRecordingStartOptions): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_START_RECORDING', id, opts),
    stopEmbeddedMpvRecording: (id: string): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_STOP_RECORDING', id),
    getEmbeddedMpvDefaultRecordingFolder: (): Promise<string> =>
        ipcRenderer.invoke('EMBEDDED_MPV_GET_DEFAULT_RECORDING_FOLDER'),
    selectEmbeddedMpvRecordingFolder: (): Promise<string | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_SELECT_RECORDING_FOLDER'),
    disposeEmbeddedMpvSession: (id: string): Promise<EmbeddedMpvSession | null> =>
        ipcRenderer.invoke('EMBEDDED_MPV_DISPOSE_SESSION', id),
    attachEmbeddedMpvFrameView: (id: string): Promise<boolean> => attachEmbeddedMpvFrameView(id),
    detachEmbeddedMpvFrameView: (): void => detachEmbeddedMpvFrameView(),
    autoUpdatePlaylists: (playlists: Playlist[], opts?: ElectronBridgeTrustOptions) =>
        ipcRenderer.invoke('AUTO_UPDATE', playlists, opts),
    fetchEpg: (urls: string[], options?: ElectronBridgeTrustOptions) =>
        ipcRenderer.invoke('FETCH_EPG', { url: urls, options }),
    getChannelPrograms: (channelId: string, options?: ElectronBridgeEpgLookupOptions) =>
        ipcRenderer.invoke('GET_CHANNEL_PROGRAMS', { channelId, options }),
    getCurrentProgramsBatch: (channelIds: string[], options?: ElectronBridgeCurrentProgramsOptions) =>
        ipcRenderer.invoke('GET_CURRENT_PROGRAMS_BATCH', { channelIds, options }),
    getEpgChannelMetadata: (channelIds: string[], options?: ElectronBridgeEpgLookupOptions) =>
        ipcRenderer.invoke('EPG_GET_CHANNEL_METADATA', { channelIds, options }),
    getEpgChannels: () => ipcRenderer.invoke('EPG_GET_CHANNELS'),
    getEpgProgramsForChannels: (win: ElectronBridgeEpgGuideWindow) =>
        ipcRenderer.invoke('EPG_GET_PROGRAMS_FOR_CHANNELS', win),
    getEpgProgramCoverage: (win: ElectronBridgeEpgGuideWindow) =>
        ipcRenderer.invoke('EPG_GET_PROGRAM_COVERAGE', win),
    forceFetchEpg: (url: string, options?: ElectronBridgeTrustOptions) =>
        ipcRenderer.invoke('EPG_FORCE_FETCH', { url, options }),
    openEpgFileDialog: () => ipcRenderer.invoke('EPG_OPEN_FILE_DIALOG'),
    clearEpgData: () => ipcRenderer.invoke('EPG_CLEAR_ALL'),
    reconcileEpgSources: (urls: string[]) =>
        ipcRenderer.invoke('EPG_RECONCILE_SOURCES', { urls }),
    clearEpgDataForSource: (sourceUrl: string) =>
        ipcRenderer.invoke('EPG_CLEAR_SOURCE', { sourceUrl }),
    checkEpgFreshness: (urls: string[], maxAgeHours?: number) =>
        ipcRenderer.invoke('EPG_CHECK_FRESHNESS', { urls, maxAgeHours }),
    searchEpgPrograms: (searchTerm: string, limit?: number) =>
        ipcRenderer.invoke('EPG_DB_SEARCH_PROGRAMS', searchTerm, limit),
    getEpgMapping: (channelKey: string) =>
        ipcRenderer.invoke('EPG_MAPPING_GET', { channelKey }),
    getEpgMappingsBatch: (channelKeys: string[]) =>
        ipcRenderer.invoke('EPG_MAPPING_GET_BATCH', { channelKeys }),
    setEpgMapping: (channelKey: string, epgChannelId: string, playlistId?: string) =>
        ipcRenderer.invoke('EPG_MAPPING_SET', { channelKey, epgChannelId, playlistId }),
    deleteEpgMapping: (channelKey: string) =>
        ipcRenderer.invoke('EPG_MAPPING_DELETE', { channelKey }),
    searchEpgChannels: (searchTerm: string, limit?: number) =>
        ipcRenderer.invoke('EPG_CHANNEL_SEARCH', { searchTerm, limit }),
    setMpvPlayerPath: (mpvPlayerPath: string) =>
        ipcRenderer.invoke('SET_MPV_PLAYER_PATH', mpvPlayerPath),
    setVlcPlayerPath: (vlcPlayerPath: string) =>
        ipcRenderer.invoke('SET_VLC_PLAYER_PATH', vlcPlayerPath),
    updateSettings: (settings: Partial<Settings>) =>
        ipcRenderer.invoke('SETTINGS_UPDATE', settings),
    getAiSettings: () => ipcRenderer.invoke('GET_AI_SETTINGS'),
    cancelSourceProbe: (id: string) => ipcRenderer.invoke('SOURCE_HEALTH_CANCEL', id),
    probeM3uSource: (payload: unknown) => ipcRenderer.invoke('M3U_SOURCE_PROBE', payload),
    stalkerRequest: (payload: {
        probe?: SourceProbeContext;
        url: string;
        macAddress: string;
        params: Record<string, string>;
        token?: string;
        serialNumber?: string;
        requestId?: string;
        skipConnectionGuard?: boolean;
    }) => ipcRenderer.invoke('STALKER_REQUEST', payload),
    resetHostConnectivityGuard: (url: string) =>
        ipcRenderer.invoke('CONNECTIVITY_GUARD_RESET', { url }),
    xtreamRequest: (payload: {
        userAgent?: string;
        probe?: SourceProbeContext;
        connectionTest?: boolean;
        url: string;
        params: Record<string, string>;
        requestId?: string;
        sessionId?: string;
        suppressErrorLog?: boolean;
    }) => ipcRenderer.invoke('XTREAM_REQUEST', payload),
    xtreamCancelSession: (sessionId: string) =>
        ipcRenderer.invoke('XTREAM_CANCEL_SESSION', sessionId),
    xtreamProbeUrl: (url: string, method?: 'GET' | 'HEAD') =>
        ipcRenderer.invoke('XTREAM_PROBE_URL', { url, method }),
    probeStreamUrl: (url: string, method?: 'GET' | 'HEAD', headers?: StreamProbeHeaders) =>
        ipcRenderer.invoke('STREAM_PROBE_URL', { url, method, ...headers }),
    refreshPlaylist: (payload: PlaylistRefreshPayload) =>
        ipcRenderer.invoke('PLAYLIST:REFRESH', payload),
    cancelPlaylistRefresh: (operationId: string) =>
        ipcRenderer.invoke('PLAYLIST:CANCEL_REFRESH', operationId),
};
