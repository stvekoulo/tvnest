// Console OSD inférieure @beui du lecteur universel TVNest Cinema.
import {
  Circle,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  EmbeddedMpvAudioTrack,
  EmbeddedMpvStreamStats,
  EmbeddedMpvSubtitleTrack,
} from '@iptvnator/shared/interfaces';
import { ActionSwapIcon } from '@/components/motion/action-swap';
import type { PlayerEngineKind } from '@/hooks/use-tvnest-player';
import { cn } from '@/lib/utils';
import type { UnifiedMedia } from '@/types/iptv.types';
import { PlayerOsdHeader } from './player-osd-header';
import { formatPlayerTime, PlayerOsdTimeline } from './player-osd-timeline';
import { PlayerTrackPopover } from './player-track-popover';

export { formatPlayerTime };

interface PlayerOsdControlsProps {
  media: UnifiedMedia;
  docked?: boolean;
  visible: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  nextEpisodeTitle?: string;
  onNextEpisode?: () => void;
  engine: PlayerEngineKind;
  resolution: string | null;
  stats?: EmbeddedMpvStreamStats;
  showStats: boolean;
  onToggleStats: () => void;
  position: number;
  duration: number;
  onSeekTo: (sec: number) => void;
  onSeekBy: (delta: number) => void;
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  audioTracks: EmbeddedMpvAudioTrack[];
  selectedAudioId: number | null;
  onSelectAudio: (id: number) => void;
  subtitleTracks: EmbeddedMpvSubtitleTrack[];
  selectedSubtitleId: number | null;
  onSelectSubtitle: (id: number) => void;
  onImportSubtitle?: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  aspect: string;
  onAspectChange: (a: string) => void;
  mpvAvailable: boolean;
  forcedWeb: boolean;
  onToggleForcedWeb: (web: boolean) => void;
  recordingActive: boolean;
  onToggleRecording: () => void;
  onRequestPip?: () => void;
  onToggleFullscreen: () => void;
  isFullscreen?: boolean;
  onOpenExternal: (player: 'mpv' | 'vlc') => void;
  onClose?: () => void;
}

