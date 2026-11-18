// Sections Lecteur TVNest Cinema (libmpv + MPV/VLC) et Réseau/Contrôle Parental des Paramètres.
import { Cpu, FolderOpen, KeyRound, Shield, Tv } from 'lucide-react';
import { useState } from 'react';
import {
  ParentalLockModal,
  type ParentalPinModalMode,
} from '@/components/modals/parental-lock-modal';
import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import { Switch } from '@/components/motion/switch';
import { cn } from '@/lib/utils';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { AppPreferences } from '@/types/iptv.types';

interface SettingsPlayerNetworkProps {
  prefs: AppPreferences;
  mpvPath: string;
  onMpvPathChange: (v: string) => void;
  vlcPath: string;
  onVlcPathChange: (v: string) => void;
  userAgent: string;
  onUserAgentChange: (v: string) => void;
  onUpdatePrefs: (patch: Partial<AppPreferences>) => Promise<void>;
}

export function SettingsPlayerNetwork({
  prefs,
  mpvPath,
  onMpvPathChange,
  vlcPath,
  onVlcPathChange,
  userAgent,
  onUserAgentChange,
  onUpdatePrefs,
}: SettingsPlayerNetworkProps) {
  const [pinModal, setPinModal] = useState<ParentalPinModalMode | null>(null);
  const canBrowseExe =
    isElectronRuntime() && Boolean(window.electron.selectExternalPlayerExecutable);

  const handleBrowsePlayer = async (player: 'mpv' | 'vlc') => {
    const selected = await window.electron.selectExternalPlayerExecutable?.(player);
    if (!selected) return;
    if (player === 'mpv') {
      onMpvPathChange(selected);
      await onUpdatePrefs({ mpvPlayerPath: selected });
    } else {
      onVlcPathChange(selected);
      await onUpdatePrefs({ vlcPlayerPath: selected });
    }
  };

  const handleParentalToggle = (wantEnabled: boolean) => {
    if (wantEnabled) {
      if (!prefs.parentalPinHash) {
        setPinModal('setup');
        return;
      }
      void onUpdatePrefs({ parentalLockEnabled: true });
      return;
    }
    if (prefs.parentalPinHash) {
      setPinModal('unlock');
    } else {
      void onUpdatePrefs({ parentalLockEnabled: false });
    }
  };

  return (
    <>
      <section className="space-y-4 rounded-[26px] border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Tv className="size-4 text-primary" />
          Lecteur TVNest Cinema & Décodeurs
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'builtin', label: 'TVNest Cinema' },
              { id: 'mpv', label: 'MPV Externe' },
              { id: 'vlc', label: 'VLC Externe' },
            ] as const
          ).map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => onUpdatePrefs({ defaultPlayer: pl.id })}
              className={cn(
                'rounded-2xl border py-2.5 text-xs font-bold transition-all',
                prefs.defaultPlayer === pl.id
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-elevated text-muted-foreground hover:text-foreground'
              )}
            >
              {pl.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-elevated px-4 py-3">
          <div className="pr-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Cpu className="size-3.5 text-primary" /> Moteur natif libmpv intégré
            </p>
            <p className="text-[11px] text-muted-foreground">
              Décodage matériel MKV, HEVC/H.265, AC3/EAC3/DTS et pistes multi-audio
            </p>
          </div>
          <Switch
            checked={prefs.embeddedMpvEnabled}
            onCheckedChange={(v) => onUpdatePrefs({ embeddedMpvEnabled: v })}
            ariaLabel="Moteur libmpv intégré"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label="Chemin exécutable MPV externe (optionnel)"
                value={mpvPath}
                onChange={onMpvPathChange}
                placeholder="C:\Program Files\mpv\mpv.exe"
              />
            </div>
            {canBrowseExe ? (
              <Button
                type="button"
                size="md"
                variant="secondary"
                onClick={() => void handleBrowsePlayer('mpv')}
              >
                <FolderOpen className="size-3.5" /> Parcourir
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label="Chemin exécutable VLC externe (optionnel)"
                value={vlcPath}
                onChange={onVlcPathChange}
                placeholder="C:\Program Files\VideoLAN\VLC\vlc.exe"
              />
            </div>
            {canBrowseExe ? (
              <Button
                type="button"
                size="md"
                variant="secondary"
                onClick={() => void handleBrowsePlayer('vlc')}
              >
                <FolderOpen className="size-3.5" /> Parcourir
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[26px] border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Shield className="size-4 text-primary" />
          Réseau, Lecture & Contrôle Parental
        </div>

        <Input
          label="HTTP User-Agent personnalisé"
          value={userAgent}
          onChange={onUserAgentChange}
          placeholder="VLC/3.0.20 LibVLC/3.0.20"
        />

        <div className="flex items-center justify-between rounded-2xl border border-border bg-elevated px-4 py-3">
          <div>
            <p className="text-xs font-bold text-foreground">Lecture automatique des flux</p>
            <p className="text-[11px] text-muted-foreground">
              Démarre immédiatement le flux dès la sélection
            </p>
          </div>
          <Switch
            checked={prefs.autoplay}
            onCheckedChange={(v) => onUpdatePrefs({ autoplay: v })}
            ariaLabel="Lecture automatique"
          />
        </div>

        <div className="space-y-2.5 rounded-2xl border border-border bg-elevated px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Contrôle parental par code PIN</p>
              <p className="text-[11px] text-muted-foreground">
                Masque les groupes adultes et les catégories verrouillées dans tout le catalogue
              </p>
            </div>
            <Switch
              checked={prefs.parentalLockEnabled}
              onCheckedChange={handleParentalToggle}
              ariaLabel="Contrôle parental"
            />
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <span className="text-[11px] text-muted-foreground">
              {prefs.parentalPinHash ? 'Code PIN à 4 chiffres configuré' : 'Aucun code PIN défini'}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setPinModal(prefs.parentalPinHash ? 'change' : 'setup')}
            >
              <KeyRound className="size-3.5" />
              {prefs.parentalPinHash ? 'Modifier le PIN' : 'Créer un PIN'}
            </Button>
          </div>
        </div>
      </section>

      <ParentalLockModal
        mode={pinModal}
        expectedPinHash={prefs.parentalPinHash}
        onClose={() => setPinModal(null)}
        onComplete={async ({ enabled, pinHash }) => {
          await onUpdatePrefs({
            parentalLockEnabled: enabled,
            ...(pinHash ? { parentalPinHash: pinHash } : {}),
          });
        }}
      />
    </>
  );
}
