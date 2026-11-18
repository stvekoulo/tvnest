// Surface vidéo universelle TVNest Cinema (libmpv WebGL2 / HWND + HLS.js + MPEG-TS).
import { Cpu, ExternalLink, RotateCw, Tv } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/motion/button/base';
import { Loader } from '@/components/motion/loader';
import { useTvNestPlayer } from '@/hooks/use-tvnest-player';
import { cn } from '@/lib/utils';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';
import { NextEpisodeCard, nextEpisodeLeadSeconds } from './next-episode-card';
import { PlayerOsdControls } from './player-osd-controls';
import { usePlayerShortcuts } from './use-player-shortcuts';

export const PLAYER_MOVED_EVENT = 'tvnest:player-moved';

interface StreamSurfaceProps {
  media: UnifiedMedia;
  playlist?: UnifiedPlaylist | null;
  playing: boolean;
  onPlayingChange: (v: boolean) => void;
  compact?: boolean;
  preferWebEngine?: boolean;
  onExpandTheater?: () => void;
  onCloseTheater?: () => void;
  onStop?: () => void;
  onOpenExternal?: (player: 'mpv' | 'vlc', positionSeconds: number) => void;
  nextEpisode?: UnifiedMedia | null;
  onPlayNext?: () => void;
}

export function StreamSurface({
  media,
  playlist,
  playing,
  onPlayingChange,
  compact = false,
  preferWebEngine = false,
  onExpandTheater,
  onCloseTheater,
  onStop,
  onOpenExternal,
  nextEpisode,
  onPlayNext,
}: StreamSurfaceProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [osdVisible, setOsdVisible] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [startedCompact] = useState(compact);
  const autoMutedRef = useRef(startedCompact);

  const player = useTvNestPlayer({
    media,
    playlist,
    playing,
    onPlayingChange,
    hostRef,
    videoRef,
    preferWebEngine,
    avoidNativeView: compact,
    initialMuted: startedCompact,
  });

  useEffect(() => {
    if (compact || !autoMutedRef.current) return;
    autoMutedRef.current = false;
    if (player.muted) player.toggleMute();
  }, [compact, player]);

  useEffect(() => {
    const onMoved = () => {
      const v = videoRef.current;
      if (playing && v && v.paused && player.engine !== 'libmpv') v.play().catch(() => {});
    };
    window.addEventListener(PLAYER_MOVED_EVENT, onMoved);
    return () => window.removeEventListener(PLAYER_MOVED_EVENT, onMoved);
  }, [playing, player.engine]);

  const [nextDismissedFor, setNextDismissedFor] = useState<string | null>(null);
  const showNextEpisode =
    !compact &&
    Boolean(nextEpisode && onPlayNext) &&
    player.duration > 0 &&
    player.duration - player.position <= nextEpisodeLeadSeconds(player.duration) &&
    nextDismissedFor !== media.id;

  const nativeDocked = !compact && player.engine === 'libmpv' && player.mpvMode === 'native';

  const revealOsd = useCallback(() => {
    setOsdVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (playing && !compact) {
      hideTimerRef.current = window.setTimeout(() => setOsdVisible(false), 3200);
    }
  }, [playing, compact]);

  useEffect(() => {
    revealOsd();
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [revealOsd]);

  const toggleFullscreen = useCallback(() => {
    if (onExpandTheater) onExpandTheater();
    else onCloseTheater?.();
  }, [onExpandTheater, onCloseTheater]);

  usePlayerShortcuts({
    compact,
    mediaKind: media.kind,
    playing,
    duration: player.duration,
    onPlayingChange,
    seekBy: player.seekBy,
    seekTo: player.seekTo,
    changeVolumeBy: player.changeVolumeBy,
    toggleMute: player.toggleMute,
    toggleFullscreen,
    onCloseTheater,
    revealOsd,
    nextEpisode,
    onPlayNext,
  });

  const aspectClass =
    player.aspect === '16:9'
      ? 'aspect-video object-fill'
      : player.aspect === '21:9'
        ? 'aspect-[21/9] object-fill'
        : player.aspect === '4:3'
          ? 'aspect-[4/3] object-fill'
          : 'h-full w-full object-contain';

  return (
    <div
      ref={stageRef}
      onMouseMove={revealOsd}
      onDoubleClick={toggleFullscreen}
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden bg-black select-none',
        !compact && playing && !osdVisible && 'cursor-none'
      )}
    >
      <div ref={hostRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        {player.engine === 'libmpv' && player.mpvMode === 'frame-copy' ? (
          <canvas
            data-embedded-mpv-frame=""
            onClick={() => !compact && onPlayingChange(!playing)}
            className={cn('max-h-full max-w-full bg-black', aspectClass)}
          />
        ) : null}

        <video
          ref={videoRef}
          poster={media.backdropUrl || media.posterUrl}
          muted={player.muted}
          playsInline
          onClick={() => !compact && onPlayingChange(!playing)}
          onPlaying={() => {
            player.setBuffering(false);
            player.setError(null);
          }}
          onWaiting={() => player.setBuffering(true)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) player.setResolution(`${v.videoWidth}×${v.videoHeight}`);
            if (Number.isFinite(v.duration)) player.setDuration(v.duration);
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            player.setPosition(v.currentTime);
            if (v.duration && Number.isFinite(v.duration)) player.setDuration(v.duration);
          }}
          onError={() => {
            if (player.engine !== 'libmpv') {
              player.setBuffering(false);
              player.setError(
                player.mpvAvailable
                  ? 'Codec natif requis : basculez sur libmpv ou lancez MPV.'
                  : 'Flux réservé au décodeur natif MPV / VLC.'
              );
            }
          }}
          className={cn('max-h-full max-w-full', aspectClass, player.engine === 'libmpv' && 'hidden')}
        />

        {player.buffering && !player.error ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/35">
            <Loader variant="comet" size={compact ? 28 : 40} className="text-white" />
            {player.reconnectAttempt ? (
              <span className="rounded-full bg-black/75 px-3 py-1 text-[11px] font-medium text-zinc-200">
                Reconnexion au flux ({player.reconnectAttempt})...
              </span>
            ) : null}
          </div>
        ) : null}

        {showStats && !compact ? (
          <div className="pointer-events-none absolute left-5 top-16 z-30 w-64 space-y-1 rounded-2xl border border-white/15 bg-black/85 p-3 font-mono text-[11px] text-zinc-200 backdrop-blur-xl">
            <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-white">
              Diagnostics Flux · {player.engine.toUpperCase()}
            </p>
            <p>Résolution : {player.resolution || 'Auto'}</p>
            {player.stats?.videoCodec ? <p>Codec vidéo : {player.stats.videoCodec}</p> : null}
            {player.stats?.audioCodec ? (
              <p>Audio : {player.stats.audioCodec} {player.stats.audioChannels ? `(${player.stats.audioChannels})` : ''}</p>
            ) : null}
            {player.stats?.fps ? <p>Cadence : {player.stats.fps.toFixed(1)} fps</p> : null}
            {player.stats?.bufferedAheadSeconds !== undefined ? (
              <p>Tampon : {player.stats.bufferedAheadSeconds.toFixed(1)} s</p>
            ) : null}
          </div>
        ) : null}

        {player.error ? (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-5 text-center">
            <p className="max-w-md text-xs font-medium text-zinc-200">{player.error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="primary" onClick={player.retry}>
                <RotateCw className="size-3.5" /> Réessayer
              </Button>
              {player.mpvAvailable && player.forcedWeb ? (
                <Button size="sm" variant="primary" onClick={() => player.setForcedWeb(false)}>
                  <Cpu className="size-3.5" /> Activer libmpv intégré
                </Button>
              ) : null}
              {isElectronRuntime() ? (
                <>
                  <Button size="sm" variant="glass" onClick={() => onOpenExternal?.('mpv', player.position)}>
                    <Tv className="size-3.5" /> Ouvrir dans MPV
                  </Button>
                  <Button size="sm" variant="glass" onClick={() => onOpenExternal?.('vlc', player.position)}>
                    <ExternalLink className="size-3.5" /> Ouvrir dans VLC
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {showNextEpisode && nextEpisode && onPlayNext ? (
        <NextEpisodeCard
          key={media.id}
          next={nextEpisode}
          paused={!playing}
          onPlayNext={onPlayNext}
          onDismiss={() => setNextDismissedFor(media.id)}
        />
      ) : null}

      {compact ? null : (
        <PlayerOsdControls
          media={media}
          docked={nativeDocked}
          visible={nativeDocked || osdVisible || !playing}
          playing={playing}
          onTogglePlay={() => onPlayingChange(!playing)}
          nextEpisodeTitle={nextEpisode?.title}
          onNextEpisode={nextEpisode && onPlayNext ? onPlayNext : undefined}
          engine={player.engine}
          resolution={player.resolution}
          stats={player.stats}
          showStats={showStats}
          onToggleStats={() => setShowStats((s) => !s)}
          position={player.position}
          duration={player.duration}
          onSeekTo={player.seekTo}
          onSeekBy={player.seekBy}
          volume={player.volume}
          muted={player.muted}
          onVolumeChange={player.setVolume}
          onToggleMute={player.toggleMute}
          audioTracks={player.audioTracks}
          selectedAudioId={player.selectedAudioId}
          onSelectAudio={player.selectAudioTrack}
          subtitleTracks={player.subtitleTracks}
          selectedSubtitleId={player.selectedSubtitleId}
          onSelectSubtitle={player.selectSubtitleTrack}
          onImportSubtitle={player.importSubtitleFile}
          speed={player.speed}
          onSpeedChange={player.setSpeed}
          aspect={player.aspect}
          onAspectChange={player.setAspect}
          mpvAvailable={player.mpvAvailable}
          forcedWeb={player.forcedWeb}
          onToggleForcedWeb={player.setForcedWeb}
          recordingActive={player.recordingActive}
          onToggleRecording={player.toggleRecording}
          onRequestPip={() => videoRef.current?.requestPictureInPicture?.().catch(() => {})}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={!onExpandTheater}
          onOpenExternal={(p) => onOpenExternal?.(p, player.position)}
          onClose={onStop}
        />
      )}
    </div>
  );
}
