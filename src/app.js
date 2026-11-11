import express from 'express';
import { fileURLToPath } from 'node:url';
import { healthRouter } from './routes/health.js';
import { milestonesRouter } from './routes/milestones.js';
import { progressRouter } from './routes/progress.js';
import { eventsRouter } from './routes/events.js';
import { upcomingRouter } from './routes/upcoming.js';
import { newsRouter } from './routes/news.js';
import { createNewsService } from './news/service.js';

// Resolved from this file, not the cwd, so it works wherever the server starts.
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Express recognises error middleware by its 4 arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// fetch and wait are injected so tests never use the network or really sleep.
export function createApp({ db, now, fetch, wait = defaultWait, openAlexMailto }) {
  const app = express();
  // Kept here so future routers can read them without changing the signature.
  app.locals.db = db;
  app.locals.now = now;
  app.locals.news = createNewsService({ fetch, now, wait, mailto: openAlexMailto });

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
