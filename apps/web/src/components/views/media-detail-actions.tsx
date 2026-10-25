// Barre d'actions @beui de la fiche détaillée Film / Série (lecture, favori, MPV/VLC, téléchargement).
import { Download, ExternalLink, Heart, Maximize2, Play, Tv } from 'lucide-react';
import { useState } from 'react';
import { ActionSwapButton } from '@/components/motion/action-swap';
import { Button, StatefulButton, type ButtonState } from '@/components/motion/button';
import { t, type UiLanguage } from '@/lib/i18n';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import { launchExternalPlayer } from '@/services/ipc-system.service';
import type { UnifiedMedia, UnifiedPlaylist } from '@/types/iptv.types';

interface MediaDetailActionsProps {
  media: UnifiedMedia;
  playlist?: UnifiedPlaylist | null;
  uiLanguage: UiLanguage;
  resumeLabel: string;
  onPlayInline: () => void;
  onPlayTheater: () => void;
  onToggleFavorite: () => void;
  onDownload: () => Promise<void>;
}

export function MediaDetailActions({
  media,
  playlist,
  uiLanguage,
  resumeLabel,
  onPlayInline,
  onPlayTheater,
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
        {resumeLabel
          ? `${t(uiLanguage, 'resumeWatch')} (${resumeLabel})`
          : 'Lire dans TVNest Cinema'}
      </Button>

      <Button size="lg" variant="secondary" onClick={onPlayTheater}>
        <Maximize2 className="size-4" />
        Plein écran Cinéma
      </Button>

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
            icon: <Heart className="size-4 fill-current text-foreground" />,
          },
        ]}
      />

      {isElectronRuntime() && media.kind !== 'series' ? (
        <>
          <Button
            size="md"
            variant="outline"
            onClick={() => launchExternalPlayer('mpv', media, playlist)}
          >
            <Tv className="size-3.5" /> MPV
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={() => launchExternalPlayer('vlc', media, playlist)}
          >
            <ExternalLink className="size-3.5" /> VLC
          </Button>
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
        </>
      ) : null}
    </div>
  );
}
