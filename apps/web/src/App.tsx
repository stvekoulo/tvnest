// Coque principale TVNest Desktop (Noir Absolu OLED, fiche dédiée plein écran et libmpv).
import { Suspense, useEffect, useRef } from 'react';
import { ResumePromptModal } from '@/components/modals/resume-prompt-modal';
import { SourceImportModal } from '@/components/modals/source-import-modal';
import { PlayerHost } from '@/components/player/player-host';
import { UnifiedSidebar } from '@/components/shell/unified-sidebar';
import { WindowTitlebar } from '@/components/shell/window-titlebar';
import { WorkspaceSectionView } from '@/components/shell/workspace-section-view';
import { MediaDetailView } from '@/components/views/media-detail-view';
import { useAppUpdate } from '@/hooks/use-app-update';
import { useIptvWorkspace } from '@/hooks/use-iptv-workspace';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useSourceAutoRefresh } from '@/hooks/use-source-auto-refresh';
import { toggleAppFullscreen } from '@/lib/app-fullscreen';

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F11') return;
      e.preventDefault();
      void toggleAppFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const narrowWindow = useMediaQuery('(max-width: 1023px)');

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [ws.section]);

  const suppressPreviewPlayer = Boolean(ws.detailMedia);

  return (
    <PlayerHost
      media={ws.activeMedia}
      playlist={ws.playlistOf(ws.activeMedia)}
      playing={ws.isPlaying}
      onPlayingChange={ws.setIsPlaying}
      embeddedMpvEnabled={ws.prefs.embeddedMpvEnabled}
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
          collapsed={ws.sidebarCollapsed || narrowWindow}
          onToggleCollapsed={narrowWindow ? undefined : () => ws.setSidebarCollapsed((c) => !c)}
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
              if (ws.section === 'dashboard' && q.trim().length > 0) {
                ws.setSection('search');
                ws.updateFilters({ search: q }, 'search');
              } else {
                ws.updateFilters({ search: q });
                const typing = document.activeElement instanceof HTMLInputElement;
                if (ws.section === 'search' && !q.trim() && !typing) ws.setSection('dashboard');
              }
            }}
            onSearchBlur={() => {
              if (ws.section === 'search' && !ws.filters.search.trim()) ws.setSection('dashboard');
            }}
            onOpenMobileSearch={() => {
              if (ws.detailMedia) ws.closeMediaDetail();
              ws.setSection('search');
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
              <Suspense fallback={null}>
                <WorkspaceSectionView
                  ws={ws}
                  appUpdate={appUpdate}
                  suppressPreviewPlayer={suppressPreviewPlayer}
                />
              </Suspense>
            </main>

            {ws.detailMedia ? (
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
            ) : null}
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
