import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRateLimiter } from './middleware/rate-limit.js';
import { healthRouter } from './routes/health.js';
import { milestonesRouter } from './routes/milestones.js';
import { progressRouter } from './routes/progress.js';
import { eventsRouter } from './routes/events.js';
import { upcomingRouter } from './routes/upcoming.js';
import { newsRouter } from './routes/news.js';
import { createNewsService } from './news/service.js';

// Resolved from this file, not the cwd, so it works wherever the server starts.
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

// package.json is the single source of the version; not an env read.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Body-parser errors keep their own status instead of turning into a 500.
const BODY_ERRORS = {
  'entity.parse.failed': { status: 400, error: 'Invalid JSON' },
  'entity.too.large': { status: 413, error: 'Request body is too large' },
  'charset.unsupported': { status: 415, error: 'Unsupported charset' },
  'encoding.unsupported': { status: 415, error: 'Unsupported content encoding' },
  'request.aborted': { status: 400, error: 'Request aborted' },
  'request.size.invalid': {
    status: 400,
    error: 'Request size did not match content length',
  },
};

// Express recognises error middleware by its 4 arguments, so `next` must stay.
export function errorHandler(err, req, res, next) {
  // Too late to send a JSON error; let Express close the connection.
  if (res.headersSent) return next(err);

  const known = BODY_ERRORS[err.type];
  if (known) return res.status(known.status).json({ error: known.error });

  // Fixed message: err.message from a 4xx may contain client-controlled text.
  const status = err.status ?? err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status <= 499) {
    return res.status(status).json({ error: 'Invalid request' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// fetch and wait are injected so tests never use the network or really sleep.
export function createApp({
  db,
  now,
  fetch,
  wait = defaultWait,
  openAlexMailto,
  commit = null,
  trustProxy = false,
}) {
  const app = express();
  // true means one hop; a number is the hop count (Render's edge may add more
  // than one, so check req.ips after deploy).
  const hops = trustProxy === true ? 1 : trustProxy;
  app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : false);
  app.locals.version = version;
  app.locals.commit = commit;
  // Kept here so future routers can read them without changing the signature.
  app.locals.db = db;
  app.locals.now = now;
  app.locals.news = createNewsService({ fetch, now, wait, mailto: openAlexMailto });

  // Before the body parser, so bad or huge bodies are counted and 429s stay cheap.
  app.use('/api/news', createRateLimiter({ now }));
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api', milestonesRouter);
  app.use('/api', progressRouter);
  app.use('/api', eventsRouter);
  app.use('/api', upcomingRouter);
  app.use('/api', newsRouter);
  app.use('/api', notFoundHandler);
  app.use(express.static(publicDir));
  app.use(errorHandler);
  return app;
}
