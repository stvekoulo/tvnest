// Appels Xtream Codes : la réponse utile, ou une erreur lisible (jamais « [object Object] »).
import { readPortalRequestFailure } from '@iptvnator/shared/interfaces';

export function describeXtreamHttpStatus(status: number): string {
  if (status === 401 || status === 403) {
    return `Identifiants refusés par le serveur (code ${status}) : vérifiez le nom d'utilisateur et le mot de passe.`;
  }
  if (status === 404) return "Ce serveur n'expose pas d'API Xtream (code 404) : vérifiez l'adresse.";
  // Panneaux IPTV derrière Cloudflare (constaté) : 511 sans identifiants, 512 pour un
  // couple utilisateur / mot de passe inconnu — exactement comme des identifiants inventés.
  if (status === 512) {
    return "Le fournisseur ne reconnaît pas ce compte (code 512) : nom d'utilisateur ou mot de passe incorrect, ou compte pas encore activé. Recopiez-les depuis le message de votre fournisseur.";
  }
  if (status === 511 || status === 513) {
    return `Le fournisseur refuse l'accès (code ${status}) : abonnement expiré ou suspendu, nombre maximal de connexions atteint, ou adresse IP non autorisée.`;
  }
  if (status >= 500) return `Le serveur IPTV est en panne ou saturé (code ${status}). Réessayez plus tard.`;
  return `Le serveur IPTV a répondu par une erreur (code ${status}).`;
}

/** Erreur IPC Electron → explication en français. */
export function describeXtreamFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const text = raw
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^[A-Za-z]*Error:\s*/, '');
  const status = /HTTP Error (\d{3})/.exec(text)?.[1];
  if (status) return describeXtreamHttpStatus(Number(status));
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return "Adresse du serveur introuvable : vérifiez l'URL.";
  }
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|socket hang up|stopped answering/i.test(text)) {
    return "Le serveur IPTV ne répond pas : vérifiez l'adresse et le port, ou réessayez plus tard.";
  }
  if (!text || text === '[object Object]') return 'Échec de connexion au serveur IPTV.';
  return text;
}

export async function requestXtream(
  url: string,
  params: Record<string, string>,
  sessionId?: string
): Promise<unknown> {
  let res: unknown;
  try {
    res = await window.electron.xtreamRequest({ url, params, sessionId });
  } catch (err) {
    throw new Error(describeXtreamFailure(err));
  }
  const failure = readPortalRequestFailure(res);
  if (failure) {
    throw new Error(failure.kind === 'http' ? describeXtreamHttpStatus(failure.status) : 'Requête annulée.');
  }
  if (!res || typeof res !== 'object' || !('payload' in res)) {
    throw new Error('Réponse inattendue du serveur IPTV.');
  }
  return (res as { payload: unknown }).payload;
}

// Certains serveurs laissent pendre une requête sur dix (constaté : 70 s puis coupure),
// alors que la même requête renvoyée répond en moins d'une seconde. On abandonne vite
// et on renvoie, plutôt que d'attendre la fin du délai.
const QUICK_ATTEMPT_MS = [5_000, 6_000, 12_000];

/** Requête de fiche (série, film) : réessais rapides tant que le serveur ne répond pas. */
export async function requestXtreamQuick(url: string, params: Record<string, string>): Promise<unknown> {
  for (const [index, ms] of QUICK_ATTEMPT_MS.entries()) {
    const sessionId = `tvnest-quick-${crypto.randomUUID()}`;
    let timer: number | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = window.setTimeout(() => resolve('timeout'), ms);
    });
    try {
      const result = await Promise.race([requestXtream(url, params, sessionId), timeout]);
      if (result !== 'timeout') return result;
    } finally {
      window.clearTimeout(timer);
    }
    // Attente abandonnée : la requête pendante est annulée côté Electron.
    window.electron.xtreamCancelSession?.(sessionId)?.catch(() => {});
    if (index === QUICK_ATTEMPT_MS.length - 1) break;
  }
  throw new Error('Le serveur IPTV met trop de temps à répondre.');
}

interface XtreamUserInfo {
  auth?: number | string;
  status?: string;
  exp_date?: string | number | null;
  is_trial?: string | number;
  active_cons?: string | number;
  max_connections?: string | number;
}

export interface XtreamAccount {
  status: string;
  /** Millisecondes ; null = sans date de fin (illimité). */
  expiresAt: number | null;
  activeConnections: number | null;
  maxConnections: number | null;
  trial: boolean;
}

const toCount = (value: unknown): number | null => {
  const n = Number(value);
  return value === '' || value == null || !Number.isFinite(n) ? null : n;
};

/** Abonnement d'une source Xtream : statut, date de fin, connexions. */
export async function fetchXtreamAccount(
  url: string,
  creds: { username: string; password: string }
): Promise<XtreamAccount | null> {
  const payload = (await requestXtreamQuick(url, creds)) as { user_info?: XtreamUserInfo } | null;
  const info = payload?.user_info;
  if (!info) return null;
  const exp = Number(info.exp_date);
  return {
    status: (info.status || '').toLowerCase(),
    expiresAt: exp > 0 ? exp * 1000 : null,
    activeConnections: toCount(info.active_cons),
    maxConnections: toCount(info.max_connections),
    trial: Number(info.is_trial) === 1,
  };
}

const DAY_MS = 86_400_000;

/** « Expire dans 12 jours » et son niveau d'alerte. */
export function describeExpiry(
  account: Pick<XtreamAccount, 'status' | 'expiresAt'>,
  now = Date.now()
): { label: string; date: string | null; tone: 'ok' | 'soon' | 'expired' } {
  const date = account.expiresAt ? new Date(account.expiresAt).toLocaleDateString('fr-FR') : null;
  if (account.status === 'expired' || (account.expiresAt !== null && account.expiresAt <= now)) {
    return { label: 'Expiré', date, tone: 'expired' };
  }
  if (account.expiresAt === null) return { label: 'Sans date de fin', date, tone: 'ok' };
  const days = Math.ceil((account.expiresAt - now) / DAY_MS);
  const label = days === 1 ? 'Expire dans 1 jour' : `Expire dans ${days} jours`;
  return { label, date, tone: days <= 7 ? 'soon' : 'ok' };
}

/** Vérifie le compte avant tout import : identifiants, abonnement expiré ou suspendu. */
export async function checkXtreamAccount(url: string, creds: { username: string; password: string }): Promise<void> {
  const payload = (await requestXtream(url, creds)) as { user_info?: XtreamUserInfo } | null;
  const info = payload?.user_info;
  if (!info) return; // Certains panneaux ne renvoient pas user_info : l'import le dira.
  if (Number(info.auth) === 0) {
    throw new Error("Identifiants incorrects : vérifiez le nom d'utilisateur et le mot de passe.");
  }
  const status = (info.status || '').toLowerCase();
  if (status === 'expired') {
    const exp = Number(info.exp_date);
    const date = exp > 0 ? ` le ${new Date(exp * 1000).toLocaleDateString('fr-FR')}` : '';
    throw new Error(`Abonnement expiré${date} : renouvelez-le auprès de votre fournisseur.`);
  }
  if (status === 'banned' || status === 'disabled') {
    throw new Error('Compte suspendu par le fournisseur.');
  }
}
