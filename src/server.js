import { config } from './config.js';
import { openDatabase } from './db/index.js';
import { createApp } from './app.js';
import { createShutdown } from './shutdown.js';

const db = openDatabase(config.dbPath);
const app = createApp({
  db,
  now: () => new Date(),
  fetch: globalThis.fetch,
  openAlexMailto: config.openAlexMailto,
  commit: config.commit ?? null,
  // Render sits behind one proxy; without this every client shares its IP.
  trustProxy: config.trustProxyHops ?? (config.nodeEnv === 'production' ? 1 : 0),
});

const server = app.listen(config.port, () => {
  console.log(`ResearchPath listening on http://localhost:${config.port}`);
});

const shutdown = createShutdown({ server, db });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
