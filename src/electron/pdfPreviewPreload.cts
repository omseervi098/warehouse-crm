import { contextBridge, ipcRenderer } from 'electron';

// This is specifically for the PDF preview window
contextBridge.exposeInMainWorld('pdfPreview', {
    download: (dataURL: string, fileName: string) => ipcRenderer.invoke('pdf:download', dataURL, fileName),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    close: () => ipcRenderer.invoke('window:close'),
});