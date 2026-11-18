// Barre supérieure de synchronisation XMLTV et recherche d'émissions du guide EPG TVNest.
import { CalendarRange, FolderOpen, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import { cn } from '@/lib/utils';

interface EpgSourceToolbarProps {
  epgUrlInput: string;
  onEpgUrlInputChange: (v: string) => void;
  savedUrls: string[];
  syncing: boolean;
  onSyncUrl: () => void;
  onOpenXmltv: () => void;
  onRemoveUrl: (url: string) => void;
  searchTerm: string;
  onSearchTermChange: (q: string) => void;
}

export function EpgSourceToolbar({
  epgUrlInput,
  onEpgUrlInputChange,
  savedUrls,
  syncing,
  onSyncUrl,
  onOpenXmltv,
  onRemoveUrl,
  searchTerm,
  onSearchTermChange,
}: EpgSourceToolbarProps) {
  return (
    <div className="grid grid-cols-12 gap-4 rounded-[28px] border border-border bg-card p-5">
      <div className="col-span-12 space-y-2 lg:col-span-7">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <CalendarRange className="size-4" />
          Source du guide TV (XMLTV .xml / .xml.gz)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="url"
            value={epgUrlInput}
            onChange={onEpgUrlInputChange}
            placeholder="https://exemple.com/epg.xml.gz"
            className="min-w-[220px] flex-1"
          />
          <Button size="md" variant="primary" disabled={syncing} onClick={onSyncUrl}>
            <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} />
            Synchroniser
          </Button>
          <Button size="md" variant="secondary" disabled={syncing} onClick={onOpenXmltv}>
            <FolderOpen className="size-3.5" />
            Fichier XMLTV
          </Button>
        </div>
        {savedUrls.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {savedUrls.map((u) => (
              <span
                key={u}
                className="inline-flex max-w-xs items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-0.5 text-[11px] text-muted-foreground"
              >
                <span className="truncate">{u}</span>
                <button
                  type="button"
                  aria-label="Supprimer cette source XMLTV"
                  onClick={() => onRemoveUrl(u)}
                  className="rounded-full p-0.5 hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="col-span-12 space-y-2 lg:col-span-5">
        <div className="text-xs font-semibold text-muted-foreground">Rechercher une émission</div>
        <Input
          value={searchTerm}
          onChange={onSearchTermChange}
          placeholder="Titre d'émission, journal, sport..."
          leftIcon={<Search />}
        />
      </div>
    </div>
  );
}
