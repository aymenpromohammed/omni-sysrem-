const { app, BrowserWindow, screen, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Crucial: Set the safe SQLite database path inside the system's safe userData folder
// before importing/loading the backend server so it initializes in the right place!
const userDataPath = app.getPath('userData');
const dbDir = path.join(userDataPath, 'data');
const dbPath = path.join(dbDir, 'pos.db');

// Ensure the local database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Seed database on first launch if it doesn't exist yet
if (!fs.existsSync(dbPath)) {
  const seedDbPath = path.join(__dirname, '../backend/server/data/pos.db');
  if (fs.existsSync(seedDbPath)) {
    try {
      fs.copyFileSync(seedDbPath, dbPath);
      console.log('Database successfully seeded on first launch!');
      
      // Also copy WAL files if they exist to keep state clean
      const seedWal = seedDbPath + '-wal';
      const destWal = dbPath + '-wal';
      if (fs.existsSync(seedWal)) {
        fs.copyFileSync(seedWal, destWal);
      }
      const seedShm = seedDbPath + '-shm';
      const destShm = dbPath + '-shm';
      if (fs.existsSync(seedShm)) {
        fs.copyFileSync(seedShm, destShm);
      }
    } catch (err) {
      console.error('Error seeding database:', err);
    }
  }
}

process.env.OMNISYSTEM_DB_PATH = dbPath;
process.env.NODE_ENV = 'production'; // Force production behaviors
process.env.PORT = '3000';

// Locate frontend build directory for static asset serving in packaged app
const possibleDistPaths = [
  path.join(__dirname, 'dist/public'),
  path.join(process.cwd(), 'dist/public'),
  path.join(__dirname, 'artifacts/pos-system/dist/public'),
  path.join(process.cwd(), 'artifacts/pos-system/dist/public'),
  path.join(__dirname, 'dist'),
  path.join(process.cwd(), 'dist'),
  path.join(__dirname, '../dist/public'),
  path.join(__dirname, '../../dist/public'),
];

for (const p of possibleDistPaths) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    process.env.FRONTEND_DIST = p;
    console.log('Detected frontend static dist path:', p);
    break;
  }
}

const backendServer = require('../backend/server');
const startServer = backendServer.startServer || backendServer.default || backendServer;

let mainWindow;

function setupDownloadHandler() {
  if (!session || !session.defaultSession) return;
  session.defaultSession.on('will-download', (event, item, webContents) => {
    try {
      const downloadsPath = app.getPath('downloads');
      const fileName = item.getFilename() || `download_${Date.now()}`;
      const savePath = path.join(downloadsPath, fileName);
      
      // If no custom path is prompted by user dialog, default to safe downloads folder
      if (!item.getSavePath()) {
        item.setSavePath(savePath);
      }

      item.on('updated', (evt, state) => {
        if (state === 'interrupted') {
          console.log('Download was interrupted');
        }
      });

      item.once('done', (evt, state) => {
        if (state === 'completed') {
          console.log('Download completed successfully:', item.getSavePath());
        } else {
          console.error(`Download failed state: ${state}`);
        }
      });
    } catch (err) {
      console.error('Error handling download item:', err);
    }
  });
}

async function createWindow() {
  // Start the backend server first
  try {
    if (typeof startServer === 'function') {
      await startServer(3000);
    }
  } catch (error) {
    console.error('Failed to start local Express server:', error);
  }

  setupDownloadHandler();

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1366, width),
    height: Math.min(850, height),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'نظام إدارة المبيعات والمخزون المتكامل - OmniSystem Pro',
    autoHideMenuBar: true,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'allow' };
  });

  // Load the local Express server url
  mainWindow.loadURL('http://127.0.0.1:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single Instance Lock to prevent multiple backend servers starting on port 3000
const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', () => {
    createWindow();
  });
}

// When all windows are closed, quit the app and exit process completely
app.on('window-all-closed', () => {
  app.quit();
  try {
    process.exit(0);
  } catch (e) {
    // ignore
  }
});

// Force terminate all background tasks/threads on quit
app.on('will-quit', () => {
  console.log('Desktop application exiting: terminating all background tasks.');
  try {
    process.exit(0);
  } catch (e) {
    // ignore
  }
});
