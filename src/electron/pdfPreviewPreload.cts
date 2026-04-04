import { contextBridge, ipcRenderer } from 'electron';

// This is specifically for the PDF preview window
contextBridge.exposeInMainWorld('pdfPreview', {
    ready: () => ipcRenderer.send('pdf-preview:ready'),
    onPdfData: (callback: (payload: { dataUri: string; fileName: string; platform: string }) => void) => {
        ipcRenderer.removeAllListeners('pdf-preview:data');
        ipcRenderer.on('pdf-preview:data', (_event, payload) => callback(payload));
    },
    download: (dataURL: string, fileName: string) => ipcRenderer.invoke('pdf:download', dataURL, fileName),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
});
