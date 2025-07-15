const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');


const store = new Store();

function createMainWindow() {
  
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    // --- ADD THIS LINE ---
    // This sets the icon for the window. 
    // It assumes you have a 'build' folder in your project's root with 'icon.png' inside.
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  
  const isMac = process.platform === 'darwin';

  const menuTemplate = [
    
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
    
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    
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

  
  mainWindow.loadFile('index.html');

  
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




ipcMain.handle('electron-store-get', async (event, key) => {
  return store.get(key);
});
ipcMain.handle('electron-store-set', async (event, key, val) => {
  store.set(key, val);
});



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

ipcMain.handle('create-details-window', (event, { details, title }) => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        title: title,
        // --- ADD THIS LINE HERE TOO ---
        // So your detail windows also get the icon
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    
    win.loadFile('details.html');

    
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('details-data', details);
    });
});
