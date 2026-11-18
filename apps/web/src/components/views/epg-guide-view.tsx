// Guide TV XMLTV (EPG) TVNest : chaînes couvertes en tête, logos XMLTV, émission en cours.
import { Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MediaArtwork } from '@/components/cards/media-artwork';
import { Button } from '@/components/motion/button/base';
import { EpgChannelSidebar } from '@/components/views/epg-channel-sidebar';
import { EpgProgramList } from '@/components/views/epg-program-list';
import { EpgSourceToolbar } from '@/components/views/epg-source-toolbar';
import { queryFilteredCatalog } from '@/services/ipc-catalog.service';
import { isElectronRuntime } from '@/services/ipc-playlists.service';
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
import type {
  AppPreferences,
  CatalogFilterState,
  EpgProgram,
  UnifiedMedia,
  UnifiedPlaylist,
} from '@/types/iptv.types';

const DAY_MS = 86_400_000;
const ALL_LIVE_FILTERS: CatalogFilterState = {
  search: '',
  language: 'ALL',
  quality: 'ALL',
  minRating: 0,
  year: '',
  onlyFavorites: false,
  hasCatchup: false,
  hasEpg: false,
  sortBy: 'relevance',
};

interface EpgGuideViewProps {
  activePlaylist?: UnifiedPlaylist | null;
  liveItems: UnifiedMedia[];
  prefs: AppPreferences;
  onUpdatePrefs: (patch: Partial<AppPreferences>) => Promise<void>;
  onPlay: (item: UnifiedMedia) => void;
  onNotify: (msg: string) => void;
}

export function EpgGuideView({
  activePlaylist,
  liveItems,
  prefs,
  onUpdatePrefs,
  onPlay,
  onNotify,
}: EpgGuideViewProps) {
  const [now, setNow] = useState(() => Date.now());
  const [allLive, setAllLive] = useState<UnifiedMedia[]>(liveItems);
  const [channelQuery, setChannelQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [programs, setPrograms] = useState<EpgProgram[]>([]);
  const [epgUrlInput, setEpgUrlInput] = useState(
    prefs.epgUrls[0] || activePlaylist?.epgUrl || ''
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<EpgProgram[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [covered, setCovered] = useState<Set<string>>(new Set());
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [nowPlaying, setNowPlaying] = useState<Record<string, EpgProgram | null>>({});
  const [dataVersion, setDataVersion] = useState(0);
  const searchReqRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!epgUrlInput && activePlaylist?.epgUrl) setEpgUrlInput(activePlaylist.epgUrl);
  }, [activePlaylist?.epgUrl]);

  useEffect(() => {
    if (!activePlaylist) {
      setAllLive(liveItems);
      return;
    }
    let cancelled = false;
    queryFilteredCatalog(activePlaylist, {
      type: 'live',
      categoryName: null,
      filters: ALL_LIVE_FILTERS,
      limit: 2000,
      offset: 0,
    })
      .then((res) => !cancelled && res.items.length > 0 && setAllLive(res.items))
      .catch(() => !cancelled && setAllLive(liveItems));
    return () => {
      cancelled = true;
    };
  }, [activePlaylist, liveItems]);

  const keys = useMemo(() => allLive.map(epgKeyOf), [allLive]);

  useEffect(() => {
    let cancelled = false;
    const t = Date.now();
    Promise.all([
      fetchEpgCoverage(keys, t, t + DAY_MS),
      fetchEpgChannelIcons(keys.slice(0, 800)),
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

  const channels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    return allLive
      .filter((ch) => !q || ch.title.toLowerCase().includes(q) || ch.category.toLowerCase().includes(q))
      .map((ch) => ({ ch, key: epgKeyOf(ch) }))
      .sort((a, b) => Number(covered.has(b.key)) - Number(covered.has(a.key)));
  }, [allLive, channelQuery, covered]);

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

  useEffect(() => {
    const q = searchTerm.trim();
    const reqId = ++searchReqRef.current;
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchEpgGuide(q)
        .then((res) => reqId === searchReqRef.current && setSearchResults(res))
        .catch(() => reqId === searchReqRef.current && setSearchResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

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

  const handleRemoveEpgUrl = async (urlToRemove: string) => {
    const nextUrls = prefs.epgUrls.filter((u) => u !== urlToRemove);
    if (isElectronRuntime()) {
      await window.electron.clearEpgDataForSource?.(urlToRemove).catch(() => {});
      await window.electron.reconcileEpgSources?.(nextUrls).catch(() => {});
    }
    await onUpdatePrefs({ epgUrls: nextUrls });
    if (epgUrlInput === urlToRemove) setEpgUrlInput(nextUrls[0] || '');
    refreshAfterImport('Source XMLTV retirée');
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

  const searching = searchTerm.trim().length >= 2;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-4 sm:p-6">
      <EpgSourceToolbar
        epgUrlInput={epgUrlInput}
        onEpgUrlInputChange={setEpgUrlInput}
        savedUrls={prefs.epgUrls}
        syncing={syncing}
        onSyncUrl={() => void handleSyncUrl()}
        onOpenXmltv={() => void handleOpenXmltv()}
        onRemoveUrl={(u) => void handleRemoveEpgUrl(u)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      />

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <EpgChannelSidebar
          totalLiveCount={allLive.length}
          coveredCount={covered.size}
          channelQuery={channelQuery}
          onChannelQueryChange={setChannelQuery}
          channels={channels}
          selectedKey={selected?.key}
          covered={covered}
          icons={icons}
          nowPlaying={nowPlaying}
          now={now}
          onSelectChannel={(key) => {
            setSelectedKey(key);
            setSearchTerm('');
            setSearchResults([]);
          }}
        />

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
