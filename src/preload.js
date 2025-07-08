// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  createWindow: (data) => ipcRenderer.invoke('create-window', data),
  store: {
    get: (key) => ipcRenderer.invoke('electron-store-get', key),
    set: (key, val) => ipcRenderer.invoke('electron-store-set', key, val),
  },
  // Listen for navigation events from the main process menu
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),
});
