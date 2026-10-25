// Gestionnaire réel des sources IPTV TVNest (M3U, Xtream Codes, Stalker MAC) avec compteurs SQLite.
import {
  CheckCircle2,
  FolderOpen,
  Globe,
  Layers,
  Plus,
  Radio,
  Server,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/motion/button/base';
import { TvNestLogo } from '@/components/shell/tvnest-logo';
import { cn } from '@/lib/utils';
import type { PortalKind, UnifiedPlaylist } from '@/types/iptv.types';

interface PlaylistsManagerViewProps {
  playlists: UnifiedPlaylist[];
  activePlaylistId: string | null;
  onSelectPlaylist: (id: string) => void;
  onDeletePlaylist: (id: string) => void;
  onOpenAddSource: () => void;
}

const KIND_META: Record<
  PortalKind,
  { label: string; badgeClass: string; icon: typeof Globe }
> = {
  'm3u-url': {
    label: 'M3U URL',
    badgeClass: 'border-primary/35 bg-primary/15 text-primary',
    icon: Globe,
  },
  'm3u-file': {
    label: 'Fichier M3U',
    badgeClass: 'border-border bg-elevated text-foreground',
    icon: FolderOpen,
  },
  'm3u-text': {
    label: 'M3U Texte',
    badgeClass: 'border-border bg-elevated text-foreground',
    icon: Layers,
  },
  xtream: {
    label: 'Xtream Codes',
    badgeClass: 'border-border bg-elevated text-foreground',
    icon: Server,
  },
  stalker: {
    label: 'Stalker MAC',
    badgeClass: 'border-border bg-elevated text-foreground',
    icon: Radio,
  },
};

export function PlaylistsManagerView({
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onDeletePlaylist,
  onOpenAddSource,
}: PlaylistsManagerViewProps) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <TvNestLogo size="lg" />
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-0.5 text-[11px] font-medium text-primary">
              <Layers className="size-3" />
              Moteur SQLite Natif TVNest
            </span>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-foreground">
              Sources & Portails IPTV
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {playlists.length} source(s) indexée(s) localement dans votre base SQLite.
            </p>
          </div>
        </div>

        <Button size="lg" variant="primary" ripple onClick={onOpenAddSource}>
          <Plus className="size-4" />
          Ajouter une source IPTV
        </Button>
      </div>

      {playlists.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-card p-8 text-center">
          <Server className="size-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-bold text-foreground">
            Aucune source IPTV enregistrée
          </h2>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Connectez une URL M3U, un fichier local, un serveur Xtream Codes ou un
            portail Stalker MAC.
          </p>
          <Button variant="primary" onClick={onOpenAddSource} className="mt-4">
            <Plus className="size-3.5" />
            Configurer maintenant
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {playlists.map((pl) => {
            const meta = KIND_META[pl.kind];
            const Icon = meta.icon;
            const isActive = pl.id === activePlaylistId;

            return (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist(pl.id)}
                className={cn(
                  'group flex cursor-pointer flex-col justify-between rounded-[26px] border bg-card p-5 transition-all',
                  isActive
                    ? 'border-primary ring-1 ring-primary/35'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold',
                        meta.badgeClass
                      )}
                    >
                      <Icon className="size-3" />
                      {meta.label}
                    </span>

                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                        <CheckCircle2 className="size-3.5" />
                        Active
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-3.5 truncate font-display text-base font-bold text-foreground">
                    {pl.title}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {pl.serverUrl || pl.url || pl.filePath || pl.macAddress || 'Source locale'}
                  </p>

                  {pl.counts ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-medium text-muted-foreground">
                      <span className="rounded-md border border-border bg-elevated px-2 py-0.5">
                        Live : {pl.counts.live.toLocaleString('fr-FR')}
                      </span>
                      <span className="rounded-md border border-border bg-elevated px-2 py-0.5">
                        Films : {pl.counts.movie.toLocaleString('fr-FR')}
                      </span>
                      <span className="rounded-md border border-border bg-elevated px-2 py-0.5">
                        Séries : {pl.counts.series.toLocaleString('fr-FR')}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3.5">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">
                      {pl.channelCount.toLocaleString('fr-FR')}
                    </span>{' '}
                    flux total
                  </div>

                  <button
                    type="button"
                    title="Supprimer cette source"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePlaylist(pl.id);
                    }}
                    className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-rose-500/15 hover:text-rose-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
