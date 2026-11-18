// Service EPG XMLTV Electron : synchronisation, icônes, couverture et recherche.
import { isElectronRuntime } from '@/services/ipc-playlists.service';
import type { EpgProgram } from '@/types/iptv.types';

const EPG_BATCH_CHUNK = 200;
const EPG_MAX_LOOKUP_IDS = 2000;

export async function syncEpgUrls(urls: string[]): Promise<void> {
  if (!isElectronRuntime() || urls.length === 0) return;
  const res = await window.electron.fetchEpg(urls);
  if (res && res.success === false) {
    throw new Error(res.message || 'Téléchargement XMLTV impossible');
  }
}

// Clé de recherche EPG d'une chaîne : tvg-id, sinon son nom (même règle que le backend).
export function epgKeyOf(item: { tvgId?: string; title: string }): string {
  return item.tvgId || item.title;
}

export async function fetchEpgChannelIcons(
  keys: string[]
): Promise<Record<string, string | null>> {
  if (!isElectronRuntime() || keys.length === 0 || !window.electron.getEpgChannelMetadata) {
    return {};
  }
  const meta = await window.electron.getEpgChannelMetadata(Array.from(new Set(keys)));
  const out: Record<string, string | null> = {};
  for (const [key, m] of Object.entries(meta || {})) out[key] = m?.iconUrl ?? null;
  return out;
}

export async function fetchEpgCoverage(
  keys: string[],
  fromMs: number,
  toMs: number
): Promise<Set<string>> {
  if (!isElectronRuntime() || keys.length === 0 || !window.electron.getEpgProgramCoverage) {
    return new Set();
  }
  const covered = await window.electron.getEpgProgramCoverage({
    channelIds: Array.from(new Set(keys)).slice(0, EPG_MAX_LOOKUP_IDS),
    fromMs,
    toMs,
  });
  return new Set(covered || []);
}

export async function importLocalXmltvFile(): Promise<string | null> {
  if (!isElectronRuntime()) return null;
  const path = await window.electron.openEpgFileDialog();
  if (path) {
    const res = await window.electron.fetchEpg([path]);
    if (res && res.success === false) {
      throw new Error(res.message || 'Fichier XMLTV invalide ou illisible');
    }
  }
  return path;
}

export async function fetchCurrentEpgForChannels(
  channelIds: string[]
): Promise<Record<string, EpgProgram | null>> {
  if (!isElectronRuntime() || channelIds.length === 0) return {};
  const unique = Array.from(new Set(channelIds.filter(Boolean))).slice(
    0,
    EPG_MAX_LOOKUP_IDS
  );
  if (unique.length === 0) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += EPG_BATCH_CHUNK) {
    chunks.push(unique.slice(i, i + EPG_BATCH_CHUNK));
  }
  const results = await Promise.all(
    chunks.map((chunk) => window.electron.getCurrentProgramsBatch(chunk))
  );
  return Object.assign({}, ...results);
}

export async function fetchChannelSchedule(
  channelId: string
): Promise<EpgProgram[]> {
  if (!isElectronRuntime() || !channelId) return [];
  return window.electron.getChannelPrograms(channelId);
}

export async function searchEpgGuide(query: string): Promise<EpgProgram[]> {
  if (!isElectronRuntime() || !query.trim()) return [];
  return window.electron.searchEpgPrograms(query.trim(), 60);
}
