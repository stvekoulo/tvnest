// Choix « Reprendre / Recommencer » pour un film ou un épisode déjà entamé.
import { Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { Button } from '@/components/motion/button/base';
import type { ResumePrompt } from '@/hooks/use-iptv-workspace';
import { formatClock } from '@/lib/resume-point';

interface ResumePromptModalProps {
  prompt: ResumePrompt | null;
  onAnswer: (choice: 'resume' | 'restart' | 'cancel') => void;
}

export function ResumePromptModal({ prompt, onAnswer }: ResumePromptModalProps) {
  const resumeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!prompt) return;
    resumeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onAnswer('cancel');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, onAnswer]);

  if (!prompt) return null;
  const { item, positionSeconds, durationSeconds } = prompt;
  const progress = durationSeconds ? Math.min(100, (positionSeconds / durationSeconds) * 100) : null;

  return (
    <div
      data-tvnest-overlay=""
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => onAnswer('cancel')}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-prompt-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
      >
        <div className="relative aspect-video w-full bg-black">
          <MediaArtwork
            src={item.backdropUrl || item.posterUrl}
            title={item.title}
            kind={item.kind}
            className="h-full w-full opacity-70"
          />
          {progress !== null ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div className="h-full bg-white" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
        </div>
        <div className="space-y-4 p-6">
          <div>
            <h2 id="resume-prompt-title" className="line-clamp-2 font-display text-lg font-bold text-foreground">
              {item.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Vous vous êtes arrêté à {formatClock(positionSeconds)}
              {durationSeconds ? ` sur ${formatClock(durationSeconds)}` : ''}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button ref={resumeRef} variant="primary" className="flex-1" onClick={() => onAnswer('resume')}>
              <Play className="size-3.5 fill-current" /> Reprendre à {formatClock(positionSeconds)}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => onAnswer('restart')}>
              <RotateCcw className="size-3.5" /> Recommencer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
