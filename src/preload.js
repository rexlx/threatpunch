

const { contextBridge, ipcRenderer } = require('electron');



contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  store: {
    get: (key) => ipcRenderer.invoke('electron-store-get', key),
    set: (key, val) => ipcRenderer.invoke('electron-store-set', key, val),
  },
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),
  createDetailsWindow: (data) => ipcRenderer.invoke('create-details-window', data),
  
  onReceiveDetails: (callback) => ipcRenderer.on('details-data', (event, data) => callback(data)),
});
