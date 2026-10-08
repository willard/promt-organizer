const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const specsDir = () => path.join(app.getPath('userData'), 'specs');
const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Prompt Organizer',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links in the user's browser instead of inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.handle('specs:list', async () => {
  await fs.mkdir(specsDir(), { recursive: true });
  const files = (await fs.readdir(specsDir())).filter((f) => f.endsWith('.json'));
  const specs = [];
  for (const file of files) {
    try {
      specs.push(JSON.parse(await fs.readFile(path.join(specsDir(), file), 'utf8')));
    } catch {
      // Skip unreadable or corrupt drafts rather than failing the whole list.
    }
  }
  return specs;
});

ipcMain.handle('specs:save', async (_e, spec) => {
  await fs.mkdir(specsDir(), { recursive: true });
  await fs.writeFile(path.join(specsDir(), `${safeId(spec.id)}.json`), JSON.stringify(spec, null, 2));
  return true;
});

ipcMain.handle('specs:delete', async (_e, id) => {
  await fs.rm(path.join(specsDir(), `${safeId(id)}.json`), { force: true });
  return true;
});

ipcMain.handle('file:saveText', async (e, { defaultName, content, filters }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
});

ipcMain.handle('file:openJson', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Spec draft', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return null;
  return fs.readFile(filePaths[0], 'utf8');
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
