import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/index.js';

export const TODAY = '2026-11-12';

// Fresh in-memory db and a frozen clock for every call.
export function createTestApp() {
  return createApp({
    db: openDatabase(':memory:'),
    now: () => new Date(`${TODAY}T12:00:00Z`),
  });
}
