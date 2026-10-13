const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

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

// Spec drafts and user templates are each stored as one JSON file per item in userData/<collection>/.
for (const collection of ['specs', 'templates']) {
  const dir = () => path.join(app.getPath('userData'), collection);

  ipcMain.handle(`${collection}:list`, async () => {
    await fs.mkdir(dir(), { recursive: true });
    const files = (await fs.readdir(dir())).filter((f) => f.endsWith('.json'));
    const items = [];
    for (const file of files) {
      try {
        items.push(JSON.parse(await fs.readFile(path.join(dir(), file), 'utf8')));
      } catch {
        // Skip unreadable or corrupt files rather than failing the whole list.
      }
    }
    return items;
  });

  ipcMain.handle(`${collection}:save`, async (_e, item) => {
    await fs.mkdir(dir(), { recursive: true });
    await fs.writeFile(path.join(dir(), `${safeId(item.id)}.json`), JSON.stringify(item, null, 2));
    return true;
  });

  ipcMain.handle(`${collection}:delete`, async (_e, id) => {
    await fs.rm(path.join(dir(), `${safeId(id)}.json`), { force: true });
    return true;
  });
}

ipcMain.handle('file:saveText', async (e, { defaultName, content, filters }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
});

ipcMain.handle('file:openJson', async (e, filterName) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: typeof filterName === 'string' ? filterName : 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return null;
  return fs.readFile(filePaths[0], 'utf8');
});

// --- AI review -------------------------------------------------------------
// The API key lives only in the main process. The renderer can set or clear it
// but never read it back.

const MODEL = 'claude-opus-5-5';
const keyFile = () => path.join(app.getPath('userData'), 'anthropic-key.bin');

async function readSavedKey() {
  try {
    const buf = await fs.readFile(keyFile());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
  } catch {
    return null;
  }
}

async function aiStatus() {
  // Without an OS keychain (e.g. some Linux setups) the key is stored unencrypted; tell the user.
  const encrypted = safeStorage.isEncryptionAvailable();
  if (await readSavedKey()) return { configured: true, source: 'saved', encrypted };
  if (process.env.ANTHROPIC_API_KEY) return { configured: true, source: 'env', encrypted };
  return { configured: false, source: null, encrypted };
}

ipcMain.handle('ai:status', aiStatus);

ipcMain.handle('ai:setKey', async (_e, key) => {
  const trimmed = String(key ?? '').trim();
  if (!trimmed) return aiStatus();
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(trimmed) : Buffer.from(trimmed, 'utf8');
  await fs.writeFile(keyFile(), data, { mode: 0o600 });
  return aiStatus();
});

ipcMain.handle('ai:clearKey', async () => {
  await fs.rm(keyFile(), { force: true });
  return aiStatus();
});

ipcMain.handle('ai:complete', async (_e, { system, prompt, schema }) => {
  const sdk = require('@anthropic-ai/sdk');
  const Anthropic = sdk.default ?? sdk;
  const saved = await readSavedKey();
  try {
    // With no saved key the SDK falls back to ANTHROPIC_API_KEY and other standard credentials.
    const client = saved ? new Anthropic({ apiKey: saved }) : new Anthropic();
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      return { ok: false, error: 'Claude declined to review this spec. Try rewording the sensitive parts.' };
    }
    if (message.stop_reason === 'max_tokens') {
      return { ok: false, error: 'The review was cut off before it finished. Try again.' };
    }
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return { ok: true, text, model: message.model };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: 'Invalid or missing API key. Add a key in AI settings.' };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: 'Rate limited by the Anthropic API. Wait a moment and try again.' };
    }
    if (err instanceof Anthropic.APIError && err.status) {
      return { ok: false, error: `Anthropic API error ${err.status}: ${err.message}` };
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return { ok: false, error: 'Could not reach the Anthropic API. Check your internet connection.' };
    }
    if (err instanceof Anthropic.AnthropicError && /api ?key|auth/i.test(err.message)) {
      return { ok: false, error: 'No API key found. Add one in AI settings.' };
    }
    return { ok: false, error: String(err?.message ?? err) };
  }
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
