// Carte Paramètres : mise à jour de TVNest depuis les releases GitHub.
import { Download, RefreshCw, RotateCw } from 'lucide-react';
import { Button } from '@/components/motion/button';
import { Switch } from '@/components/motion/switch';
import type { AppUpdateState } from '@/hooks/use-app-update';

interface SettingsUpdateCardProps {
  update: AppUpdateState;
  autoUpdate: boolean;
  onAutoUpdateChange: (enabled: boolean) => void;
}

function describeStatus(update: AppUpdateState): string {
  const s = update.status;
  if (!update.available || !s) return 'Disponible uniquement dans l’application installée.';
  const latest = s.latestVersion ?? s.release?.version;
  switch (s.status) {
    case 'unsupported':
      return 'Mise à jour intégrée indisponible pour cette installation (version de développement).';
    case 'checking':
      return 'Recherche d’une nouvelle version…';
    case 'available':
      return `Version ${latest} disponible.`;
    case 'not-available':
      return 'TVNest est à jour.';
    case 'downloading':
      return `Téléchargement de la version ${latest}… ${Math.round(s.progress?.percent ?? 0)} %`;
    case 'downloaded':
      return `Version ${latest} téléchargée : redémarrez pour l’installer.`;
    case 'error':
      return `Échec de la mise à jour : ${s.error ?? 'erreur inconnue'}`;
    default:
      return 'Aucune vérification pour le moment.';
  }
}

export function SettingsUpdateCard({ update, autoUpdate, onAutoUpdateChange }: SettingsUpdateCardProps) {
  const s = update.status;
  const busy = s?.status === 'checking' || s?.status === 'downloading';
  const canSelfUpdate = Boolean(update.available && s?.supportedSelfUpdate);

  return (
    <section className="space-y-4 rounded-[26px] border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Mises à jour</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Version installée : {s?.currentVersion ?? '–'}
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={!canSelfUpdate || busy} onClick={update.check}>
          <RefreshCw className={busy && s?.status === 'checking' ? 'size-3.5 animate-spin' : 'size-3.5'} />
          Vérifier
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-elevated px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Mise à jour automatique</p>
          <p className="text-[11px] text-muted-foreground">
            Vérifie et télécharge la dernière version publiée sur GitHub.
          </p>
        </div>
        <Switch checked={autoUpdate} onCheckedChange={onAutoUpdateChange} ariaLabel="Mise à jour automatique" />
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {describeStatus(update)}
      </p>

      {s?.status === 'downloading' ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300"
            style={{ width: `${Math.round(s.progress?.percent ?? 0)}%` }}
          />
        </div>
      ) : null}

      {canSelfUpdate && s?.status === 'available' && !autoUpdate ? (
        <Button size="sm" variant="primary" onClick={update.download}>
          <Download className="size-3.5" /> Télécharger la mise à jour
        </Button>
      ) : null}

      {s?.status === 'downloaded' ? (
        <Button size="sm" variant="primary" onClick={update.install}>
          <RotateCw className="size-3.5" /> Redémarrer et installer
        </Button>
      ) : null}

      {s && !s.supportedSelfUpdate && s.manualDownloadUrl ? (
        <a
          href={s.manualDownloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs font-semibold text-foreground underline underline-offset-2"
        >
          Télécharger la dernière version manuellement
        </a>
      ) : null}
    </section>
  );
}
