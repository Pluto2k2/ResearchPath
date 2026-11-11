import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createNewsTestApp, createTestApp, createFakeClock } from './helpers.js';
import { loadConfig } from '../src/config.js';
import { createShutdown } from '../src/shutdown.js';

const noFetch = () => {
  throw new Error('no real network in tests');
};
const app = (options = {}) => createNewsTestApp({ clock: createFakeClock(), fetch: noFetch, ...options });
const getNews = (a, xff) => {
  const r = request(a).get('/api/news/x');
  return xff ? r.set('X-Forwarded-For', xff) : r;
};
async function fill(a, n, xff) {
  for (let i = 0; i < n; i += 1) await getNews(a, xff);
}

describe('M10 limiter runs before body parsing', () => {
  it('answers 429, not 400, to invalid JSON once the budget is used', async () => {
    const a = app();
    await fill(a, 30);
    const res = await request(a)
      .post('/api/news/topics')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(429);
  });

  it('answers 429, not 413, to an oversized body once the budget is used', async () => {
    const a = app();
    await fill(a, 30);
    const res = await request(a)
      .post('/api/news/topics')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ x: 'x'.repeat(102_400) }));
    expect(res.status).toBe(429);
  });

  it('counts bad-body requests toward the 30', async () => {
    const a = app();
    for (let i = 0; i < 30; i += 1) {
      const res = await request(a)
        .post('/api/news/topics')
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(res.status).toBe(400);
    }
    expect((await getNews(a)).status).toBe(429);
  });
});

describe('M10 TRUST_PROXY_HOPS config', () => {
  it('parses a non-negative integer', () => {
    expect(loadConfig({ TRUST_PROXY_HOPS: '2' }).trustProxyHops).toBe(2);
    expect(loadConfig({ TRUST_PROXY_HOPS: '0' }).trustProxyHops).toBe(0);
  });

  it.each([undefined, '', 'abc', '-1', '1.5'])('is undefined for %j', (v) => {
    const env = v === undefined ? {} : { TRUST_PROXY_HOPS: v };
    expect(loadConfig(env).trustProxyHops).toBeUndefined();
  });
});

describe('M10 trustProxy hop count in createApp', () => {
  it('keys the bucket on the second address from the right with trustProxy 2', async () => {
    const a = app({ trustProxy: 2 });
    await fill(a, 30, 'spoof1, client, proxy');
    expect((await getNews(a, 'spoof2, client, proxy')).status).toBe(429);
    expect((await getNews(a, 'spoof1, other, proxy')).status).toBe(404);
  });

  it.each([0, false])('shares one bucket with trustProxy %j', async (value) => {
    const a = app({ trustProxy: value });
    await fill(a, 30, '1.1.1.1');
    expect((await getNews(a, '2.2.2.2')).status).toBe(429);
  });
});

describe('M10 shutdown message', () => {
  it('uses timeoutMs in the forced-exit log', () => {
    let cb;
    const log = { log: vi.fn(), error: vi.fn() };
    const shutdown = createShutdown({
      server: { close: vi.fn() },
      db: { close: vi.fn() },
      exit: vi.fn(),
      setTimer: (f) => {
        cb = f;
        return { unref() {} };
      },
      timeoutMs: 5000,
      log,
    });
    shutdown('SIGTERM');
    cb();
    expect(log.error.mock.calls[0][0]).toContain('5 s');
  });
});

describe('M10 undecodable path parameter', () => {
  it('returns 400 Invalid request for PATCH /api/milestones/%E0/status', async () => {
    const res = await request(createTestApp()).patch('/api/milestones/%E0/status').send({ status: 'done' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
  });
});
