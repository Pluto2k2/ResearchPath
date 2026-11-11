import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTtlCache } from '../src/news/cache.js';
import { createSpacer } from '../src/news/rate-limit.js';
import { atomEntry, atomFeed, createFakeClock, createNewsTestApp, okText } from './helpers.js';

const MIN = 60 * 1000;

// One fetch mock that answers arXiv with a feed and OpenAlex with groups.
function upstream() {
  return vi.fn(async (url) => {
    if (new URL(url).host === 'export.arxiv.org') return okText(atomFeed([atomEntry()]));
    return okText(JSON.stringify({ group_by: [{ key: 'https://openalex.org/T1', key_display_name: 'A', count: 1 }] }));
  });
}
const hosts = (fetch) => fetch.mock.calls.map(([url]) => new URL(url).host);

describe('US-04 server-side cache (30 minutes per normalised query)', () => {
  it('fetches once for the same normalised query (order and case ignored)', async () => {
    const fetch = upstream();
    const app = createNewsTestApp({ fetch });
    const a = await request(app).get('/api/news/papers').query({ categories: 'cs.LG,cs.AI', q: 'DIFFUSION' });
    const b = await request(app).get('/api/news/papers').query({ categories: 'cs.AI,cs.LG', q: 'diffusion' });
    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refetches papers after exactly 30 minutes, not at 29:59.999', async () => {
    const clock = createFakeClock();
    const fetch = upstream();
    const app = createNewsTestApp({ fetch, clock });
    const q = { categories: 'cs.AI' };
    await request(app).get('/api/news/papers').query(q);
    clock.advance(30 * MIN - 1);
    await request(app).get('/api/news/papers').query(q);
    expect(fetch).toHaveBeenCalledTimes(1);
    clock.advance(1);
    await request(app).get('/api/news/papers').query(q);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('refetches topics after exactly 30 minutes, not at 29:59.999', async () => {
    const clock = createFakeClock();
    const fetch = upstream();
    const app = createNewsTestApp({ fetch, clock });
    const q = { categories: 'cs.AI' };
    await request(app).get('/api/news/topics').query(q);
    clock.advance(30 * MIN - 1);
    await request(app).get('/api/news/topics').query(q);
    expect(fetch).toHaveBeenCalledTimes(1);
    clock.advance(1);
    await request(app).get('/api/news/topics').query(q);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('caches papers and topics separately for the same query', async () => {
    const fetch = upstream();
    const app = createNewsTestApp({ fetch });
    const q = { categories: 'cs.AI' };
    await request(app).get('/api/news/papers').query(q);
    await request(app).get('/api/news/topics').query(q);
    await request(app).get('/api/news/papers').query(q);
    await request(app).get('/api/news/topics').query(q);
    expect(hosts(fetch).sort()).toEqual(['api.openalex.org', 'export.arxiv.org']);
  });

  it('different queries are different cache entries', async () => {
    const fetch = upstream();
    const app = createNewsTestApp({ fetch });
    await request(app).get('/api/news/topics').query({ categories: 'cs.AI' });
    await request(app).get('/api/news/topics').query({ categories: 'cs.LG' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('two apps do not share a cache', async () => {
    const fetch = upstream();
    const q = { categories: 'cs.AI' };
    await request(createNewsTestApp({ fetch })).get('/api/news/topics').query(q);
    await request(createNewsTestApp({ fetch })).get('/api/news/topics').query(q);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('US-04 arXiv requests are spaced 3 seconds apart', () => {
  it('queues three concurrent misses: waits 3000 ms between them and answers all', async () => {
    const clock = createFakeClock();
    const wait = vi.fn(async (ms) => clock.advance(ms));
    const fetch = upstream();
    const app = createNewsTestApp({ fetch, wait, clock });
    const responses = await Promise.all(
      ['cs.AI', 'cs.LG', 'cs.SE'].map((categories) => request(app).get('/api/news/papers').query({ categories })),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([3000, 3000]);
  });

  it('does not wait when the previous request was 5 s ago', async () => {
    const clock = createFakeClock();
    const wait = vi.fn(async (ms) => clock.advance(ms));
    const app = createNewsTestApp({ fetch: upstream(), wait, clock });
    await request(app).get('/api/news/papers').query({ categories: 'cs.AI' });
    clock.advance(5000);
    await request(app).get('/api/news/papers').query({ categories: 'cs.LG' });
    expect(wait).not.toHaveBeenCalled();
  });

  it('waits only the remaining time when the previous request was 1 s ago', async () => {
    const clock = createFakeClock();
    const wait = vi.fn(async (ms) => clock.advance(ms));
    const app = createNewsTestApp({ fetch: upstream(), wait, clock });
    await request(app).get('/api/news/papers').query({ categories: 'cs.AI' });
    clock.advance(1000);
    await request(app).get('/api/news/papers').query({ categories: 'cs.LG' });
    expect(wait).toHaveBeenCalledWith(2000);
  });

  it('does not wait on a cache hit', async () => {
    const clock = createFakeClock();
    const wait = vi.fn(async (ms) => clock.advance(ms));
    const app = createNewsTestApp({ fetch: upstream(), wait, clock });
    const q = { categories: 'cs.AI' };
    await request(app).get('/api/news/papers').query(q);
    await request(app).get('/api/news/papers').query(q);
    expect(wait).not.toHaveBeenCalled();
  });

  it('never spaces OpenAlex requests', async () => {
    const clock = createFakeClock();
    const wait = vi.fn(async (ms) => clock.advance(ms));
    const app = createNewsTestApp({ fetch: upstream(), wait, clock });
    await Promise.all(
      ['cs.AI', 'cs.LG', 'cs.SE'].map((categories) => request(app).get('/api/news/topics').query({ categories })),
    );
    expect(wait).not.toHaveBeenCalled();
  });
});

describe('US-04 createTtlCache', () => {
  it('returns undefined for an unknown key', () => {
    expect(createTtlCache({ now: createFakeClock().now, ttlMs: 1000 }).get('x')).toBeUndefined();
  });

  it('returns the value before the ttl and drops it at the ttl', () => {
    const clock = createFakeClock();
    const cache = createTtlCache({ now: clock.now, ttlMs: 1000 });
    cache.set('k', [1]);
    clock.advance(999);
    expect(cache.get('k')).toEqual([1]);
    clock.advance(1);
    expect(cache.get('k')).toBeUndefined();
  });

  it('restarts the ttl when a key is set again', () => {
    const clock = createFakeClock();
    const cache = createTtlCache({ now: clock.now, ttlMs: 1000 });
    cache.set('k', 'a');
    clock.advance(900);
    cache.set('k', 'b');
    clock.advance(900);
    expect(cache.get('k')).toBe('b');
  });
});

describe('US-04 createSpacer', () => {
  it('runs the first task at once and spaces the next ones', async () => {
    const clock = createFakeClock();
    const wait = vi.fn(async (ms) => clock.advance(ms));
    const spacer = createSpacer({ now: clock.now, wait });
    const times = [];
    const task = async () => times.push(clock.now().getTime());
    await Promise.all([spacer.schedule(task), spacer.schedule(task), spacer.schedule(task)]);
    expect(times[1] - times[0]).toBe(3000);
    expect(times[2] - times[1]).toBe(3000);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('returns the task result and rejects with the task error', async () => {
    const clock = createFakeClock();
    const spacer = createSpacer({ now: clock.now, wait: async (ms) => clock.advance(ms) });
    await expect(spacer.schedule(async () => 42)).resolves.toBe(42);
    await expect(
      spacer.schedule(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('a failed task does not break the chain', async () => {
    const clock = createFakeClock();
    const spacer = createSpacer({ now: clock.now, wait: async (ms) => clock.advance(ms) });
    const failing = spacer.schedule(async () => {
      throw new Error('boom');
    });
    const next = spacer.schedule(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('honours a custom interval', async () => {
    const clock = createFakeClock();
    const wait = vi.fn(async (ms) => clock.advance(ms));
    const spacer = createSpacer({ now: clock.now, wait, intervalMs: 500 });
    await spacer.schedule(async () => {});
    await spacer.schedule(async () => {});
    expect(wait).toHaveBeenCalledWith(500);
  });
});

describe('US-04 identical concurrent requests share one upstream call', () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };

  it('papers: two parallel identical requests -> one fetch, both answered', async () => {
    const gate = deferred();
    const fetch = vi.fn(async () => {
      await gate.promise;
      return okText(atomFeed([atomEntry()]));
    });
    const app = createNewsTestApp({ fetch });
    const q = { categories: 'cs.AI' };
    const both = Promise.all([request(app).get('/api/news/papers').query(q), request(app).get('/api/news/papers').query(q)]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    gate.resolve();
    const [a, b] = await both;
    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('topics: two parallel identical requests -> one fetch, both answered', async () => {
    const gate = deferred();
    const fetch = vi.fn(async () => {
      await gate.promise;
      return okText(JSON.stringify({ group_by: [{ key: 'https://openalex.org/T1', key_display_name: 'A', count: 1 }] }));
    });
    const app = createNewsTestApp({ fetch });
    const q = { categories: 'cs.AI' };
    const both = Promise.all([request(app).get('/api/news/topics').query(q), request(app).get('/api/news/topics').query(q)]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    gate.resolve();
    const [a, b] = await both;
    expect(a.body).toEqual([{ id: 'T1', name: 'A', count: 1 }]);
    expect(b.body).toEqual(a.body);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a shared failure reaches both callers and is not cached', async () => {
    const gate = deferred();
    let calls = 0;
    const fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        await gate.promise;
        return { ok: false, status: 500, text: async () => '' };
      }
      return okText(atomFeed([atomEntry()]));
    });
    const app = createNewsTestApp({ fetch });
    const q = { categories: 'cs.AI' };
    const both = Promise.all([request(app).get('/api/news/papers').query(q), request(app).get('/api/news/papers').query(q)]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    gate.resolve();
    const [a, b] = await both;
    expect([a.status, b.status]).toEqual([502, 502]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const retry = await request(app).get('/api/news/papers').query(q);
    expect(retry.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('US-04 createTtlCache bounds', () => {
  it('set purges expired entries', () => {
    const clock = createFakeClock();
    const cache = createTtlCache({ now: clock.now, ttlMs: 1000, maxEntries: 3 });
    cache.set('old1', 1);
    cache.set('old2', 2);
    clock.advance(1000);
    cache.set('new1', 3);
    cache.set('new2', 4);
    cache.set('new3', 5); // would evict a live entry if the expired ones were still counted
    expect(cache.get('new1')).toBe(3);
    expect(cache.get('new2')).toBe(4);
    expect(cache.get('new3')).toBe(5);
  });

  it('caps the size at maxEntries, dropping the oldest by insertion', () => {
    const clock = createFakeClock();
    const cache = createTtlCache({ now: clock.now, ttlMs: 60000, maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('re-setting a key moves it to the end (newest)', () => {
    const clock = createFakeClock();
    const cache = createTtlCache({ now: clock.now, ttlMs: 60000, maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);
    cache.set('c', 3); // evicts b, the oldest now
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(10);
    expect(cache.get('c')).toBe(3);
  });
});
