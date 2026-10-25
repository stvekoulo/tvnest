import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let fakeHome = '';
jest.mock('os', () => ({
    ...jest.requireActual('os'),
    homedir: () => fakeHome,
}));

import {
    separateTvnestDatabase,
    separateTvnestProfile,
} from './tvnest-data-separation';

function write(path: string, content: string): void {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
}

describe('tvnest-data-separation', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'tvnest-separation-'));
        fakeHome = join(root, 'home');
        delete process.env.IPTVNATOR_E2E_DATA_DIR;
        delete process.env.IPTVNATOR_DATA_DIR;
    });

    it('copies the site storage once from the shared IPTVnator profile and keeps the old one', () => {
        const appData = join(root, 'appdata');
        const userData = join(appData, 'TVNest');
        write(join(appData, 'IPTVnator', 'Local Storage', 'leveldb', '000.log'), 'shared');
        write(join(userData, 'Local Storage', 'leveldb', '000.log'), 'stale');

        separateTvnestProfile(appData, userData);

        expect(readFileSync(join(userData, 'Local Storage', 'leveldb', '000.log'), 'utf8')).toBe('shared');
        expect(
            readFileSync(join(userData, 'Local Storage.avant-separation', 'leveldb', '000.log'), 'utf8')
        ).toBe('stale');

        // Deuxième lancement : plus aucune copie, les profils sont indépendants.
        write(join(appData, 'IPTVnator', 'Local Storage', 'leveldb', '000.log'), 'changed in iptvnator');
        separateTvnestProfile(appData, userData);
        expect(readFileSync(join(userData, 'Local Storage', 'leveldb', '000.log'), 'utf8')).toBe('shared');
    });

    it('copies the shared database to ~/.tvnest once and never touches it afterwards', () => {
        const legacy = join(fakeHome, '.iptvnator', 'databases', 'iptvnator.db');
        write(legacy, 'not-a-real-sqlite-file');
        const target = join(fakeHome, '.tvnest', 'databases', 'tvnest.db');

        expect(separateTvnestDatabase()).toBe('copied');
        expect(existsSync(target)).toBe(true);

        expect(separateTvnestDatabase()).toBe('skipped');
        expect(existsSync(legacy)).toBe(true);
    });

    it('does nothing when there is no IPTVnator database', () => {
        expect(separateTvnestDatabase()).toBe('skipped');
    });
});
