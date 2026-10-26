// Coque principale TVNest Desktop (Noir Absolu OLED, fiche dédiée plein écran et libmpv).
import { ResumePromptModal } from '@/components/modals/resume-prompt-modal';
import { SourceImportModal } from '@/components/modals/source-import-modal';
import { PlayerHost, requestAppFullscreen } from '@/components/player/player-host';
import { toggleAppFullscreen } from '@/lib/app-fullscreen';
import { UnifiedSidebar } from '@/components/shell/unified-sidebar';
import { WindowTitlebar } from '@/components/shell/window-titlebar';
import { CatalogWorkspaceView } from '@/components/views/catalog-workspace-view';
import { DashboardBentoView } from '@/components/views/dashboard-bento-view';
import { MediaDetailView } from '@/components/views/media-detail-view';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { useAppUpdate } from '@/hooks/use-app-update';
import { useIptvWorkspace } from '@/hooks/use-iptv-workspace';
import { useSourceAutoRefresh } from '@/hooks/use-source-auto-refresh';


// Vues secondaires chargées à la demande : démarrage plus léger (Accueil et catalogue d'abord).
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

export function App() {
  const ws = useIptvWorkspace();
  const appUpdate = useAppUpdate(ws.prefs.autoUpdate, ws.notify);
  useSourceAutoRefresh({
    playlists: ws.playlists,
    days: ws.prefs.sourceRefreshDays,
    onRefreshed: ws.refreshPlaylists,
    notify: ws.notify,
    setSyncLabel: ws.setSyncLabel,
  });
  const mainRef = useRef<HTMLElement | null>(null);

  // F11 : plein écran de toute l'interface (comme le bouton de la barre de titre).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F11') return;
      e.preventDefault();
      void toggleAppFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Chaque rubrique s'ouvre en haut de page. Une fiche se pose PAR-DESSUS la liste, qui
  // reste montée : au retour, chaque zone de défilement (grille, groupes, recherche) est intacte.
  // `isolate` garde les z-index de la liste (badges, menus) sous la fiche.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [ws.section]);
  // L'aperçu reste en place sous le Cinéma : le lecteur unique y revient sans rechargement.
  const suppressPreviewPlayer = Boolean(ws.detailMedia);

  // Fiche Film ou Série : page pleine largeur posée sur la liste (sans modal).
  const renderDetail = () =>
    ws.detailMedia ? (
      <div key={ws.detailMedia.id} className="absolute inset-0 z-10 overflow-y-auto bg-background">
        <div className="p-6">
          <MediaDetailView
            media={ws.detailMedia}
            seriesDetail={ws.seriesDetail}
            loading={ws.detailLoading}
            error={ws.detailError}
            onRetry={() => ws.detailMedia && void ws.openMediaDetail(ws.detailMedia)}
            playlist={ws.playlistOf(ws.detailMedia)}
            uiLanguage={ws.prefs.uiLanguage}
            theaterOpen={ws.theaterOpen}
            activeMedia={ws.activeMedia}
            onBack={ws.closeMediaDetail}
            onPlayInline={(item) => ws.playStream(item, false)}
            onPlayAt={(item, position, theater) => void ws.playAt(item, position, theater)}
            onStopPlayback={ws.stopPlayback}
            onOpenExternal={(player, item) => void ws.openExternal(player, item)}
            onPlayTheater={(item) => ws.playStream(item, true)}
            onToggleFavorite={ws.toggleFavorite}
            onDownload={ws.downloadMedia}
          />
        </div>
      </div>
    ) : null;

  const renderSection = () => {
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
            liveItems={ws.items}
            prefs={ws.prefs}
            onUpdatePrefs={ws.updatePrefs}
            onPlay={(item) => ws.playStream(item, false)}
            onNotify={ws.notify}
          />
        );

      case 'search':
        return (
          <GlobalSearchView
            query={ws.filters.search}
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
  };

  return (
    <PlayerHost
      media={ws.activeMedia}
      playlist={ws.playlistOf(ws.activeMedia)}
      playing={ws.isPlaying}
      onPlayingChange={ws.setIsPlaying}
      theaterOpen={ws.theaterOpen}
      onTheaterChange={ws.setTheaterOpen}
      onStop={ws.stopPlayback}
      onOpenExternal={(player, item, position) => void ws.openExternal(player, item, position)}
      nextEpisode={ws.nextEpisode}
      onPlayNext={ws.playNextEpisode}
    >
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
            if (ws.detailMedia) ws.closeMediaDetail();
            // Depuis l'Accueil, la recherche porte sur toutes les sources (page Recherche) ;
            // ailleurs elle reste attachée à la rubrique courante.
            if (ws.section === 'dashboard' && q.trim().length > 0) {
              ws.setSection('search');
              ws.updateFilters({ search: q }, 'search');
            } else {
              ws.updateFilters({ search: q });
            }
          }}
          syncLabel={ws.syncLabel}
          uiLanguage={ws.prefs.uiLanguage}
          onOpenAddSource={() => ws.setAddSourceOpen(true)}
        />

        <div className="relative min-h-0 flex-1">
          <main
            ref={mainRef}
            inert={Boolean(ws.detailMedia)}
            className="isolate h-full overflow-y-auto"
          >
            <Suspense fallback={null}>{renderSection()}</Suspense>
          </main>
          {renderDetail()}
        </div>
      </div>

      <ResumePromptModal prompt={ws.resumePrompt} onAnswer={ws.answerResumePrompt} />

      <SourceImportModal
        open={ws.addSourceOpen}
        onClose={() => ws.setAddSourceOpen(false)}
        addSource={ws.addSource}
      />

      {ws.toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-full border border-primary/40 bg-elevated px-4 py-2 text-xs font-semibold text-foreground shadow-2xl">
          {ws.toast}
        </div>
      ) : null}
    </div>
    </PlayerHost>
  );
}

export default App;
