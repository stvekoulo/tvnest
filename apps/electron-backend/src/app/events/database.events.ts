// Pont IPC Electron pour les opérations de base de données.
import { ipcMain } from 'electron';

import './database/catalog-filter.events';
import './database/category.events';
import './database/content.events';
import './database/downloads.events';
import './database/epg-db.events';
import './database/favorites.events';
import './database/playback-position.events';
import './database/playlist.events';
import './database/recently-viewed.events';
import './database/recordings.events';
import './database/tmdb.events';
import './database/vod-sources.events';
import './database/xtream.events';

export default class DatabaseEvents {
    static bootstrapDatabaseEvents(): Electron.IpcMain {
        return ipcMain;
    }
}
