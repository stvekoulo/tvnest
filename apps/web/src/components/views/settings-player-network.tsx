// Sections Lecteur TVNest Cinema (libmpv + MPV/VLC) et Réseau/Contrôle Parental des Paramètres.
import { Cpu, Shield, Tv } from 'lucide-react';
import { Input } from '@/components/motion/input';
import { Switch } from '@/components/motion/switch';
import { cn } from '@/lib/utils';
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

        <Input
          label="Chemin exécutable MPV externe (optionnel)"
          value={mpvPath}
          onChange={onMpvPathChange}
          placeholder="C:\Program Files\mpv\mpv.exe"
        />

        <Input
          label="Chemin exécutable VLC externe (optionnel)"
          value={vlcPath}
          onChange={onVlcPathChange}
          placeholder="C:\Program Files\VideoLAN\VLC\vlc.exe"
        />
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

        <div className="flex items-center justify-between rounded-2xl border border-border bg-elevated px-4 py-3">
          <div>
            <p className="text-xs font-bold text-foreground">Verrouillage Parental SQLite</p>
            <p className="text-[11px] text-muted-foreground">
              Masque les catégories adultes/verrouillées dans SQLite
            </p>
          </div>
          <Switch
            checked={prefs.parentalLockEnabled}
            onCheckedChange={(v) => onUpdatePrefs({ parentalLockEnabled: v })}
            ariaLabel="Contrôle parental"
          />
        </div>
      </section>
    </>
  );
}
