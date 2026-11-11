import { config } from './config.js';
import { openDatabase } from './db/index.js';
import { createApp } from './app.js';

const db = openDatabase(config.dbPath);
const app = createApp({ db, now: () => new Date() });

app.listen(config.port, () => {
  console.log(`ResearchPath listening on http://localhost:${config.port}`);
});
