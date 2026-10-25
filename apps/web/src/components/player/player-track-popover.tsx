// Menu contextuel des pistes audio, sous-titres, vitesse et format du lecteur TVNest.
import { Check, Cpu, FilePlus2, Gauge, Languages, Subtitles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { EmbeddedMpvAudioTrack, EmbeddedMpvSubtitleTrack } from '@iptvnator/shared/interfaces';
import { SPRING_PANEL } from '@/lib/ease';
import { cn } from '@/lib/utils';

interface PlayerTrackPopoverProps {
  audioTracks: EmbeddedMpvAudioTrack[];
  selectedAudioId: number | null;
  onSelectAudio: (id: number) => void;
  subtitleTracks: EmbeddedMpvSubtitleTrack[];
  selectedSubtitleId: number | null;
  onSelectSubtitle: (id: number) => void;
  onImportSubtitle?: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  aspect: string;
  onAspectChange: (aspect: string) => void;
  mpvAvailable: boolean;
  forcedWeb: boolean;
  onToggleForcedWeb: (web: boolean) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const ASPECTS = [
  { id: 'auto', label: 'Auto' },
  { id: '16:9', label: '16:9' },
  { id: '21:9', label: '21:9' },
  { id: '4:3', label: '4:3' },
];

export function PlayerTrackPopover({
  audioTracks,
  selectedAudioId,
  onSelectAudio,
  subtitleTracks,
  selectedSubtitleId,
  onSelectSubtitle,
  onImportSubtitle,
  speed,
  onSpeedChange,
  aspect,
  onAspectChange,
  mpvAvailable,
  forcedWeb,
  onToggleForcedWeb,
}: PlayerTrackPopoverProps) {
  const [openMenu, setOpenMenu] = useState<'tracks' | 'settings' | null>(null);

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpenMenu((prev) => (prev === 'tracks' ? null : 'tracks'))}
        title="Pistes audio & sous-titres"
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
          openMenu === 'tracks'
            ? 'border-white/40 bg-white/25 text-white'
            : 'border-white/15 bg-white/10 text-zinc-200 hover:bg-white/20'
        )}
      >
        <Languages className="size-3.5" /> <span>Audio / ST</span>
      </button>

      <button
        type="button"
        onClick={() => setOpenMenu((prev) => (prev === 'settings' ? null : 'settings'))}
        title="Vitesse, ratio & moteur"
        className={cn(
          'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
          openMenu === 'settings'
            ? 'border-white/40 bg-white/25 text-white'
            : 'border-white/15 bg-white/10 text-zinc-200 hover:bg-white/20'
        )}
      >
        <Gauge className="size-3.5" /> <span>{speed}x</span>
      </button>

      <AnimatePresence>
        {openMenu === 'tracks' ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={SPRING_PANEL}
            data-tvnest-overlay=""
            className="absolute bottom-11 right-0 z-50 w-72 rounded-2xl border border-white/15 bg-[#0A0A0A]/95 p-3 text-xs text-zinc-100 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <Languages className="size-3.5 text-white" /> Pistes Audio ({audioTracks.length})
            </div>
            <div className="mb-3 max-h-28 space-y-1 overflow-y-auto scrollbar-thin">
              {audioTracks.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-zinc-500">Piste audio par défaut active</p>
              ) : (
                audioTracks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectAudio(t.id);
                      setOpenMenu(null);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px]',
                      selectedAudioId === t.id || t.selected
                        ? 'bg-white/20 font-semibold text-white'
                        : 'text-zinc-300 hover:bg-white/10'
                    )}
                  >
                    <span className="truncate">
                      {t.title || `Piste #${t.id}`}
                      {t.language ? ` · ${t.language.toUpperCase()}` : ''}
                    </span>
                    {selectedAudioId === t.id || t.selected ? (
                      <Check className="size-3.5 text-white" />
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Subtitles className="size-3.5 text-white" /> Sous-titres ({subtitleTracks.length})
              </span>
              {onImportSubtitle ? (
                <button
                  type="button"
                  onClick={() => {
                    onImportSubtitle();
                    setOpenMenu(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200 hover:bg-white/20"
                >
                  <FilePlus2 className="size-3" /> .SRT / .ASS
                </button>
              ) : null}
            </div>
            <div className="max-h-28 space-y-1 overflow-y-auto scrollbar-thin">
              <button
                type="button"
                onClick={() => {
                  onSelectSubtitle(0);
                  setOpenMenu(null);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px]',
                  !selectedSubtitleId
                    ? 'bg-white/20 font-semibold text-white'
                    : 'text-zinc-300 hover:bg-white/10'
                )}
              >
                <span>Désactivés</span>
                {!selectedSubtitleId ? <Check className="size-3.5 text-white" /> : null}
              </button>
              {subtitleTracks.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    onSelectSubtitle(st.id);
                    setOpenMenu(null);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px]',
                    selectedSubtitleId === st.id || st.selected
                      ? 'bg-white/20 font-semibold text-white'
                      : 'text-zinc-300 hover:bg-white/10'
                  )}
                >
                  <span className="truncate">
                    {st.title || `Sous-titre #${st.id}`}
                    {st.language ? ` · ${st.language.toUpperCase()}` : ''}
                  </span>
                  {selectedSubtitleId === st.id || st.selected ? (
                    <Check className="size-3.5 text-white" />
                  ) : null}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}

        {openMenu === 'settings' ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={SPRING_PANEL}
            data-tvnest-overlay=""
            className="absolute bottom-11 right-0 z-50 w-64 space-y-3 rounded-2xl border border-white/15 bg-[#0A0A0A]/95 p-3 text-xs text-zinc-100 shadow-2xl backdrop-blur-2xl"
          >
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Vitesse de lecture
              </p>
              <div className="grid grid-cols-5 gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSpeedChange(s)}
                    className={cn(
                      'rounded-lg py-1 text-[11px] font-semibold transition-colors',
                      speed === s ? 'bg-white text-black' : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Format d’image
              </p>
              <div className="grid grid-cols-4 gap-1">
                {ASPECTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAspectChange(a.id)}
                    className={cn(
                      'rounded-lg py-1 text-[11px] font-semibold transition-colors',
                      aspect === a.id ? 'bg-white text-black' : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {mpvAvailable ? (
              <div className="border-t border-white/10 pt-2">
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <Cpu className="size-3 text-white" /> Moteur de décodage
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleForcedWeb(false);
                      setOpenMenu(null);
                    }}
                    className={cn(
                      'rounded-lg py-1.5 text-[11px] font-semibold',
                      !forcedWeb ? 'bg-white text-black' : 'bg-white/10 text-zinc-300'
                    )}
                  >
                    libmpv Natif
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleForcedWeb(true);
                      setOpenMenu(null);
                    }}
                    className={cn(
                      'rounded-lg py-1.5 text-[11px] font-semibold',
                      forcedWeb ? 'bg-white text-black' : 'bg-white/10 text-zinc-300'
                    )}
                  >
                    Web HLS/TS
                  </button>
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