export function PlayerOsdControls(props: PlayerOsdControlsProps) {
  const {
    media,
    docked = false,
    visible,
    playing,
    onTogglePlay,
    nextEpisodeTitle,
    onNextEpisode,
    engine,
    position,
    duration,
    onSeekTo,
    onSeekBy,
    volume,
    muted,
    onVolumeChange,
    onToggleMute,
    recordingActive,
    onToggleRecording,
    onRequestPip,
    onToggleFullscreen,
    isFullscreen = false,
  } = props;

  const isLive = media.kind === 'live';
  const interactive = visible || docked;

  return (
    <div
      inert={!interactive ? true : undefined}
      className={cn(
        'pointer-events-none z-20 flex flex-col transition-opacity duration-300',
        docked ? 'relative shrink-0 bg-black' : 'absolute inset-0 justify-between',
        interactive ? 'opacity-100' : 'opacity-0'
      )}
    >
      <PlayerOsdHeader
        docked={docked}
        interactive={interactive}
        media={media}
        engine={engine}
        resolution={props.resolution}
        stats={props.stats}
        showStats={props.showStats}
        onToggleStats={props.onToggleStats}
        onOpenExternal={props.onOpenExternal}
        onClose={props.onClose}
      />

      <div
        className={cn(
          'px-5 pb-4',
          interactive ? 'pointer-events-auto' : 'pointer-events-none',
          docked ? 'pt-1' : 'bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-8'
        )}
      >
        <div className="rounded-2xl border border-white/15 bg-[#0A0A0A]/90 px-4 py-3 shadow-2xl backdrop-blur-2xl">
          {!isLive ? (
            <PlayerOsdTimeline
              position={position}
              duration={duration}
              onSeekTo={onSeekTo}
              onSeekBy={onSeekBy}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={playing ? 'Pause' : 'Lecture'}
                title={`${playing ? 'Pause' : 'Lecture'} (Espace)`}
                className="inline-flex size-9 items-center justify-center rounded-full bg-white text-black shadow-md shadow-black/40 transition-transform active:scale-95"
              >
                <ActionSwapIcon
                  value={playing ? 'pause' : 'play'}
                  className="size-4"
                >
                  {playing ? (
                    <Pause className="size-4 fill-current" />
                  ) : (
                    <Play className="ml-0.5 size-4 fill-current" />
                  )}
                </ActionSwapIcon>
              </button>

              {!isLive ? (
                <>
                  <button
                    type="button"
                    onClick={() => onSeekBy(-10)}
                    aria-label="Reculer de 10 secondes"
                    title="Reculer de 10 s (←, Maj+← : 60 s)"
                    className="inline-flex size-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSeekBy(10)}
                    aria-label="Avancer de 10 secondes"
                    title="Avancer de 10 s (→, Maj+→ : 60 s)"
                    className="inline-flex size-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
                  >
                    <RotateCw className="size-4" />
                  </button>
                </>
              ) : null}

              {onNextEpisode ? (
                <button
                  type="button"
                  onClick={onNextEpisode}
                  aria-label="Épisode suivant"
                  title={`Épisode suivant : ${nextEpisodeTitle ?? ''} (N)`}
                  className="inline-flex size-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  <SkipForward className="size-4" />
                </button>
              ) : null}

              <div className="ml-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={muted || volume === 0 ? 'Réactiver le son' : 'Couper le son'}
                  title="Muet (M)"
                  className="inline-flex size-8 items-center justify-center rounded-full text-zinc-200 hover:bg-white/10"
                >
                  <ActionSwapIcon
                    value={muted || volume === 0 ? 'muted' : 'loud'}
                    className="size-4"
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="size-4" />
                    ) : (
                      <Volume2 className="size-4" />
                    )}
                  </ActionSwapIcon>
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  aria-label="Volume"
                  title="Volume (↑ / ↓)"
                  className="h-1 w-20 cursor-pointer accent-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isLive && engine === 'libmpv' ? (
                <button
                  type="button"
                  onClick={onToggleRecording}
                  title="Enregistrer le direct"
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                    recordingActive
                      ? 'border-rose-500 bg-rose-600/30 text-rose-200'
                      : 'border-white/15 bg-white/10 text-zinc-200 hover:bg-white/20'
                  )}
                >
                  <Circle
                    className={cn(
                      'size-2.5 fill-current',
                      recordingActive
                        ? 'animate-pulse text-rose-400'
                        : 'text-rose-500'
                    )}
                  />
                  {recordingActive ? 'STOP REC' : 'REC'}
                </button>
              ) : null}

              <PlayerTrackPopover
                audioTracks={props.audioTracks}
                selectedAudioId={props.selectedAudioId}
                onSelectAudio={props.onSelectAudio}
                subtitleTracks={props.subtitleTracks}
                selectedSubtitleId={props.selectedSubtitleId}
                onSelectSubtitle={props.onSelectSubtitle}
                onImportSubtitle={
                  engine === 'libmpv' ? props.onImportSubtitle : undefined
                }
                speed={props.speed}
                onSpeedChange={props.onSpeedChange}
                aspect={props.aspect}
                onAspectChange={props.onAspectChange}
                mpvAvailable={props.mpvAvailable}
                forcedWeb={props.forcedWeb}
                onToggleForcedWeb={props.onToggleForcedWeb}
              />

              {onRequestPip && engine !== 'libmpv' ? (
                <button
                  type="button"
                  onClick={onRequestPip}
                  aria-label="Picture-in-Picture"
                  title="Picture-in-Picture"
                  className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-zinc-200 hover:bg-white/20"
                >
                  <PictureInPicture2 className="size-3.5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                title={isFullscreen ? 'Quitter le plein écran (F / Échap)' : 'Plein écran (F)'}
                className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-zinc-200 hover:bg-white/20"
              >
                {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
