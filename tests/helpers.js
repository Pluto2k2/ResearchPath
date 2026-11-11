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

// ---- M09 research news helpers (node tests only: this file loads src/app.js) ----

// Mutable clock: tests move time by hand and `wait` advances it, so nothing sleeps.
export function createFakeClock(startIso = `${TODAY}T12:00:00Z`) {
  let ms = new Date(startIso).getTime();
  return {
    now: () => new Date(ms),
    advance(by) {
      ms += by;
    },
    set(to) {
      ms = new Date(to).getTime();
    },
  };
}

// `clock` is a createFakeClock() result; `wait` defaults to advancing it.
export function createNewsTestApp({ fetch, wait, clock = createFakeClock(), openAlexMailto, trustProxy, commit } = {}) {
  return createApp({
    db: openDatabase(':memory:'),
    now: clock.now,
    fetch,
    wait: wait ?? (async (ms) => clock.advance(ms)),
    openAlexMailto,
    trustProxy,
    commit,
  });
}

export const okText = (text) => ({ ok: true, status: 200, text: async () => text });
export const failStatus = (status) => ({ ok: false, status, text: async () => 'UPSTREAM SECRET BODY' });

export function atomEntry({
  id = '2611.01234v2',
  published = '2026-11-09T17:59:59Z',
  title = 'A title',
  summary = 'A summary',
  authors = ['Ada Lovelace'],
  primary = 'cs.LG',
  categories = ['cs.LG'],
  rawId,
} = {}) {
  return `<entry>
    ${id === null ? '' : `<id>${rawId ?? `http://arxiv.org/abs/${id}`}</id>`}
    ${published === null ? '' : `<published>${published}</published>`}
    ${title === null ? '' : `<title>${title}</title>`}
    <summary>${summary}</summary>
    ${authors.map((a) => `<author><name>${a}</name></author>`).join('')}
    ${primary ? `<arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="${primary}"/>` : ''}
    ${categories.map((c) => `<category term="${c}"/>`).join('')}
  </entry>`;
}

export const atomFeed = (entries = []) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>arXiv Query</title>${entries.join('\n')}</feed>`;
