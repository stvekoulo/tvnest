// Gestionnaire réel des Téléchargements VOD et Enregistrements Live TV TVNest.
import { Download, FolderOpen, Pause, Play, Radio, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/motion/button/base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/motion/tabs';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { ElectronDownloadItem, ElectronRecordingItem } from '@/types/iptv.types';

interface DownloadsViewProps {
  downloads: ElectronDownloadItem[];
  recordings: ElectronRecordingItem[];
  onRefresh: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 Mo';
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DownloadsView({ downloads, recordings, onRefresh }: DownloadsViewProps) {
  const runDlAction = async (fn: () => Promise<unknown>) => {
    if (!isElectronRuntime()) return;
    await fn();
    onRefresh();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-border bg-card p-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-0.5 text-[11px] font-medium text-primary">
            <Download className="size-3" />
            Transferts Hors-Ligne Natifs
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground">
            Téléchargements & Enregistrements
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {downloads.length} téléchargement(s) VOD · {recordings.length} enregistrement(s) Live TV
          </p>
        </div>

        {isElectronRuntime() && downloads.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runDlAction(() => window.electron.downloadsClearCompleted())}
          >
            Nettoyer les terminés
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="vod" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vod">Téléchargements VOD ({downloads.length})</TabsTrigger>
          <TabsTrigger value="recordings">Enregistrements Live ({recordings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="vod" className="space-y-3">
          {downloads.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-[26px] border border-dashed border-border bg-card p-6 text-center">
              <Download className="size-7 text-muted-foreground" />
              <p className="mt-2 text-xs font-bold text-foreground">
                Aucun téléchargement VOD en cours
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Ouvrez la fiche d’un film ou d’une série pour télécharger un fichier hors-ligne.
              </p>
            </div>
          ) : (
            downloads.map((dl) => {
              const pct =
                dl.totalBytes && dl.bytesDownloaded
                  ? Math.min(100, Math.round((dl.bytesDownloaded / dl.totalBytes) * 100))
                  : dl.status === 'completed'
                    ? 100
                    : 0;
              return (
                <div
                  key={dl.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{dl.title}</span>
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                        {dl.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatBytes(dl.bytesDownloaded)}
                      {dl.totalBytes ? ` / ${formatBytes(dl.totalBytes)} (${pct}%)` : ''}
                    </p>
                    <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {dl.status === 'downloading' ? (
                      <Button
                        size="icon-sm"
                        variant="secondary"
                        onClick={() => runDlAction(() => window.electron.downloadsPause(dl.id))}
                      >
                        <Pause className="size-3.5" />
                      </Button>
                    ) : null}
                    {dl.filePath && dl.status === 'completed' ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            runDlAction(() => window.electron.downloadsPlayFile(dl.filePath!))
                          }
                        >
                          <Play className="size-3.5 fill-current" /> Lire
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="secondary"
                          onClick={() =>
                            runDlAction(() => window.electron.downloadsRevealFile(dl.filePath!))
                          }
                        >
                          <FolderOpen className="size-3.5" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        runDlAction(() =>
                          dl.status === 'downloading'
                            ? window.electron.downloadsCancel(dl.id)
                            : window.electron.downloadsRemove(dl.id)
                        )
                      }
                    >
                      <Trash2 className="size-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="recordings" className="space-y-3">
          {recordings.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-[26px] border border-dashed border-border bg-card p-6 text-center">
              <Radio className="size-7 text-muted-foreground" />
              <p className="mt-2 text-xs font-bold text-foreground">
                Aucun enregistrement Live TV
              </p>
            </div>
          ) : (
            recordings.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between gap-4 rounded-[24px] border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {rec.programTitle || rec.channelName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rec.channelName} · {formatBytes(rec.fileSizeBytes)} · {rec.status}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {rec.status === 'recording' ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        runDlAction(() => window.electron.recordingsStop?.(rec.id) || Promise.resolve())
                      }
                    >
                      <Square className="size-3" /> Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        runDlAction(
                          () => window.electron.recordingsPlayFile?.(rec.filePath) || Promise.resolve()
                        )
                      }
                    >
                      <Play className="size-3.5" /> Lire
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
