// main.js - Main Process

const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize the store in the main process
const store = new Store();

function createMainWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Attach the preload script
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // --- Create the Application Menu ---
  const isMac = process.platform === 'darwin';

  const menuTemplate = [
    // { role: 'appMenu' } (on macOS)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // --- THIS IS THE FIX FOR THE PASTE ISSUE ---
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        {
          label: 'Services',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('navigate', 'services');
          }
        },
        {
          label: 'Profile',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('navigate', 'profile');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers ---

// IPC for the Store
ipcMain.handle('electron-store-get', async (event, key) => {
  return store.get(key);
});
ipcMain.handle('electron-store-set', async (event, key, val) => {
  store.set(key, val);
});


// IPC for saving files
ipcMain.handle('save-file', async (event, { filename, content }) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (filePath) {
    const fs = require('fs');
    fs.writeFileSync(filePath, content);
    return { success: true, path: filePath };
  } else {
    return { success: false };
  }
});

// IPC for creating new windows
ipcMain.handle('create-window', (event, { url, title }) => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        title: title,
        webPreferences: {
            contextIsolation: true,
        }
    });
    win.loadURL(url);
});
