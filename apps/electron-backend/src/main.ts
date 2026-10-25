// Sélection du profil avant l'initialisation d'electron-conf.
import './app/services/electron-profile-bootstrap';
import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync } from 'fs';
import { resolve } from 'path';
import App from './app/app';
import PlaylistOpenEvents from './app/events/playlist-open.events';
import SquirrelEvents from './app/events/squirrel.events';
import {
    isPerformanceCaptureEnabled,
    isSqlStatementCountEnabled,
    isStartupTraceEnabled,
    performanceCounters,
    traceStartupPhase,
} from './app/services/debug-trace';
import { registerPerformanceCountersHandler } from './app/services/performance-counters';
import { countMainProcessSqlStatements } from './app/services/main-sql-statement-count';
import { readCompileCacheOutcome } from './app/services/compile-cache';
import { applyElectronNetworkDefaults } from './app/util/network-defaults';
import { registerStaticHeaderShims } from './app/services/request-header-overrides.service';
import WindowEvents from './app/events/window.events';
import { bootstrapWindowCloseGuard } from './app/services/window-close-guard.service';
import { environment } from './environments/environment';
import {
    createDeferredBootstrap,
    type DeferredBootstrap,
} from './app/startup/deferred-bootstrap';
import type {
    DeferredEventsHandles,
    DeferredEventsModule,
} from './app/startup/deferred-events';
import {
    isFrameCopyRuntimeUsable,
    shouldPromotePersistedFrameCopyOptIn,
} from './app/services/embedded-mpv-frame-copy-platform.util';
import { isEmbeddedMpvFeatureEnabled } from './app/services/embedded-mpv-runtime-policy.util';
import { runEmbeddedMpvRuntimeDiagnosticOrContinue } from './app/services/embedded-mpv-runtime-diagnostic';
import { acquireSingleInstanceLock } from './app/services/single-instance';
import {
    separateTvnestDatabase,
    separateTvnestProfile,
} from './app/services/tvnest-data-separation';
import {
    createPlaylistOpenRequest,
    extractPlaylistOpenRequestsFromArgv,
    playlistOpenRequests,
} from './app/services/playlist-open-request';
import { EMBEDDED_MPV_FRAME_COPY, store } from './app/services/store.service';

// Profil et base propres à TVNest (%APPDATA%\TVNest, ~/.tvnest) ; les données partagées
// avec IPTVnator jusqu'à la 1.0.2 sont copiées une seule fois, avant toute ouverture.
app.setName('TVNest');
separateTvnestProfile(app.getPath('appData'), app.getPath('userData'));
separateTvnestDatabase();

traceStartupPhase('compile-cache', () => readCompileCacheOutcome());
countMainProcessSqlStatements(
    performanceCounters,
    isSqlStatementCountEnabled()
);

applyElectronNetworkDefaults((line) => {
    if (isStartupTraceEnabled()) {
        console.log(`[TVNest Trace][startup] ${line}`);
    }
});

// Force X11 sous Linux lorsque la plateforme Ozone n'est pas explicite.
if (
    process.platform === 'linux' &&
    !app.commandLine.hasSwitch('ozone-platform') &&
    !process.env.ELECTRON_OZONE_PLATFORM_HINT
) {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
}

// Active par défaut le moteur libmpv frame-copy (WebGL2 canvas) s'il est disponible.
if (
    isEmbeddedMpvFeatureEnabled() &&
    shouldPromotePersistedFrameCopyOptIn(
        store.get(EMBEDDED_MPV_FRAME_COPY, true),
        process.env.IPTVNATOR_ENABLE_EMBEDDED_MPV_FRAME_COPY,
        isFrameCopyRuntimeUsable
    )
) {
    process.env.IPTVNATOR_ENABLE_EMBEDDED_MPV_FRAME_COPY = '1';
}

let deferredEvents: DeferredBootstrap<
    DeferredEventsModule,
    DeferredEventsHandles
> | null = null;

