// Routeur interne des rubriques de l'espace de travail TVNest.
import { lazy } from 'react';
import { requestAppFullscreen } from '@/components/player/player-host';
import { CatalogWorkspaceView } from '@/components/views/catalog-workspace-view';
import { DashboardBentoView } from '@/components/views/dashboard-bento-view';
import { HistoryView } from '@/components/views/history-view';
import type { AppUpdateState } from '@/hooks/use-app-update';
import type { useIptvWorkspace } from '@/hooks/use-iptv-workspace';
import { t } from '@/lib/i18n';

const DownloadsView = lazy(() =>
  import('@/components/views/downloads-view').then((m) => ({ default: m.DownloadsView }))
);
const GlobalSearchView = lazy(() =>
  import('@/components/views/global-search-view').then((m) => ({ default: m.GlobalSearchView }))
);
const EpgGuideView = lazy(() =>
  import('@/components/views/epg-guide-view').then((m) => ({ default: m.EpgGuideView }))
);
const PlaylistsManagerView = lazy(() =>
  import('@/components/views/playlists-manager-view').then((m) => ({ default: m.PlaylistsManagerView }))
);
const SettingsView = lazy(() =>
  import('@/components/views/settings-view').then((m) => ({ default: m.SettingsView }))
);

interface WorkspaceSectionViewProps {
  ws: ReturnType<typeof useIptvWorkspace>;
  appUpdate: AppUpdateState;
  suppressPreviewPlayer: boolean;
}

export function WorkspaceSectionView({
  ws,
  appUpdate,
  suppressPreviewPlayer,
}: WorkspaceSectionViewProps) {
  switch (ws.section) {
    case 'dashboard':
      return (
        <DashboardBentoView
          playlists={ws.playlists}
          activePlaylist={ws.activePlaylist}
          categories={ws.categories}
          highlights={ws.highlights}
          fallbackItems={ws.items}
          activeMedia={ws.activeMedia}
          isPlaying={ws.isPlaying}
          onSetPlaying={ws.setIsPlaying}
          suppressPreviewPlayer={suppressPreviewPlayer}
          autoplay={ws.prefs.autoplay}
          onToggleAutoplay={(v) => ws.updatePrefs({ autoplay: v })}
          epgByChannel={ws.epgByChannel}
          uiLanguage={ws.prefs.uiLanguage}
          onPlay={ws.playStream}
          onOpenDetail={ws.openMediaDetail}
          onToggleFavorite={ws.toggleFavorite}
          onOpenAddSource={() => ws.setAddSourceOpen(true)}
          onNavigateCategory={(cat) => {
            const target =
              cat.type === 'live' ? 'live' : cat.type === 'movie' ? 'movies' : 'series';
            ws.setSection(target);
            ws.setSelectedCategory(cat.id, target);
          }}
          onNavigateSection={ws.setSection}
          onExpandTheater={() => {
            requestAppFullscreen();
            ws.setTheaterOpen(true);
          }}
        />
      );

    case 'history':
      return (
        <HistoryView
          items={ws.items}
          epgByChannel={ws.epgByChannel}
          onPlay={ws.playStream}
          onOpenDetail={ws.openMediaDetail}
          onToggleFavorite={ws.toggleFavorite}
        />
      );

    case 'live':
    case 'movies':
    case 'series':
    case 'favorites': {
      const meta = {
        live: {
          title: t(ws.prefs.uiLanguage, 'live'),
          cats: ws.categories.filter((c) => c.type === 'live'),
          isLive: true,
        },
        movies: {
          title: t(ws.prefs.uiLanguage, 'movies'),
          cats: ws.categories.filter((c) => c.type === 'movie'),
          isLive: false,
        },
        series: {
          title: t(ws.prefs.uiLanguage, 'series'),
          cats: ws.categories.filter((c) => c.type === 'series'),
          isLive: false,
        },
        favorites: {
          title: t(ws.prefs.uiLanguage, 'favorites'),
          cats: [],
          isLive: false,
        },
      }[ws.section];

      return (
        <CatalogWorkspaceView
          title={meta.title}
          isLiveSection={meta.isLive}
          browseType={
            ws.section === 'live'
              ? 'live'
              : ws.section === 'movies'
                ? 'movie'
                : ws.section === 'series'
                  ? 'series'
                  : undefined
          }
          playlist={ws.activePlaylist}
          items={ws.items}
          totalMatches={ws.totalMatches}
          availableYears={ws.availableYears}
          queryTookMs={ws.queryTookMs}
          categories={meta.cats}
          selectedCategory={ws.selectedCategory}
          onSelectCategory={ws.setSelectedCategory}
          onToggleCategoryLock={ws.toggleCategoryLock}
          filters={ws.filters}
          onUpdateFilters={ws.updateFilters}
          onResetFilters={ws.resetFilters}
          onLoadMore={ws.loadMore}
          epgByChannel={ws.epgByChannel}
          activeMedia={ws.activeMedia}
          isPlaying={ws.isPlaying}
          onSetPlaying={ws.setIsPlaying}
          suppressPreviewPlayer={suppressPreviewPlayer}
          uiLanguage={ws.prefs.uiLanguage}
          onPlay={ws.playStream}
          onOpenDetail={ws.openMediaDetail}
          onToggleFavorite={ws.toggleFavorite}
          onExpandTheater={() => {
            requestAppFullscreen();
            ws.setTheaterOpen(true);
          }}
        />
      );
    }

    case 'epg':
      return (
        <EpgGuideView
          activePlaylist={ws.activePlaylist}
          liveItems={ws.items}
          prefs={ws.prefs}
          onUpdatePrefs={ws.updatePrefs}
          onPlay={(item) => ws.playStream(item, true)}
          onNotify={ws.notify}
        />
      );

    case 'search':
      return (
        <GlobalSearchView
          query={ws.filters.search}
          onQueryChange={(q) => ws.updateFilters({ search: q }, 'search')}
          playlists={ws.playlists}
          epgByChannel={ws.epgByChannel}
          onPlay={(item) => ws.playStream(item, true)}
          onOpenDetail={ws.openMediaDetail}
          onToggleFavorite={ws.toggleFavorite}
        />
      );

    case 'downloads':
      return (
        <DownloadsView
          downloads={ws.downloads}
          recordings={ws.recordings}
          onRefresh={ws.refreshDownloads}
        />
      );

    case 'playlists':
      return (
        <PlaylistsManagerView
          playlists={ws.playlists}
          activePlaylistId={ws.activePlaylist?.id || null}
          onSelectPlaylist={ws.setActivePlaylistId}
          onRefreshPlaylist={ws.refreshSource}
          onDeletePlaylist={ws.deletePlaylist}
          onOpenAddSource={() => ws.setAddSourceOpen(true)}
        />
      );

    case 'settings':
      return (
        <SettingsView
          appUpdate={appUpdate}
          prefs={ws.prefs}
          onUpdatePrefs={ws.updatePrefs}
          onNotify={ws.notify}
        />
      );
  }
}
