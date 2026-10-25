// Guide TV XMLTV (EPG) TVNest : chaînes couvertes en tête, logos XMLTV, émission en cours.
import { CalendarRange, FolderOpen, Play, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import { EpgProgramList, programProgress } from '@/components/views/epg-program-list';
import { cn } from '@/lib/utils';
import {
  epgKeyOf,
  fetchChannelSchedule,
  fetchCurrentEpgForChannels,
  fetchEpgChannelIcons,
  fetchEpgCoverage,
  importLocalXmltvFile,
  searchEpgGuide,
  syncEpgUrls,
} from '@/services/ipc-system.service';
import type { AppPreferences, EpgProgram, UnifiedMedia } from '@/types/iptv.types';

const DAY_MS = 86_400_000;

interface EpgGuideViewProps {
  liveItems: UnifiedMedia[];
  prefs: AppPreferences;
  onUpdatePrefs: (patch: Partial<AppPreferences>) => Promise<void>;
  onPlay: (item: UnifiedMedia) => void;
  onNotify: (msg: string) => void;
}

export function EpgGuideView({ liveItems, prefs, onUpdatePrefs, onPlay, onNotify }: EpgGuideViewProps) {
  const [now, setNow] = useState(() => Date.now());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [programs, setPrograms] = useState<EpgProgram[]>([]);
  const [epgUrlInput, setEpgUrlInput] = useState(prefs.epgUrls[0] || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<EpgProgram[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [covered, setCovered] = useState<Set<string>>(new Set());
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [nowPlaying, setNowPlaying] = useState<Record<string, EpgProgram | null>>({});
  const [dataVersion, setDataVersion] = useState(0);

  // Horloge : la progression « En cours » avance sans recharger.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const keys = useMemo(() => liveItems.map(epgKeyOf), [liveItems]);

  // Couverture, logos XMLTV et émission en cours pour les chaînes listées.
  useEffect(() => {
    let cancelled = false;
    const t = Date.now();
    Promise.all([
      fetchEpgCoverage(keys, t, t + DAY_MS),
      fetchEpgChannelIcons(keys.slice(0, 500)),
      fetchCurrentEpgForChannels(keys),
    ])
      .then(([cov, ico, cur]) => {
        if (cancelled) return;
        setCovered(cov);
        setIcons(ico);
        setNowPlaying(cur);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [keys, dataVersion]);

  // Chaînes avec un guide en tête de liste.
  const channels = useMemo(
    () =>
      liveItems
        .map((ch) => ({ ch, key: epgKeyOf(ch) }))
        .sort((a, b) => Number(covered.has(b.key)) - Number(covered.has(a.key))),
    [liveItems, covered]
  );

  const selected =
    channels.find((c) => c.key === selectedKey) ?? channels.find((c) => covered.has(c.key)) ?? channels[0];

  useEffect(() => {
    if (!selected) {
      setPrograms([]);
      return;
    }
    let cancelled = false;
    fetchChannelSchedule(selected.key)
      .then((list) => !cancelled && setPrograms(list))
      .catch(() => !cancelled && setPrograms([]));
    return () => {
      cancelled = true;
    };
  }, [selected?.key, dataVersion]);

  const refreshAfterImport = (message: string) => {
    setDataVersion((v) => v + 1);
    onNotify(message);
  };

  const handleSyncUrl = async () => {
    const clean = epgUrlInput.trim();
    if (!clean) return;
    setSyncing(true);
    try {
      const nextUrls = Array.from(new Set([clean, ...prefs.epgUrls]));
      await syncEpgUrls(nextUrls);
      await onUpdatePrefs({ epgUrls: nextUrls });
      refreshAfterImport('Guide XMLTV synchronisé');
    } catch (err) {
      onNotify(`Erreur EPG : ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenXmltv = async () => {
    setSyncing(true);
    try {
      const path = await importLocalXmltvFile();
      if (path) refreshAfterImport('Fichier XMLTV chargé');
    } catch (err) {
      onNotify(`Erreur EPG : ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSearchEpg = async (q: string) => {
    setSearchTerm(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchResults(await searchEpgGuide(q).catch(() => []));
  };

  const searching = searchTerm.trim().length >= 2;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-4 sm:p-6">
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
              onChange={setEpgUrlInput}
              placeholder="https://exemple.com/epg.xml.gz"
              className="min-w-[220px] flex-1"
            />
            <Button size="md" variant="primary" disabled={syncing} onClick={handleSyncUrl}>
              <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} />
              Synchroniser
            </Button>
            <Button size="md" variant="secondary" disabled={syncing} onClick={handleOpenXmltv}>
              <FolderOpen className="size-3.5" />
              Fichier XMLTV
            </Button>
          </div>
        </div>
        <div className="col-span-12 space-y-2 lg:col-span-5">
          <div className="text-xs font-semibold text-muted-foreground">Rechercher une émission</div>
          <Input
            value={searchTerm}
            onChange={handleSearchEpg}
            placeholder="Titre d'émission, journal, sport..."
            leftIcon={<Search />}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <div className="col-span-12 max-h-[40vh] overflow-y-auto rounded-[26px] border border-border bg-card p-3 lg:col-span-4 lg:max-h-none">
          <h2 className="mb-2.5 px-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Chaînes ({liveItems.length.toLocaleString('fr-FR')}) · {covered.size.toLocaleString('fr-FR')} avec guide
          </h2>
          <div className="space-y-1">
            {channels.map(({ ch, key }) => {
              const active = selected?.key === key;
              const current = nowPlaying[key];
              const progress = current ? programProgress(current, now) : null;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setSelectedKey(key);
                    setSearchTerm('');
                    setSearchResults([]);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                    active ? 'bg-elevated' : 'hover:bg-elevated',
                    !covered.has(key) && 'opacity-60'
                  )}
                >
                  <MediaArtwork
                    src={ch.posterUrl}
                    fallbackSrc={icons[key]}
                    title={ch.title}
                    kind="live"
                    fit="contain"
                    monogramSize="sm"
                    className="size-9 shrink-0 rounded-lg border border-border bg-black"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-xs text-foreground', active && 'font-bold')}>
                      {ch.title}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {current ? current.title : covered.has(key) ? 'Programme à venir' : 'Pas de guide'}
                    </span>
                    {progress !== null ? (
                      <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-border">
                        <span className="block h-full bg-foreground/70" style={{ width: `${progress}%` }} />
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-12 overflow-y-auto rounded-[26px] border border-border bg-card p-5 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {!searching && selected ? (
                <MediaArtwork
                  src={selected.ch.posterUrl}
                  fallbackSrc={icons[selected.key]}
                  title={selected.ch.title}
                  kind="live"
                  fit="contain"
                  monogramSize="sm"
                  className="size-11 shrink-0 rounded-xl border border-border bg-black"
                />
              ) : null}
              <div className="min-w-0">
                <h2 className="truncate font-display text-base font-bold text-foreground">
                  {searching ? `Résultats pour « ${searchTerm.trim()} »` : selected?.ch.title || 'Sélectionnez une chaîne'}
                </h2>
                {!searching && selected ? (
                  <p className="truncate text-xs text-muted-foreground">Identifiant XMLTV : {selected.key}</p>
                ) : null}
              </div>
            </div>
            {!searching && selected ? (
              <Button size="sm" variant="primary" onClick={() => onPlay(selected.ch)}>
                <Play className="size-3 fill-current" /> Regarder le direct
              </Button>
            ) : null}
          </div>

          <EpgProgramList
            programs={searching ? searchResults : programs}
            now={now}
            searchMode={searching}
            onSelectProgram={
              searching
                ? (prog) => {
                    const match = channels.find((c) => c.key === prog.channel);
                    if (match) {
                      setSelectedKey(match.key);
                      setSearchTerm('');
                      setSearchResults([]);
                    }
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
