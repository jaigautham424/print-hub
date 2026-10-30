const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let serverModule;
let serverStarted = false;

// Safety net: catch any uncaught exception to prevent crash dialog
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  try { mainWindow?.webContents.send('server-status', { running: false, error: err.message }); } catch (_) {}
});

// Safety net: catch any unhandled promise rejection
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  try { mainWindow?.webContents.send('server-status', { running: false, error: err.message }); } catch (_) {}
});
let isQuitting = false;

function getServer() {
  if (!serverModule) serverModule = require('../server/index');
  return serverModule;
}

function createWindow() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  const hasIcon = fs.existsSync(iconPath);

  const windowOpts = {
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  };

  if (hasIcon) windowOpts.icon = iconPath;

  mainWindow = new BrowserWindow(windowOpts);

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const frontendPath = path.join(__dirname, '../../release/frontend/index.html');
    if (fs.existsSync(frontendPath)) {
      mainWindow.loadFile(frontendPath);
    } else {
      mainWindow.loadURL('data:text/html,<html><body style="background:#0f172a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h1>Print Hub</h1><p>Frontend not built. Run: npm run build:renderer</p></div></body></html>');
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function tryStartServer() {
  const srv = getServer();
  if (srv.isRunning()) {
    serverStarted = true;
    return;
  }
  await srv.startServer(mainWindow);
  serverStarted = true;
}

async function tryStopServer() {
  const srv = getServer();
  if (!srv.isRunning()) {
    serverStarted = false;
    return;
  }
  await srv.stopServer();
  serverStarted = false;
}

app.whenReady().then(async () => {
  createWindow();
  try {
    const srv = getServer();

    let autoStart = true;
    try {
      const { initializeDatabase, queryOne } = require('../database/schema');
      await initializeDatabase();
      const setting = queryOne("SELECT value FROM settings WHERE key = 'auto_start_server'");
      if (setting && setting.value === 'false') autoStart = false;
    } catch (e) {}

    if (autoStart) {
      await tryStartServer();
      const port = srv.getPort();
      mainWindow?.webContents.send('server-status', { running: true, port });
    } else {
      mainWindow?.webContents.send('server-status', { running: false });
    }
  } catch (err) {
    console.error('Server start error:', err);
    serverStarted = false;
    const msg = err.code === 'EADDRINUSE'
      ? 'Port range exhausted. Close other instances or change port in Settings.'
      : err.message;
    mainWindow?.webContents.send('server-status', { running: false, error: msg });
  }
});

ipcMain.handle('server-start', async () => {
  try {
    await tryStartServer();
    const port = getServer().getPort();
    mainWindow?.webContents.send('server-status', { running: true, port });
    return { running: true, message: 'Server started', port };
  } catch (err) {
    serverStarted = false;
    const msg = err.code === 'EADDRINUSE'
      ? 'Port is in use by another process.'
      : err.message;
    return { running: false, message: msg };
  }
});

ipcMain.handle('server-stop', async () => {
  try {
    await tryStopServer();
    mainWindow?.webContents.send('server-status', { running: false });
    return { running: false, message: 'Server stopped' };
  } catch (err) {
    return { running: false, message: err.message };
  }
});

ipcMain.handle('server-restart', async () => {
  try {
    await tryStopServer();
    await tryStartServer();
    const port = getServer().getPort();
    mainWindow?.webContents.send('server-status', { running: true, port });
    return { running: true, message: 'Server restarted', port };
  } catch (err) {
    serverStarted = false;
    mainWindow?.webContents.send('server-status', { running: false, error: err.message });
    return { running: false, message: err.message };
  }
});

ipcMain.handle('get-server-status', () => {
  const srv = getServer();
  const running = srv.isRunning();
  return { running, port: srv.getPort() };
});

ipcMain.handle('get-server-url', () => {
  const srv = getServer();
  return `http://localhost:${srv.getPort()}`;
});

app.on('before-quit', () => {
  isQuitting = true;
  if (serverStarted) {
    tryStopServer().catch(() => {});
    serverStarted = false;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

ipcMain.handle('print-page', async () => {
  if (!mainWindow) throw new Error('No window');
  const webContents = mainWindow.webContents;
  return new Promise((resolve, reject) => {
    webContents.print(
      { silent: false, printBackground: true },
      (success, failureReason) => {
        if (success) resolve({ success: true });
        else reject(new Error(failureReason || 'Print failed'));
      }
    );
  });
});