export default class Main {
    static initialize() {
        if (SquirrelEvents.handleEvents()) {
            app.quit();
        }
    }

    static bootstrapApp() {
        traceStartupPhase('bootstrap-app');
        App.main(app, BrowserWindow);
    }

    // Enregistre les canaux IPC critiques avant le premier rendu puis charge le reste.
    static async bootstrapAppEvents() {
        traceStartupPhase('bootstrap-events:start');
        registerPerformanceCountersHandler(
            ipcMain,
            performanceCounters,
            isPerformanceCaptureEnabled()
        );

        const windowCloseGuard = bootstrapWindowCloseGuard((listener) =>
            App.onMainWindowCreated(listener)
        );
        if (process.platform === 'win32') {
            app.setAppUserModelId('app.tvnest.desktop');
        }
        App.onMainWindowCreated((win) => {
            win.setTitle('TVNest');
            const candidates = [
                resolve(__dirname, '..', 'web', 'assets', 'icons', 'icon.ico'),
                resolve(__dirname, '..', 'web', 'assets', 'icons', 'icon.png'),
                resolve(process.cwd(), 'apps', 'web', 'public', 'assets', 'icons', 'icon.ico'),
            ];
            const found = candidates.find((p) => existsSync(p));
            if (found) win.setIcon(found);
        });
        registerStaticHeaderShims();
        WindowEvents.bootstrapWindowEvents();
        PlaylistOpenEvents.bootstrapPlaylistOpenEvents();

        const deferred = createDeferredBootstrap<
            DeferredEventsModule,
            DeferredEventsHandles
        >({
            load: () =>
                import(
                    /* webpackChunkName: "deferred-events" */ './app/startup/deferred-events.js'
                ),
            run: (module) =>
                module.bootstrapDeferredEvents({
                    appVersion: environment.version,
                    windowCloseGuard,
                }),
            onTrigger: (source) => {
                traceStartupPhase('deferred-events:start', () => ({ source }));
            },
            onDone: (durationMs) => {
                traceStartupPhase('deferred-events:done', () => ({
                    durationMs,
                }));
            },
            onError: (error) => {
                console.error(
                    'Deferred main-process startup failed:',
                    error
                );
                traceStartupPhase('deferred-events:failed', () => error);
            },
        });
        deferredEvents = deferred;
        deferred.armOn(App.mainWindow?.webContents);

        const loadingMainWindow = App.loadMainWindow();
        void loadingMainWindow
            .catch(() => undefined)
            .then(() => deferred.trigger())
            .catch(() => undefined);
        await loadingMainWindow;
        const { module, result } = await deferred.trigger();
        void result.appUpdateService.checkForUpdatesOnStartup();

        await module.finishStartupAfterFirstLoad();
        traceStartupPhase('bootstrap-events:done');
        module.scheduleDeferredFixPath();
    }
}

runEmbeddedMpvRuntimeDiagnosticOrContinue(process.argv, () => {
    app.on('open-file', (event, filePath) => {
        event.preventDefault();
        playlistOpenRequests.enqueue(createPlaylistOpenRequest(filePath));
    });

    playlistOpenRequests.enqueueAll(
        extractPlaylistOpenRequestsFromArgv(process.argv)
    );

    Main.initialize();

    if (
        !acquireSingleInstanceLock(
            app,
            () => App.mainWindow,
            () => App.ensureMainWindow(),
            {
                onSecondInstance: (argv, workingDirectory) => {
                    playlistOpenRequests.enqueueAll(
                        extractPlaylistOpenRequestsFromArgv(
                            argv,
                            workingDirectory
                        )
                    );
                },
            }
        )
    ) {
        return;
    }

    Main.bootstrapApp();

    app.whenReady().then(async () => {
        traceStartupPhase('app.whenReady');
        await Main.bootstrapAppEvents();
    });

    app.on('will-quit', () => {
        deferredEvents?.module?.shutdownDeferredServices();
    });
});
