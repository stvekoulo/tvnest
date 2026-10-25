// Séparation des données de TVNest et d'IPTVnator.
//
// Jusqu'à la 1.0.2, TVNest utilisait le profil Electron d'IPTVnator (app.setName('iptvnator'))
// et sa base SQLite (~/.iptvnator/databases/iptvnator.db) : regarder un film dans l'un se
// voyait dans l'autre. TVNest a maintenant son propre profil (%APPDATA%\TVNest) et sa propre
// base (~/.tvnest/databases/tvnest.db). Au premier lancement, les données actuelles sont
// copiées une seule fois pour que TVNest garde ses sources, favoris et historique ; ensuite
// les deux applications sont indépendantes. IPTVnator n'est jamais modifié.
import type BetterSqlite3 from 'better-sqlite3';
import { copyFileSync, cpSync, existsSync, renameSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import {
    getIptvnatorDatabasePath,
    IPTVNATOR_DATA_DIR_ENV,
    IPTVNATOR_E2E_DATA_DIR_ENV,
} from '@iptvnator/shared/database/path-utils';

const PROFILE_MARKER = '.tvnest-profile-separated';
// Données du site (préférences TVNest, stockage local) ; les caches se reconstruisent.
const PROFILE_ENTRIES = ['Local Storage', 'IndexedDB', 'Session Storage'];
const LEGACY_PROFILE_NAMES = ['IPTVnator', 'iptvnator'];

function hasDataOverride(): boolean {
    return Boolean(
        process.env[IPTVNATOR_E2E_DATA_DIR_ENV]?.trim() ||
            process.env[IPTVNATOR_DATA_DIR_ENV]?.trim()
    );
}

/** Copie unique du stockage du site depuis le profil partagé avec IPTVnator. */
export function separateTvnestProfile(appData: string, userData: string): void {
    if (hasDataOverride() || existsSync(join(userData, PROFILE_MARKER))) return;
    const legacy = LEGACY_PROFILE_NAMES.map((name) => join(appData, name)).find(
        (dir) => existsSync(dir) && resolve(dir) !== resolve(userData)
    );
    if (legacy) {
        for (const entry of PROFILE_ENTRIES) {
            const source = join(legacy, entry);
            if (!existsSync(source)) continue;
            const target = join(userData, entry);
            // Rien n'est supprimé : un ancien stockage TVNest est gardé à côté.
            if (existsSync(target)) renameSync(target, `${target}.avant-separation`);
            cpSync(source, target, { recursive: true });
        }
    }
    writeFileSync(join(userData, PROFILE_MARKER), new Date().toISOString());
}

/** Copie unique de la base partagée vers la base propre à TVNest. */
export function separateTvnestDatabase(): 'copied' | 'skipped' {
    if (hasDataOverride()) return 'skipped';
    const target = getIptvnatorDatabasePath();
    const legacy = join(homedir(), '.iptvnator', 'databases', 'iptvnator.db');
    if (existsSync(target) || !existsSync(legacy)) return 'skipped';
    try {
        // VACUUM INTO lit un instantané cohérent, même si IPTVnator écrit en même temps.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database: typeof BetterSqlite3 = require('better-sqlite3');
        const db = new Database(legacy, { readonly: true, fileMustExist: true });
        try {
            db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
        } finally {
            db.close();
        }
    } catch {
        for (const suffix of ['', '-wal', '-shm']) {
            if (existsSync(legacy + suffix)) copyFileSync(legacy + suffix, target + suffix);
        }
    }
    return 'copied';
}
