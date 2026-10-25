// Assemblage modulaire du pont contextBridge `window.electron` pour TVNest.
import type { ElectronBridgeApi } from '@iptvnator/shared/interfaces';
import {
    WINDOW_GET_ZOOM_LEVEL,
    WINDOW_ZOOM_LEVEL_APPLIED,
} from '@iptvnator/shared/interfaces/ipc-commands';
import { contextBridge, ipcRenderer } from 'electron';
import {
    DEBUG_TRACE_EVENT_CHANNEL,
    isPerformanceCaptureEnabled,
    isRendererApiTraceEnabled,
    roundTraceDuration,
    summarizeForTrace,
} from '../services/debug-trace';
import {
    preloadCatalogFilterApi,
    preloadDatabaseCoreApi,
} from './preload-database.api';
import { preloadDownloadsApi } from './preload-downloads.api';
import {
    createPreloadPerformanceCapture,
    toPreloadPerformanceTargetMethod,
} from './preload-performance-capture';
import { preloadPlayerEpgApi } from './preload-player-epg.api';
import {
    frameZoomPorts,
    preloadWindowEventsApi,
} from './preload-window-events.api';
import { applyPersistedZoomLevel } from './preload-zoom-level';
import {
    createXtreamPreloadPerformanceCapture,
    isXtreamPreloadPerformanceCaptureEnabled,
    toXtreamPreloadPerformanceTargetMethod,
} from './xtream-preload-performance-capture';

const shouldTraceRendererApi = isRendererApiTraceEnabled();
const shouldCapturePerformance = isPerformanceCaptureEnabled();
const shouldCaptureXtreamPerformance =
    isXtreamPreloadPerformanceCaptureEnabled();
const preloadPerformanceCapture = createPreloadPerformanceCapture(
    shouldCapturePerformance,
    (channel, marker) => ipcRenderer.send(channel, marker)
);
const xtreamPreloadPerformanceCapture = shouldCaptureXtreamPerformance
    ? createXtreamPreloadPerformanceCapture(true, (channel, marker) =>
          ipcRenderer.send(channel, marker)
      )
    : null;

function emitRendererTrace(payload: {
    method: string;
    phase: 'start' | 'success' | 'error';
    args?: unknown;
    durationMs?: number;
    error?: unknown;
    result?: unknown;
}): void {
    if (shouldTraceRendererApi) {
        ipcRenderer.send(DEBUG_TRACE_EVENT_CHANNEL, payload);
    }
}

function wrapElectronApi<T extends object>(api: T): T {
    if (!shouldTraceRendererApi && !shouldCapturePerformance) {
        return api;
    }

    return Object.fromEntries(
        Object.entries(api).map(([name, value]) => {
            const isPerfTarget = toPreloadPerformanceTargetMethod(name) !== null;
            const isXtreamTarget =
                shouldCaptureXtreamPerformance &&
                toXtreamPreloadPerformanceTargetMethod(name) !== null;
            if (
                typeof value !== 'function' ||
                name.startsWith('on') ||
                name.startsWith('remove') ||
                (!shouldTraceRendererApi && !isPerfTarget && !isXtreamTarget)
            ) {
                return [name, value];
            }

            const original = value as (...args: unknown[]) => unknown;
            return [
                name,
                (...args: unknown[]) => {
                    const startedAt = shouldTraceRendererApi
                        ? (globalThis.performance?.now?.() ?? Date.now())
                        : 0;
                    if (shouldTraceRendererApi) {
                        emitRendererTrace({
                            args: summarizeForTrace(args),
                            method: name,
                            phase: 'start',
                        });
                    }
                    const perfCall = preloadPerformanceCapture.start(name, args);
                    const xtreamCall =
                        xtreamPreloadPerformanceCapture?.start(name, args) ?? null;

                    try {
                        const result = original(...args);
                        if (
                            result &&
                            typeof (result as PromiseLike<unknown>).then === 'function'
                        ) {
                            return (result as Promise<unknown>)
                                .then((resolved) => {
                                    if (shouldTraceRendererApi) {
                                        emitRendererTrace({
                                            durationMs: roundTraceDuration(
                                                (globalThis.performance?.now?.() ?? Date.now()) -
                                                    startedAt
                                            ),
                                            method: name,
                                            phase: 'success',
                                            result: summarizeForTrace(resolved),
                                        });
                                    }
                                    preloadPerformanceCapture.success(perfCall, resolved);
                                    xtreamPreloadPerformanceCapture?.success(xtreamCall);
                                    return resolved;
                                })
                                .catch((error: unknown) => {
                                    if (shouldTraceRendererApi) {
                                        emitRendererTrace({
                                            durationMs: roundTraceDuration(
                                                (globalThis.performance?.now?.() ?? Date.now()) -
                                                    startedAt
                                            ),
                                            error: summarizeForTrace(error),
                                            method: name,
                                            phase: 'error',
                                        });
                                    }
                                    preloadPerformanceCapture.error(perfCall);
                                    xtreamPreloadPerformanceCapture?.error(xtreamCall);
                                    throw error;
                                });
                        }

                        if (shouldTraceRendererApi) {
                            emitRendererTrace({
                                durationMs: roundTraceDuration(
                                    (globalThis.performance?.now?.() ?? Date.now()) - startedAt
                                ),
                                method: name,
                                phase: 'success',
                                result: summarizeForTrace(result),
                            });
                        }
                        preloadPerformanceCapture.success(perfCall, result);
                        xtreamPreloadPerformanceCapture?.success(xtreamCall);
                        return result;
                    } catch (error) {
                        if (shouldTraceRendererApi) {
                            emitRendererTrace({
                                durationMs: roundTraceDuration(
                                    (globalThis.performance?.now?.() ?? Date.now()) - startedAt
                                ),
                                error: summarizeForTrace(error),
                                method: name,
                                phase: 'error',
                            });
                        }
                        preloadPerformanceCapture.error(perfCall);
                        xtreamPreloadPerformanceCapture?.error(xtreamCall);
                        throw error;
                    }
                },
            ];
        })
    ) as T;
}

const baseElectronApi: ElectronBridgeApi = {
    ...preloadWindowEventsApi,
    ...preloadPlayerEpgApi,
    ...preloadDatabaseCoreApi,
    ...preloadDownloadsApi,
};

const electronApi = {
    ...baseElectronApi,
    ...preloadCatalogFilterApi,
};

// Restaure le niveau de zoom du frame web une fois le document analysé.
applyPersistedZoomLevel({
    requestPersistedZoomLevel: () => ipcRenderer.sendSync(WINDOW_GET_ZOOM_LEVEL),
    ...frameZoomPorts,
    whenDocumentParsed: (apply) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', apply, { once: true });
        } else {
            apply();
        }
    },
    notifyApplied: () => ipcRenderer.send(WINDOW_ZOOM_LEVEL_APPLIED),
});

contextBridge.exposeInMainWorld('electron', wrapElectronApi(electronApi));
