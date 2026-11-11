import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { atomEntry, atomFeed, createFakeClock, createNewsTestApp, createTestApp, failStatus, okText } from './helpers.js';

const PAPERS = '/api/news/papers';
const FAIL = 'Could not load papers from arXiv. Please try again later.';
const TIMEOUT = 'arXiv did not answer in time. Please try again later.';

function setup(responder) {
  const fetch = vi.fn(async () => responder());
  const app = createNewsTestApp({ fetch, clock: createFakeClock() });
  return { fetch, app };
}
const get = (app, query = { categories: 'cs.LG' }) => request(app).get(PAPERS).query(query);
const feedWith = (...entries) => () => okText(atomFeed(entries));

describe('US-04 latest papers: mapping', () => {
  it('maps an entry to a paper (entity decoded, whitespace collapsed, https url)', async () => {
    const entry = atomEntry({
      title: 'Diffusion  Models\n for &amp; Graphs',
      summary: ' We study   things. ',
      authors: ['Ada Lovelace', 'Alan Turing'],
      categories: ['cs.LG', 'cs.AI'],
    });
    const { app } = setup(feedWith(entry));
    const res = await get(app);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: '2611.01234v2',
        title: 'Diffusion Models for & Graphs',
        authors: ['Ada Lovelace', 'Alan Turing'],
        summary: 'We study things.',
        published: '2026-11-09',
        category: 'cs.LG',
        url: 'https://arxiv.org/abs/2611.01234v2',
      },
    ]);
  });

  it('sorts newest first', async () => {
    const { app } = setup(
      feedWith(
        atomEntry({ id: 'a1', published: '2026-11-01T00:00:00Z' }),
        atomEntry({ id: 'a3', published: '2026-11-10T00:00:00Z' }),
        atomEntry({ id: 'a2', published: '2026-11-05T00:00:00Z' }),
      ),
    );
    const res = await get(app);
    expect(res.body.map((p) => p.id)).toEqual(['a3', 'a2', 'a1']);
  });

  it('returns at most 20 papers from a 25-entry feed (the newest ones)', async () => {
    const entries = Array.from({ length: 25 }, (_, i) =>
      atomEntry({ id: `p${i}`, published: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z` }),
    );
    const { app } = setup(feedWith(...entries));
    const res = await get(app);
    expect(res.body).toHaveLength(20);
    expect(res.body[0].id).toBe('p24');
    expect(res.body.map((p) => p.id)).not.toContain('p0');
  });

  it('cuts a summary longer than 300 chars to 300 chars ending with an ellipsis', async () => {
    const { app } = setup(feedWith(atomEntry({ summary: 'word '.repeat(100) })));
    const [paper] = (await get(app)).body;
    expect(paper.summary.length).toBeLessThanOrEqual(300);
    expect(paper.summary.endsWith('…')).toBe(true);
  });

  it('keeps a summary of exactly 300 chars unchanged', async () => {
    const summary = 'a'.repeat(300);
    const { app } = setup(feedWith(atomEntry({ summary })));
    expect((await get(app)).body[0].summary).toBe(summary);
  });

  it('slices published to YYYY-MM-DD', async () => {
    const { app } = setup(feedWith(atomEntry({ published: '2026-03-04T23:59:59Z' })));
    expect((await get(app)).body[0].published).toBe('2026-03-04');
  });

  it('falls back to the first category when there is no primary category', async () => {
    const { app } = setup(feedWith(atomEntry({ primary: '', categories: ['cs.CV', 'cs.AI'] })));
    expect((await get(app)).body[0].category).toBe('cs.CV');
  });

  it('skips entries without id, title or date', async () => {
    const { app } = setup(
      feedWith(
        atomEntry({ id: null }),
        atomEntry({ id: 'no-title', title: null }),
        atomEntry({ id: 'no-date', published: null }),
        atomEntry({ id: 'good' }),
      ),
    );
    const res = await get(app);
    expect(res.body.map((p) => p.id)).toEqual(['good']);
  });

  it('rebuilds the url from the id, always https (never trusts the feed link)', async () => {
    const { app } = setup(feedWith(atomEntry({ id: 'x1', rawId: 'http://evil.example/abs/x1' })));
    expect((await get(app)).body[0].url).toBe('https://arxiv.org/abs/x1');
  });

  it('returns an empty array for an empty feed', async () => {
    const { app } = setup(feedWith());
    const res = await get(app);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('US-04 latest papers: arXiv request', () => {
  it('calls export.arxiv.org over https with the right parameters', async () => {
    const { app, fetch } = setup(feedWith());
    await get(app, { categories: 'cs.LG,cs.AI', q: 'diffusion' });
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.protocol).toBe('https:');
    expect(url.host).toBe('export.arxiv.org');
    expect(url.pathname).toBe('/api/query');
    expect(url.searchParams.get('search_query')).toBe('(cat:cs.AI OR cat:cs.LG) AND (all:"diffusion")');
    expect(url.searchParams.get('sortBy')).toBe('submittedDate');
    expect(url.searchParams.get('sortOrder')).toBe('descending');
    expect(url.searchParams.get('max_results')).toBe('20');
  });

  it('builds the query for categories only and keywords only', async () => {
    const { app, fetch } = setup(feedWith());
    await get(app, { categories: 'cs.SE' });
    await get(app, { q: 'b,a' });
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('search_query')).toBe('(cat:cs.SE)');
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('search_query')).toBe('(all:"a" OR all:"b")');
  });

  it('keeps special characters in q encoded inside search_query', async () => {
    const { app, fetch } = setup(feedWith());
    await get(app, { q: 'a&b#c=d' });
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('search_query')).toBe('(all:"a&b#c=d")');
    expect([...url.searchParams.keys()].sort()).toEqual(['max_results', 'search_query', 'sortBy', 'sortOrder', 'start']);
    expect(url.hash).toBe('');
  });

  it('strips double quotes from keywords', async () => {
    const { app, fetch } = setup(feedWith());
    await get(app, { q: 'a" OR all:"b' });
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('search_query')).toBe('(all:"a or all:b")');
  });

  it('parses the feed with fast-xml-parser, not regular expressions', () => {
    const source = readFileSync(new URL('../src/news/arxiv.js', import.meta.url), 'utf8');
    expect(source).toMatch(/from 'fast-xml-parser'/);
  });
});

describe('US-04 latest papers: errors', () => {
  const expectClean = (res) => {
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(JSON.stringify(res.body)).not.toMatch(/arxiv\.org|export\.|http|SECRET|search_query|Error:/i);
  };

  it('502 when arXiv answers with a non-2xx status', async () => {
    const { app } = setup(() => failStatus(503));
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
    expectClean(res);
  });

  it('502 when fetch rejects', async () => {
    const { app } = setup(() => {
      throw new TypeError('fetch failed https://export.arxiv.org/api/query?x=1');
    });
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
    expectClean(res);
  });

  it('502 with the timeout message on a TimeoutError', async () => {
    const { app } = setup(() => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: TIMEOUT });
  });

  it('passes an abort signal to fetch (10 s timeout)', async () => {
    const { app, fetch } = setup(feedWith());
    await get(app);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('502 on invalid XML', async () => {
    const { app } = setup(() => okText('<feed><entry></feed>'));
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
  });

  it('502 on text that is not a feed', async () => {
    const { app } = setup(() => okText('<html><body>Oops</body></html>'));
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
  });

  it('502 on the arXiv error feed', async () => {
    const entry = atomEntry({ rawId: 'http://arxiv.org/api/errors#incorrect_id_format', id: 'x', title: 'Error' });
    const { app } = setup(feedWith(entry));
    const res = await get(app);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
  });

  it('does not cache a failure: the next call fetches again', async () => {
    let calls = 0;
    const { app, fetch } = setup(() => (++calls === 1 ? failStatus(500) : okText(atomFeed([atomEntry()]))));
    expect((await get(app)).status).toBe(502);
    const second = await get(app);
    expect(second.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answers 502 (never the real network) when createApp gets no fetch', async () => {
    const res = await request(createTestApp()).get(PAPERS).query({ categories: 'cs.AI' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: FAIL });
  });
});
