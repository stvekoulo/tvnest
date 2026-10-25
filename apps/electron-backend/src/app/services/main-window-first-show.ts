// Affichage initial sans flash gris de la fenêtre principale TVNest.
export const MAIN_WINDOW_BACKGROUND_COLOR = '#040407';

type OnceEmitter = {
    once(event: string, listener: () => void): unknown;
    removeListener(event: string, listener: () => void): unknown;
};

export type FirstShowWindow = OnceEmitter & {
    isDestroyed(): boolean;
    readonly webContents: OnceEmitter;
};

// Affiche la fenêtre une seule fois à `ready-to-show` ou `did-finish-load`.
export function showMainWindowWhenLoaded(
    window: FirstShowWindow,
    show: () => void
): void {
    let shown = false;
    const showOnce = (): void => {
        if (shown) {
            return;
        }
        shown = true;
        window.removeListener('ready-to-show', showOnce);
        window.webContents.removeListener('did-finish-load', showOnce);
        if (!window.isDestroyed()) {
            show();
        }
    };
    window.once('ready-to-show', showOnce);
    window.webContents.once('did-finish-load', showOnce);
}
