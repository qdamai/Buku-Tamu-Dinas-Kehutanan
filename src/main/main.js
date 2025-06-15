const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Tentukan path data berdasarkan mode development atau production
const isDev = !app.isPackaged;
const dataDir = isDev 
  ? path.join(__dirname, '../../data')
  : path.join(process.resourcesPath, 'data');

// Log untuk debugging
console.log('App is packaged:', app.isPackaged);
console.log('App path:', app.getAppPath());
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

// Pastikan direktori data ada
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory:', dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
}

// Pastikan file data-tamu.json ada
const dataFile = path.join(dataDir, 'data-tamu.json');
if (!fs.existsSync(dataFile)) {
  console.log('Creating data file:', dataFile);
  fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
}

let mainWindow;

function createWindow() {
  console.log('Creating main window...');
  
  // Tentukan path untuk file HTML dan preload
  const htmlPath = isDev 
    ? path.join(__dirname, '../renderer/index.html')
    : path.join(process.resourcesPath, 'src/renderer/index.html');
  
  const preloadPath = isDev
    ? path.join(__dirname, '../../preload.js')
    : path.join(process.resourcesPath, 'preload.js');
  
  console.log('HTML path:', htmlPath);
  console.log('HTML exists:', fs.existsSync(htmlPath));
  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', fs.existsSync(preloadPath));

  if (!fs.existsSync(htmlPath)) {
    console.error('HTML file not found at:', htmlPath);
    return;
  }

  if (!fs.existsSync(preloadPath)) {
    console.error('Preload file not found at:', preloadPath);
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      devTools: true
    },
    icon: isDev 
      ? path.join(__dirname, '../../assets/icon.ico')
      : path.join(process.resourcesPath, 'icon.ico')
  });

  // Log untuk debugging
  console.log('Data directory:', dataDir);
  console.log('Data file:', dataFile);

  // Buka DevTools di mode development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Log ketika window siap
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });

  // Log error
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Log console dari renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('Renderer Console:', message);
  });

  // Load file HTML
  console.log('Loading HTML file...');
  mainWindow.loadFile(htmlPath).catch(err => {
    console.error('Error loading HTML:', err);
  });
}

// Pastikan app siap sebelum membuat window
app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createWindow();

  app.on('activate', () => {
    console.log('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-tamu', async () => {
  try {
    console.log('Reading data from:', dataFile);
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    throw new Error('Gagal membaca data tamu');
  }
});

ipcMain.handle('add-tamu', async (event, tamu) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    tamu.id = Date.now().toString();
    data.push(tamu);
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    return tamu;
  } catch (error) {
    console.error('Error adding tamu:', error);
    throw new Error('Gagal menambahkan data tamu: ' + error.message);
  }
});

ipcMain.handle('update-tamu', async (event, tamu) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const index = data.findIndex(t => t.id === tamu.id);
    if (index !== -1) {
      data[index] = tamu;
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
      return tamu;
    }
    throw new Error('Data tamu tidak ditemukan');
  } catch (error) {
    console.error('Error updating tamu:', error);
    throw new Error('Gagal memperbarui data tamu: ' + error.message);
  }
});

ipcMain.handle('delete-tamu', async (event, id) => {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const filteredData = data.filter(t => t.id !== id);
    fs.writeFileSync(dataFile, JSON.stringify(filteredData, null, 2));
    return true;
  } catch (error) {
    console.error('Error deleting tamu:', error);
    throw new Error('Gagal menghapus data tamu');
  }
});

ipcMain.handle('export-csv', async (event, content, fileName) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Simpan File CSV',
      defaultPath: fileName,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    
    if (filePath) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw new Error('Gagal mengekspor CSV');
  }
});

ipcMain.handle('export-pdf', async () => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Simpan File PDF',
      defaultPath: `buku-tamu-${new Date().toISOString().split('T')[0]}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    
    if (filePath) {
      await mainWindow.webContents.printToPDF({
        printBackground: true,
        landscape: true
      }).then(data => {
        fs.writeFileSync(filePath, data);
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('Gagal mengekspor PDF');
  }
});

ipcMain.handle('show-notification', (event, title, message) => {
  new Notification({
    title,
    body: message
  }).show();
}); 