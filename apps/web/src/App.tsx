// Coque principale TVNest Desktop (Noir Absolu OLED, fiche dédiée plein écran et libmpv).
import { SourceImportModal } from '@/components/modals/source-import-modal';
import { StreamSurface } from '@/components/player/stream-surface';
import { UnifiedSidebar } from '@/components/shell/unified-sidebar';
import { WindowTitlebar } from '@/components/shell/window-titlebar';
import { CatalogWorkspaceView } from '@/components/views/catalog-workspace-view';
import { DashboardBentoView } from '@/components/views/dashboard-bento-view';
import { DownloadsView } from '@/components/views/downloads-view';
import { EpgGuideView } from '@/components/views/epg-guide-view';
import { MediaDetailView } from '@/components/views/media-detail-view';
import { PlaylistsManagerView } from '@/components/views/playlists-manager-view';
import { SettingsView } from '@/components/views/settings-view';
import { useIptvWorkspace } from '@/hooks/use-iptv-workspace';

export function App() {
  const ws = useIptvWorkspace();
  const suppressPreviewPlayer = ws.theaterOpen || Boolean(ws.detailMedia);

  const renderSection = () => {
    // Toute fiche Film ou Série s'ouvre dans sa propre page dédiée pleine largeur (sans modal).
    if (ws.detailMedia) {
      return (
        <div className="p-6">
          <MediaDetailView
            media={ws.detailMedia}
            seriesDetail={ws.seriesDetail}
            loading={ws.detailLoading}
            playlist={ws.activePlaylist}
            uiLanguage={ws.prefs.uiLanguage}
            theaterOpen={ws.theaterOpen}
            onBack={ws.closeMediaDetail}
            onPlayTheater={(item) => ws.playStream(item, true)}
            onToggleFavorite={ws.toggleFavorite}
            onDownload={ws.downloadMedia}
          />
        </div>
      );
    }

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
            onExpandTheater={() => ws.setTheaterOpen(true)}
          />
        );

      case 'live':
      case 'movies':
      case 'series':
      case 'favorites':
      case 'history': {
        const meta = {
          live: {
            title: 'Télévision en Direct (Live TV)',
            cats: ws.categories.filter((c) => c.type === 'live'),
            isLive: true,
          },
          movies: {
            title: 'Films VOD',
            cats: ws.categories.filter((c) => c.type === 'movie'),
            isLive: false,
          },
          series: {
            title: 'Séries & Saisons',
            cats: ws.categories.filter((c) => c.type === 'series'),
            isLive: false,
          },
          favorites: {
            title: 'Vos Favoris SQLite',
            cats: [],
            isLive: false,
          },
          history: {
            title: 'Historique de Lecture',
            cats: [],
            isLive: false,
          },
        }[ws.section];

        return (
          <CatalogWorkspaceView
            title={meta.title}
            isLiveSection={meta.isLive}
            playlist={ws.activePlaylist}
            items={ws.items}
            totalMatches={ws.totalMatches}
            availableYears={ws.availableYears}
            queryTookMs={ws.queryTookMs}
            categories={meta.cats}
            selectedCategory={ws.selectedCategory}
            onSelectCategory={ws.setSelectedCategory}
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
            onExpandTheater={() => ws.setTheaterOpen(true)}
          />
        );
      }

      case 'epg':
        return (
          <EpgGuideView
            liveItems={ws.items}
            prefs={ws.prefs}
            onUpdatePrefs={ws.updatePrefs}
            onPlay={(item) => ws.playStream(item, false)}
            onNotify={ws.notify}
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
            onDeletePlaylist={ws.deletePlaylist}
            onOpenAddSource={() => ws.setAddSourceOpen(true)}
          />
        );

      case 'settings':
        return (
          <SettingsView
            prefs={ws.prefs}
            onUpdatePrefs={ws.updatePrefs}
            onNotify={ws.notify}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <UnifiedSidebar
        section={ws.section}
        onSelectSection={ws.setSection}
        collapsed={ws.sidebarCollapsed}
        onToggleCollapsed={() => ws.setSidebarCollapsed((c) => !c)}
        uiLanguage={ws.prefs.uiLanguage}
        counts={{
          playlists: ws.playlists.length,
          favorites: ws.highlights.favorites.length,
          downloads: ws.downloads.length,
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <WindowTitlebar
          isElectron={ws.isElectron}
          playlists={ws.playlists}
          activePlaylist={ws.activePlaylist}
          onSelectPlaylist={ws.setActivePlaylistId}
          searchQuery={ws.filters.search}
          onSearchChange={(q) => {
            ws.updateFilters({ search: q });
            if (ws.detailMedia) ws.closeMediaDetail();
            if (ws.section === 'dashboard' && q.trim().length > 0) {
              ws.setSection('movies');
            }
          }}
          syncLabel={ws.syncLabel}
          uiLanguage={ws.prefs.uiLanguage}
          onOpenAddSource={() => ws.setAddSourceOpen(true)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">{renderSection()}</main>
      </div>

      <SourceImportModal
        open={ws.addSourceOpen}
        onClose={() => ws.setAddSourceOpen(false)}
        addSource={ws.addSource}
      />

      {/* Mode Cinéma Plein Écran TVNest (instance unique StreamSurface) */}
      {ws.theaterOpen && ws.activeMedia ? (
        <div className="fixed inset-0 z-50 bg-black/95 p-3 sm:p-5">
          <div className="h-full w-full overflow-hidden rounded-[26px] border border-white/15 shadow-2xl">
            <StreamSurface
              media={ws.activeMedia}
              playlist={ws.activePlaylist}
              playing={ws.isPlaying}
              onPlayingChange={ws.setIsPlaying}
              onCloseTheater={() => {
                // Fermer le Cinéma met en pause : sinon l'aperçu de l'Accueil relance le flux seul.
                ws.setTheaterOpen(false);
                ws.setIsPlaying(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {ws.toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-full border border-primary/40 bg-elevated px-4 py-2 text-xs font-semibold text-foreground shadow-2xl">
          {ws.toast}
        </div>
      ) : null}
    </div>
  );
}

export default App;
