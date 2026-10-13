// Start the Vite dev server on any free port, then launch Electron pointed at it.
// Replaces a fixed port so another dev server on 5173 doesn't block the app.
import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

const server = await createServer();
await server.listen();
server.printUrls();

const url = server.resolvedUrls?.local[0];
if (!url) {
  console.error('Vite did not report a local URL.');
  await server.close();
  process.exit(1);
}

// Extra arguments pass through to Electron: npm run dev -- --inspect
const electron = spawn(electronPath, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

electron.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => electron.kill(signal));
}
