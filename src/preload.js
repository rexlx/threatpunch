// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  store: {
    get: (key) => ipcRenderer.invoke('electron-store-get', key),
    set: (key, val) => ipcRenderer.invoke('electron-store-set', key, val),
  },
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),
  
  // --- New APIs for Details Window ---
  // API to request the creation of the details window
  createDetailsWindow: (data) => ipcRenderer.invoke('create-details-window', data),
  // API for the details window to listen for incoming data
  onReceiveDetails: (callback) => ipcRenderer.on('details-data', (event, data) => callback(data)),
});
