import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createNewsTestApp, createFakeClock } from './helpers.js';
import { createRateLimiter } from '../src/middleware/rate-limit.js';

const MESSAGE = 'Too many requests. Please try again in a minute.';

// An unknown /api/news path goes through the limiter and then 404s, so no upstream fetch is needed.
const hit = (app, path = '/api/news/x', ip) => {
  const req = request(app).get(path);
  return ip ? req.set('X-Forwarded-For', ip) : req;
};

async function hitMany(app, n, path, ip) {
  const statuses = [];
  for (let i = 0; i < n; i += 1) statuses.push((await hit(app, path, ip)).status);
  return statuses;
}

function setup(options = {}) {
  const clock = createFakeClock();
  const fetch = () => {
    throw new Error('no real network in tests');
  };
  return { clock, app: createNewsTestApp({ clock, fetch, ...options }) };
}

describe('M10 rate limit on /api/news/*', () => {
  it('lets 30 requests through', async () => {
    const { app } = setup();
    const statuses = await hitMany(app, 30);
    expect(statuses.every((s) => s !== 429)).toBe(true);
  });

  it('answers 429 with the exact message and Retry-After 60 on request 31', async () => {
    const { app } = setup();
    await hitMany(app, 30);
    const res = await hit(app);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: MESSAGE });
    expect(res.headers['retry-after']).toBe('60');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('counts down Retry-After as the fake clock advances', async () => {
    const { app, clock } = setup();
    await hitMany(app, 30);
    clock.advance(30_000);
    expect((await hit(app)).headers['retry-after']).toBe('30');
    clock.advance(29_500);
    const res = await hit(app);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('1');
  });

  it('accepts requests again once the 60 s window has passed', async () => {
    const { app, clock } = setup();
    await hitMany(app, 30);
    expect((await hit(app)).status).toBe(429);
    clock.advance(60_000);
    expect((await hit(app)).status).not.toBe(429);
  });

  it('limits an unknown /api/news path too', async () => {
    const { app } = setup();
    const first = await hit(app);
    expect(first.status).toBe(404);
    await hitMany(app, 29);
    expect((await hit(app)).status).toBe(429);
  });

  it('does not limit /api/health or /api/milestones', async () => {
    const { app } = setup();
    const health = await hitMany(app, 40, '/api/health');
    const milestones = await hitMany(app, 40, '/api/milestones');
    expect(health.every((s) => s === 200)).toBe(true);
    expect(milestones.every((s) => s === 200)).toBe(true);
  });

  it('does not count other routes against the news budget', async () => {
    const { app } = setup();
    await hitMany(app, 40, '/api/health');
    expect((await hit(app)).status).toBe(404);
  });

  it('keeps separate buckets per forwarded IP when trustProxy is true', async () => {
    const { app } = setup({ trustProxy: true });
    await hitMany(app, 30, '/api/news/x', '10.0.0.1');
    expect((await hit(app, '/api/news/x', '10.0.0.1')).status).toBe(429);
    expect((await hit(app, '/api/news/x', '10.0.0.2')).status).toBe(404);
  });

  it('shares one bucket when proxy headers are not trusted (default)', async () => {
    const { app } = setup();
    await hitMany(app, 30, '/api/news/x', '10.0.0.1');
    expect((await hit(app, '/api/news/x', '10.0.0.2')).status).toBe(429);
  });

  it('keeps its state per app instance', async () => {
    const first = setup().app;
    await hitMany(first, 31);
    expect((await hit(setup().app)).status).toBe(404);
  });
});

describe('M10 rate limiter unit', () => {
  const run = (limiter, ip) => {
    const res = {
      headers: {},
      code: null,
      set(k, v) {
        this.headers[k] = v;
        return this;
      },
      status(c) {
        this.code = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      },
    };
    let passed = false;
    limiter({ ip }, res, () => {
      passed = true;
    });
    return { res, passed };
  };

  it('honours custom limit and window', () => {
    const clock = createFakeClock();
    const limiter = createRateLimiter({ now: clock.now, limit: 2, windowMs: 1000 });
    expect(run(limiter, 'a').passed).toBe(true);
    expect(run(limiter, 'a').passed).toBe(true);
    const blocked = run(limiter, 'a');
    expect(blocked.passed).toBe(false);
    expect(blocked.res.code).toBe(429);
    expect(blocked.res.headers['Retry-After']).toBe('1');
    clock.advance(1000);
    expect(run(limiter, 'a').passed).toBe(true);
  });

  it('forgets expired windows: a client coming back after a sweep starts at zero', () => {
    // State is private, so this checks behaviour: other clients' sweeps never affect a live window.
    const clock = createFakeClock();
    const limiter = createRateLimiter({ now: clock.now, limit: 1, windowMs: 1000 });
    run(limiter, 'old');
    clock.advance(500);
    run(limiter, 'live');
    clock.advance(600); // 'old' expired, 'live' still inside its window
    expect(run(limiter, 'new').passed).toBe(true); // triggers the sweep
    expect(run(limiter, 'old').passed).toBe(true); // fresh window after expiry
    expect(run(limiter, 'live').passed).toBe(false); // live window kept
  });
});
