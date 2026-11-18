// Séparation des données de TVNest et d'IPTVnator.
import type BetterSqlite3 from 'better-sqlite3';
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    renameSync,
    statSync,
    writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import {
    getIptvnatorDatabasePath,
    IPTVNATOR_DATA_DIR_ENV,
    IPTVNATOR_E2E_DATA_DIR_ENV,
} from '@iptvnator/shared/database/path-utils';

const PROFILE_MARKER = '.tvnest-profile-separated';
const PROFILE_ENTRIES = [
    'Local Storage',
    'IndexedDB',
    'Session Storage',
    'config.json',
    'download-directory-authorization.json',
];
const LEGACY_PROFILE_NAMES = ['IPTVnator', 'iptvnator'];

function hasDataOverride(): boolean {
    return Boolean(
        process.env[IPTVNATOR_E2E_DATA_DIR_ENV]?.trim() ||
            process.env[IPTVNATOR_DATA_DIR_ENV]?.trim()
    );
}

/** Copie unique du stockage et de la configuration depuis le profil partagé avec IPTVnator. */
export function separateTvnestProfile(appData: string, userData: string): void {
    if (hasDataOverride() || existsSync(join(userData, PROFILE_MARKER))) return;
    mkdirSync(userData, { recursive: true });

    const legacy = LEGACY_PROFILE_NAMES.map((name) => join(appData, name)).find(
        (dir) => existsSync(dir) && resolve(dir) !== resolve(userData)
    );
    if (legacy) {
        for (const entry of PROFILE_ENTRIES) {
            const source = join(legacy, entry);
            if (!existsSync(source)) continue;
            const target = join(userData, entry);
            if (existsSync(target)) {
                renameSync(target, `${target}.avant-separation`);
            }
            if (statSync(source).isDirectory()) {
                cpSync(source, target, { recursive: true });
            } else {
                copyFileSync(source, target);
            }
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
    mkdirSync(dirname(target), { recursive: true });
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Database: typeof BetterSqlite3 = require('better-sqlite3');
        const db = new Database(legacy, {
            readonly: true,
            fileMustExist: true,
        });
        try {
            db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
        } finally {
            db.close();
        }
    } catch {
        for (const suffix of ['', '-wal', '-shm']) {
            if (existsSync(legacy + suffix)) {
                copyFileSync(legacy + suffix, target + suffix);
            }
        }
    }
    return 'copied';
}
