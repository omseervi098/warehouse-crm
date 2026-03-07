import { app } from 'electron';
import path from 'path';
import { isDev } from './utils.js';

export function getPreloadPath() {
    return path.join(
        app.getAppPath(),
        isDev() ? '.' : '..',
        '/dist-electron/preload.cjs'
    );
}

export function getUIPath() {
    return path.join(app.getAppPath(), '/dist-react/index.html')
}

export function getAssetsPath() {
    return path.join(app.getAppPath(), isDev() ? '.' : '..', '/src/assets');
}


export function getPdfPreviewPreloadPath() {
    return path.join(
        app.getAppPath(),
        isDev() ? '.' : '..',
        '/dist-electron/pdfPreviewPreload.cjs'
    );
}