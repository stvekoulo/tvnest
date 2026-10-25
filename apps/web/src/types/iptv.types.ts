// Types métier réels pour TVNest Desktop (zéro donnée fictive).
import type {
  ElectronDownloadItem,
  ElectronRecordingItem,
  EpgProgram,
  PlaybackPositionData,
} from '@iptvnator/shared/interfaces';
import type { ContentLanguageCode, UiLanguage } from '@/lib/i18n';

export type AppSection =
  | 'dashboard'
  | 'playlists'
  | 'live'
  | 'movies'
  | 'series'
  | 'epg'
  | 'favorites'
  | 'history'
  | 'downloads'
  | 'settings';

export type PortalKind =
  | 'm3u-url'
  | 'm3u-file'
  | 'm3u-text'
  | 'xtream'
  | 'stalker';

export type StreamKind = 'live' | 'movie' | 'series' | 'episode';

export type CatalogQualityFilter = 'ALL' | '4K' | 'FHD' | 'HD' | 'HEVC';

export type CatalogSortMode =
  | 'relevance'
  | 'recent'
  | 'rating-desc'
  | 'title-asc'
  | 'title-desc'
  | 'year-desc';

export interface CatalogFilterState {
  search: string;
  language: ContentLanguageCode;
  quality: CatalogQualityFilter;
  minRating: number;
  year: string;
  onlyFavorites: boolean;
  hasCatchup: boolean;
  hasEpg: boolean;
  sortBy: CatalogSortMode;
}

export interface PlaylistStreamCounts {
  live: number;
  movie: number;
  series: number;
  total: number;
}

export interface UnifiedPlaylist {
  id: string;
  title: string;
  kind: PortalKind;
  url?: string;
  filePath?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  macAddress?: string;
  serialNumber?: string;
  token?: string;
  epgUrl?: string;
  userAgent?: string;
  channelCount: number;
  counts?: PlaylistStreamCounts;
  updatedAt?: string;
  autoRefresh?: boolean;
}

export interface UnifiedCategory {
  id: string;
  dbId?: number;
  xtreamId?: number;
  /** Nom affiché (emojis retirés). */
  name: string;
  /** Nom exact en base, utilisé pour filtrer côté backend. */
  rawName?: string;
  type: 'live' | 'movie' | 'series';
  count?: number;
  hidden?: boolean;
}

export interface UnifiedMedia {
  id: string;
  dbContentId?: number;
  xtreamId?: number;
  playlistId: string;
  playlistTitle?: string;
  portalKind: PortalKind;
  kind: StreamKind;
  title: string;
  category: string;
  categoryId?: string;
  posterUrl?: string;
  backdropUrl?: string;
  streamUrl?: string;
  containerExtension?: string;
  tvgId?: string;
  tvArchive?: number;
  rating?: string;
  year?: string;
  duration?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  youtubeTrailer?: string;
  addedAt?: string;
  isFavorite?: boolean;
  userAgent?: string;
  referrer?: string;
  progressSeconds?: number;
  durationSeconds?: number;
}

export interface SeriesEpisode {
  id: string;
  episodeNum: number;
  seasonNum: number;
  title: string;
  containerExtension: string;
  streamUrl: string;
  duration?: string;
  plot?: string;
  posterUrl?: string;
  rating?: string;
  progressSeconds?: number;
  durationSeconds?: number;
}

export interface SeriesDetail {
  series: UnifiedMedia;
  seasons: number[];
  episodesBySeason: Record<number, SeriesEpisode[]>;
}

export interface AppPreferences {
  uiLanguage: UiLanguage;
  preferredContentLanguage: ContentLanguageCode;
  autoFilterByLanguage: boolean;
  mpvPlayerPath: string;
  vlcPlayerPath: string;
  defaultPlayer: 'builtin' | 'mpv' | 'vlc';
  embeddedMpvEnabled: boolean;
  epgUrls: string[];
  userAgent: string;
  autoplay: boolean;
  parentalLockEnabled: boolean;
  /** Vérifie et télécharge automatiquement les nouvelles releases GitHub. */
  autoUpdate: boolean;
  /** Actualisation des sources au démarrage : 0 = jamais, sinon tous les N jours (1 à 7). */
  sourceRefreshDays: number;
}

export type {
  ElectronDownloadItem,
  ElectronRecordingItem,
  EpgProgram,
  PlaybackPositionData,
};
