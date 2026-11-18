// Initialisation précoce du profil TVNest avant toute lecture d'electron-conf ou du cache V8.
import { app } from 'electron';
import { mkdirSync } from 'fs';
import { getElectronUserDataPath } from '@iptvnator/shared/database';
import {
    separateTvnestDatabase,
    separateTvnestProfile,
} from './tvnest-data-separation';

let initialized = false;

export function ensureTvnestEarlyInit(): void {
    if (initialized) return;
    initialized = true;

    app.setName('TVNest');
    if (process.platform === 'win32') {
        app.setAppUserModelId('app.tvnest.desktop');
    }

    const override = getElectronUserDataPath();
    if (override) {
        app.setPath('userData', override);
    }

    const userData = app.getPath('userData');
    mkdirSync(userData, { recursive: true });
    separateTvnestProfile(app.getPath('appData'), userData);
    separateTvnestDatabase();
}

ensureTvnestEarlyInit();
