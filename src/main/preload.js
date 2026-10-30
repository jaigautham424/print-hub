const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  startServer: () => ipcRenderer.invoke('server-start'),
  stopServer: () => ipcRenderer.invoke('server-stop'),
  restartServer: () => ipcRenderer.invoke('server-restart'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  onServerStatus: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('server-status', handler);
    return () => ipcRenderer.removeListener('server-status', handler);
  },
  printPage: () => ipcRenderer.invoke('print-page'),
});
