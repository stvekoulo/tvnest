// Barre d'actions @beui de la fiche détaillée Film / Série (lecture, favori, bande-annonce, MPV/VLC, téléchargement).
import { Clapperboard, Download, ExternalLink, Heart, Maximize2, Play, RotateCcw, Tv } from 'lucide-react';
import { useState } from 'react';
import { ActionSwapButton } from '@/components/motion/action-swap';
import { Button, StatefulButton, type ButtonState } from '@/components/motion/button';
import { t, type UiLanguage } from '@/lib/i18n';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { UnifiedMedia } from '@/types/iptv.types';

interface MediaDetailActionsProps {
  media: UnifiedMedia;
  uiLanguage: UiLanguage;
  resumeLabel: string;
  canOpenExternal: boolean;
  onPlayInline: () => void;
  onRestart?: () => void;
  onOpenExternal: (player: 'mpv' | 'vlc') => void;
  onPlayTheater: () => void;
  onOpenTrailer?: () => void;
  onToggleFavorite: () => void;
  onDownload: () => Promise<void>;
}

export function MediaDetailActions({
  media,
  uiLanguage,
  resumeLabel,
  canOpenExternal,
  onPlayInline,
  onRestart,
  onOpenExternal,
  onPlayTheater,
  onOpenTrailer,
  onToggleFavorite,
  onDownload,
}: MediaDetailActionsProps) {
  const [dlState, setDlState] = useState<ButtonState>('idle');

  const handleDownload = async () => {
    setDlState('loading');
    try {
      await onDownload();
      setDlState('success');
      setTimeout(() => setDlState('idle'), 2200);
    } catch {
      setDlState('error');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 pt-1">
      <Button size="lg" variant="primary" ripple onClick={onPlayInline}>
        <Play className="size-4 fill-current" />
        {resumeLabel ? `${t(uiLanguage, 'resumeWatch')} · ${resumeLabel}` : 'Lire dans TVNest Cinema'}
      </Button>

      {onRestart ? (
        <Button size="lg" variant="secondary" onClick={onRestart}>
          <RotateCcw className="size-4" />
          Recommencer
        </Button>
      ) : null}

      <Button size="lg" variant="secondary" onClick={onPlayTheater}>
        <Maximize2 className="size-4" />
        Plein écran Cinéma
      </Button>

      {onOpenTrailer ? (
        <Button size="md" variant="secondary" onClick={onOpenTrailer}>
          <Clapperboard className="size-4" />
          Bande-annonce
        </Button>
      ) : null}

      <ActionSwapButton
        size="md"
        variant="secondary"
        value={media.isFavorite ? 'fav' : 'idle'}
        onValueChange={onToggleFavorite}
        items={[
          { id: 'idle', label: 'Ajouter aux favoris', icon: <Heart className="size-4" /> },
          {
            id: 'fav',
            label: 'Dans vos favoris',
            icon: <Heart className="size-4 fill-rose-500 text-rose-500" />,
          },
        ]}
      />

      {isElectronRuntime() && canOpenExternal ? (
        <>
          <Button size="md" variant="outline" onClick={() => onOpenExternal('mpv')}>
            <Tv className="size-3.5" /> MPV
          </Button>
          <Button size="md" variant="outline" onClick={() => onOpenExternal('vlc')}>
            <ExternalLink className="size-3.5" /> VLC
          </Button>
        </>
      ) : null}

      {isElectronRuntime() && media.kind !== 'series' ? (
        <StatefulButton
          size="md"
          variant="secondary"
          state={dlState}
          loadingText="Envoi..."
          successText="Ajouté"
          icon={<Download className="size-3.5" />}
          onClick={handleDownload}
        >
          Télécharger
        </StatefulButton>
      ) : null}
    </div>
  );
}
