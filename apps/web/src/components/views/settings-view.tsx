// Paramètres système TVNest : Thème OLED, Langues par défaut, libmpv intégré, Réseau et SQLite.
import { Database, Globe, Moon, Save, Smartphone, Sun, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, StatefulButton, type ButtonState } from '@/components/motion/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import { Switch } from '@/components/motion/switch';
import { TvNestLogo } from '@/components/shell/tvnest-logo';
import { SettingsPlayerNetwork } from '@/components/views/settings-player-network';
import { SettingsUpdateCard } from '@/components/views/settings-update-card';
import type { AppUpdateState } from '@/hooks/use-app-update';
import {
  CONTENT_LANGUAGES,
  type ContentLanguageCode,
  INTERFACE_LANGUAGES,
  type UiLanguage,
} from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { AppPreferences } from '@/types/iptv.types';

const SOURCE_REFRESH_OPTIONS = [
  { value: '0', label: 'Désactivée' },
  { value: '1', label: 'Tous les jours' },
  ...[2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: `Tous les ${d} jours` })),
];

interface SettingsViewProps {
  appUpdate: AppUpdateState;
  prefs: AppPreferences;
  onUpdatePrefs: (patch: Partial<AppPreferences>) => Promise<void>;
  onNotify: (msg: string) => void;
}

export function SettingsView({ appUpdate, prefs, onUpdatePrefs, onNotify }: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [mpvPath, setMpvPath] = useState(prefs.mpvPlayerPath);
  const [vlcPath, setVlcPath] = useState(prefs.vlcPlayerPath);
  const [userAgent, setUserAgent] = useState(prefs.userAgent);
  const [saveState, setSaveState] = useState<ButtonState>('idle');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [tmdbCount, setTmdbCount] = useState<number>(0);

  useEffect(() => {
    if (!isElectronRuntime()) return;
    window.electron.getAppVersion().then(setAppVersion).catch(() => {});
    window.electron.getLocalIpAddresses().then(setLocalIps).catch(() => {});
    window.electron
      .dbGetTmdbCacheStats()
      .then((s) => setTmdbCount((s as { count?: number })?.count || 0))
      .catch(() => {});
  }, []);

  const handleSavePaths = async () => {
    setSaveState('loading');
    await onUpdatePrefs({
      mpvPlayerPath: mpvPath.trim(),
      vlcPlayerPath: vlcPath.trim(),
      userAgent: userAgent.trim(),
    });
    setSaveState('success');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  const handleClearTmdb = async () => {
    if (!isElectronRuntime()) return;
    const res = await window.electron.dbClearTmdbMetadata();
    setTmdbCount(0);
    onNotify(`Cache TMDB vidé (${res.deleted} entrées supprimées)`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <TvNestLogo size="lg" />
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-0.5 text-[11px] font-medium text-primary">
              TVNest v{appVersion} · libmpv + SQLite
            </span>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-foreground">
              Paramètres de l’Application
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Apparence OLED, langues préférées par défaut, moteur vidéo universel et réseau.
            </p>
          </div>
        </div>

        <StatefulButton
          size="lg"
          variant="primary"
          state={saveState}
          loadingText="Enregistrement..."
          successText="Enregistré"
          icon={<Save className="size-4" />}
          onClick={handleSavePaths}
        >
          Enregistrer
        </StatefulButton>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-[26px] border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Globe className="size-4 text-primary" />
            Apparence & Langues par Défaut
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl border py-2.5 text-xs font-semibold transition-all',
                theme === 'dark'
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-elevated text-muted-foreground hover:text-foreground'
              )}
            >
              <Moon className="size-3.5" /> Noir Absolu OLED
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl border py-2.5 text-xs font-semibold transition-all',
                theme === 'light'
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-elevated text-muted-foreground hover:text-foreground'
              )}
            >
              <Sun className="size-3.5" /> Clair Céramique
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="px-1 text-xs font-medium text-muted-foreground">
              Langue de l’interface
            </label>
            <Select
              value={prefs.uiLanguage}
              onValueChange={(v) => onUpdatePrefs({ uiLanguage: v as UiLanguage })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERFACE_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="px-1 text-xs font-medium text-muted-foreground">
              Langue de préférence par défaut (Catalogue + Audio/Sous-titres MPV)
            </label>
            <Select
              value={prefs.preferredContentLanguage}
              onValueChange={(v) =>
                onUpdatePrefs({ preferredContentLanguage: v as ContentLanguageCode })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-elevated px-4 py-3">
            <div>
              <p className="text-xs font-bold text-foreground">
                Filtrer le catalogue par langue par défaut
              </p>
              <p className="text-[11px] text-muted-foreground">
                Applique automatiquement votre langue préférée dans Live, Films et Séries
              </p>
            </div>
            <Switch
              checked={prefs.autoFilterByLanguage}
              onCheckedChange={(v) => onUpdatePrefs({ autoFilterByLanguage: v })}
              ariaLabel="Filtrer automatiquement par langue"
            />
          </div>
        </section>

        <SettingsPlayerNetwork
          prefs={prefs}
          mpvPath={mpvPath}
          onMpvPathChange={setMpvPath}
          vlcPath={vlcPath}
          onVlcPathChange={setVlcPath}
          userAgent={userAgent}
          onUserAgentChange={setUserAgent}
          onUpdatePrefs={onUpdatePrefs}
        />

        <div className="space-y-4">
          <SettingsUpdateCard
            update={appUpdate}
            autoUpdate={prefs.autoUpdate}
            onAutoUpdateChange={(v) => {
              void onUpdatePrefs({ autoUpdate: v });
              if (v) void appUpdate.check();
            }}
          />

          <section className="space-y-3 rounded-[26px] border border-border bg-card p-6">
            <div>
              <p className="text-sm font-bold text-foreground">Actualisation des sources</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Au démarrage, re-télécharge en arrière-plan les playlists M3U et portails Xtream
                dont la dernière actualisation est plus ancienne que l’intervalle choisi.
              </p>
            </div>
            <Select
              value={String(prefs.sourceRefreshDays)}
              onValueChange={(v) => onUpdatePrefs({ sourceRefreshDays: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_REFRESH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="flex items-center justify-between rounded-[26px] border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Database className="size-5 text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">Cache Métadonnées TMDB SQLite</p>
                <p className="text-xs text-muted-foreground">
                  {tmdbCount} fiche(s) mise(s) en cache localement
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={handleClearTmdb}>
              <Trash2 className="size-3.5" /> Purger
            </Button>
          </section>

          <section className="flex items-center justify-between rounded-[26px] border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Smartphone className="size-5 text-foreground" />
              <div>
                <p className="text-sm font-bold text-foreground">Télécommande Web LAN</p>
                <p className="text-xs text-muted-foreground">
                  {localIps.length > 0
                    ? `IP locales : ${localIps.join(', ')}`
                    : 'Disponible sur le réseau local'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
