import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createFakeClock, createNewsTestApp, createTestApp, failStatus, okText } from './helpers.js';

const TOPICS = '/api/news/topics';
const FAIL = 'Could not load topics from OpenAlex. Please try again later.';
const TIMEOUT = 'OpenAlex did not answer in time. Please try again later.';

const group = (n, name, count) => ({ key: `https://openalex.org/T${n}`, key_display_name: name, count });
const payload = (groups) => okText(JSON.stringify({ meta: {}, results: [], group_by: groups }));

function setup(responder, extra = {}) {
  const fetch = vi.fn(async () => responder());
  const app = createNewsTestApp({ fetch, clock: createFakeClock(), ...extra });
  return { fetch, app };
}
const get = (app, query = { categories: 'cs.LG' }) => request(app).get(TOPICS).query(query);
const urlOf = (fetch, i = 0) => new URL(fetch.mock.calls[i][0]);

describe('US-04 hot topics: mapping', () => {
  it('maps OpenAlex groups to { id, name, count }', async () => {
    const { app } = setup(() => payload([group(10320, 'Neural Networks and Applications', 5123)]));
    const res = await get(app);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'T10320', name: 'Neural Networks and Applications', count: 5123 }]);
  });

  it('returns the top 10 of 12 groups', async () => {
    const groups = Array.from({ length: 12 }, (_, i) => group(i + 1, `Topic ${String(i).padStart(2, '0')}`, 100 - i));
    const { app } = setup(() => payload(groups));
    const res = await get(app);
    expect(res.body).toHaveLength(10);
    expect(res.body[0].count).toBe(100);
    expect(res.body[9].count).toBe(91);
  });

  it('sorts by count descending then name ascending', async () => {
    const { app } = setup(() => payload([group(1, 'Zebra', 5), group(2, 'Apple', 5), group(3, 'Mid', 9)]));
    const res = await get(app);
    expect(res.body.map((t) => t.name)).toEqual(['Mid', 'Apple', 'Zebra']);
  });

  it('skips the unknown group and invalid groups', async () => {
    const { app } = setup(() =>
      payload([
        { key: 'unknown', key_display_name: 'unknown', count: 99 },
        { key: 'https://openalex.org/T1', key_display_name: '', count: 3 },
        { key: 'https://openalex.org/T2', key_display_name: 'No count' },
        { key: 'https://openalex.org/T3', key_display_name: 'Negative', count: -1 },
        { key: 'https://evil.example/T4', key_display_name: 'Wrong host', count: 4 },
        { key: 'https://openalex.org/Tabc', key_display_name: 'Bad id', count: 4 },
        group(5, 'Good', 1),
      ]),
    );
    const res = await get(app);
    expect(res.body).toEqual([{ id: 'T5', name: 'Good', count: 1 }]);
  });

  it('returns an empty array when there are no groups', async () => {
    const { app } = setup(() => payload([]));
    const res = await get(app);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('US-04 hot topics: OpenAlex request', () => {
  it('filters works of the last 365 days from the injected clock', async () => {
    const { app, fetch } = setup(() => payload([]));
    await get(app);
    const url = urlOf(fetch);
    expect(url.protocol).toBe('https:');
    expect(url.host).toBe('api.openalex.org');
    expect(url.pathname).toBe('/works');
    expect(url.searchParams.get('filter')).toBe('from_publication_date:2025-11-12');
    expect(url.searchParams.get('group_by')).toBe('topics.id');
  });

  it('searches the keywords and ignores categories when a keyword is given', async () => {
    const { app, fetch } = setup(() => payload([]));
    await get(app, { categories: 'cs.AI', q: 'Diffusion, graphs' });
    expect(urlOf(fetch).searchParams.get('search')).toBe('"diffusion" OR "graphs"');
  });

  it('searches one category by its plain term', async () => {
    const { app, fetch } = setup(() => payload([]));
    await get(app, { categories: 'cs.AI' });
    expect(urlOf(fetch).searchParams.get('search')).toBe('"artificial intelligence"');
  });

  it('searches several categories with OR, each term quoted', async () => {
    const { app, fetch } = setup(() => payload([]));
    await get(app, { categories: 'cs.CV,cs.AI,cs.LG,cs.SE,cs.CL' });
    expect(urlOf(fetch).searchParams.get('search')).toBe(
      '"artificial intelligence" OR "natural language processing" OR "computer vision" OR "machine learning" OR "software engineering"',
    );
  });

  it('keeps special characters in q encoded', async () => {
    const { app, fetch } = setup(() => payload([]));
    await get(app, { q: 'a&b#c=d' });
    const url = urlOf(fetch);
    expect(url.searchParams.get('search')).toBe('"a&b#c=d"');
    expect([...url.searchParams.keys()].sort()).toEqual(['filter', 'group_by', 'search']);
  });

  it('sends mailto when OPENALEX_MAILTO is configured', async () => {
    const { app, fetch } = setup(() => payload([]), { openAlexMailto: 'me@example.org' });
    await get(app);
    expect(urlOf(fetch).searchParams.get('mailto')).toBe('me@example.org');
  });

  it('sends no mailto when it is not configured', async () => {
    const { app, fetch } = setup(() => payload([]));
    await get(app);
    expect(urlOf(fetch).searchParams.has('mailto')).toBe(false);
  });
});

describe('US-04 hot topics: errors', () => {
  const expectClean = (res) => {
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(JSON.stringify(res.body)).not.toMatch(/openalex\.org|api\.|http|SECRET|Unexpected/i);
  };

  it('502 on a non-2xx status', async () => {
    const { app } = setup(() => failStatus(500));
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
    expectClean(res);
  });

  it('502 when fetch rejects', async () => {
    const { app } = setup(() => {
      throw new TypeError('fetch failed');
    });
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
  });

  it('502 on invalid JSON', async () => {
    const { app } = setup(() => okText('{not json'));
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
    expectClean(res);
  });

  it('502 when group_by is missing or not an array', async () => {
    for (const body of ['{"results":[]}', '{"group_by":{}}', 'null']) {
      const { app } = setup(() => okText(body));
      const res = await get(app);
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: FAIL });
    }
  });

  it('502 with the timeout message', async () => {
    const { app } = setup(() => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: TIMEOUT });
  });

  it('does not cache a failure', async () => {
    let calls = 0;
    const { app, fetch } = setup(() => (++calls === 1 ? failStatus(500) : payload([group(1, 'A', 1)])));
    expect((await get(app)).status).toBe(502);
    expect((await get(app)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answers 502 when createApp gets no fetch', async () => {
    const res = await request(createTestApp()).get(TOPICS).query({ categories: 'cs.AI' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
  });
});

describe('US-04 hot topics: 502 never leaks the upstream URL or the mailto', () => {
  it('leaks neither the URL nor the mailto value, for every failure kind', async () => {
    const failures = [
      () => failStatus(500),
      () => okText('{not json'),
      () => {
        throw new TypeError('fetch failed https://api.openalex.org/works?mailto=secret.person@example.org');
      },
      () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
    ];
    for (const failure of failures) {
      const { app } = setup(failure, { openAlexMailto: 'secret.person@example.org' });
      const res = await get(app);
      expect(res.status).toBe(502);
      expect(Object.keys(res.body)).toEqual(['error']);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/secret\.person|example\.org|openalex\.org|api\.openalex|https?:|mailto|SECRET BODY/i);
    }
  });
});
