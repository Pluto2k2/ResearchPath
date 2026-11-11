// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRouter } from '../public/router.js';

// Not imported from helpers.js: it loads src/app.js, which cannot load under happy-dom.
const TODAY = '2026-11-12';

const html = readFileSync(resolve(process.cwd(), 'public/index.html'), 'utf8');
const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1];

const PROGRESS = { total: 0, done: 0, percent: 0, byStatus: { todo: 0, doing: 0, done: 0, blocked: 0 } };
const PAPER = {
  id: '2611.01234v2',
  title: 'Diffusion Models for Graphs',
  authors: ['Ada Lovelace', 'Alan Turing'],
  summary: 'We study diffusion on graphs.',
  published: '2026-11-09',
  category: 'cs.LG',
  url: 'https://arxiv.org/abs/2611.01234v2',
};
const TOPIC = { id: 'T10320', name: 'Neural Networks and Applications', count: 5123 };

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

let newsHandlers;
let fetchMock;
let listeners;
let realAdd;
let realRemove;

function installFetch() {
  fetchMock = vi.fn(async (url) => {
    const path = String(url);
    if (path.startsWith('/api/news/papers')) return newsHandlers.papers(path);
    if (path.startsWith('/api/news/topics')) return newsHandlers.topics(path);
    if (path.startsWith('/api/progress')) return reply(200, PROGRESS);
    return reply(200, []);
  });
  globalThis.fetch = fetchMock;
}

const newsCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/news/'));

async function loadPage({ hash = '', stored } = {}) {
  document.body.innerHTML = bodyHtml;
  window.location.hash = hash;
  await flush(); // happy-dom fires hashchange asynchronously: let it pass before the page listens
  if (stored !== undefined) localStorage.setItem('researchpath.interests.v1', JSON.stringify(stored));
  vi.resetModules();
  await import('../public/app.js');
  await vi.waitFor(() => expect(document.querySelector('.roadmap-track')).toBeTruthy());
}

const $ = (sel) => document.querySelector(sel);
const visible = (sel) => !$(sel).hidden;
const tab = (name) => $(`[data-tab="${name}"]`);
const chip = (name) => [...document.querySelectorAll('#category-chips button')].find((b) => b.textContent === name);
// Timers are fake: this lets pending microtasks and 0-10 ms timers (happy-dom hashchange) run.
const flush = () => vi.advanceTimersByTimeAsync(10);
const advance = (ms) => vi.advanceTimersByTimeAsync(ms);

function addKeywordText(text) {
  $('#keyword-input').value = text;
  $('#keyword-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  localStorage.clear();
  newsHandlers = {
    papers: async () => reply(200, [PAPER]),
    topics: async () => reply(200, [TOPIC]),
  };
  installFetch();
  // Each page load registers window listeners; drop them so old pages never react.
  listeners = [];
  realAdd = window.addEventListener;
  realRemove = window.removeEventListener;
  window.addEventListener = function add(type, fn, opts) {
    if (type === 'hashchange' || type === 'resize') listeners.push([type, fn]);
    return realAdd.call(this, type, fn, opts);
  };
});

afterEach(async () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  for (const [type, fn] of listeners) realRemove.call(window, type, fn);
  window.addEventListener = realAdd;
  vi.clearAllTimers(); // a debounce left over from this test must not fire in the next one
  document.body.innerHTML = '';
  window.location.hash = '';
  await flush();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('US-04 navigation', () => {
  it('shows the roadmap with an empty hash and marks the Roadmap tab current', async () => {
    await loadPage();
    expect(visible('#view-roadmap')).toBe(true);
    expect(visible('#view-news')).toBe(false);
    expect(tab('roadmap').getAttribute('aria-current')).toBe('page');
    expect(tab('news').hasAttribute('aria-current')).toBe(false);
  });

  it('shows the news view on #/news and hides the section links and + Milestone', async () => {
    await loadPage({ hash: '#/news' });
    expect(visible('#view-news')).toBe(true);
    expect(visible('#view-roadmap')).toBe(false);
    expect(tab('news').getAttribute('aria-current')).toBe('page');
    expect(tab('roadmap').hasAttribute('aria-current')).toBe(false);
    expect($('.site-nav').hidden).toBe(true);
    expect($('#header-add').hidden).toBe(true);
  });

  it('keeps the hero and the error box on both tabs', async () => {
    await loadPage({ hash: '#/news' });
    expect($('.hero').closest('[data-view]')).toBeNull();
    expect($('#milestone-error').closest('[data-view]')).toBeNull();
  });

  it('switches to news and back on hashchange (back button) and restores the roadmap controls', async () => {
    await loadPage();
    window.location.hash = '#/news';
    await vi.waitFor(() => expect(visible('#view-news')).toBe(true));
    expect($('.site-nav').hidden).toBe(true);

    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect(visible('#view-roadmap')).toBe(true));
    expect(visible('#view-news')).toBe(false);
    expect($('.site-nav').hidden).toBe(false);
    expect($('#header-add').hidden).toBe(false);
    expect(tab('roadmap').getAttribute('aria-current')).toBe('page');
  });

  it('treats a section anchor like #progress-section as the roadmap tab', async () => {
    await loadPage({ hash: '#progress-section' });
    expect(visible('#view-roadmap')).toBe(true);
    expect(visible('#view-news')).toBe(false);
    expect(tab('roadmap').getAttribute('aria-current')).toBe('page');
  });

  it('treats an unknown hash as the roadmap tab and does not rewrite it', async () => {
    await loadPage({ hash: '#/whatever' });
    expect(visible('#view-roadmap')).toBe(true);
    expect(window.location.hash).toBe('#/whatever');
  });
});

describe('US-04 interests on the page', () => {
  it('shows the empty state and calls no news API when no interest is selected', async () => {
    await loadPage({ hash: '#/news' });
    await flush();
    expect(visible('#news-empty')).toBe(true);
    expect($('#news-empty').textContent).toBe('Pick a category or add a keyword to see the latest papers and hot topics.');
    expect(visible('#papers-section')).toBe(false);
    expect(visible('#topics-section')).toBe(false);
    expect(newsCalls()).toEqual([]);
  });

  it('never calls the news API on the Roadmap tab, even with saved interests', async () => {
    await loadPage({ stored: { categories: ['cs.LG'], keywords: ['diffusion'] } });
    await advance(600);
    expect(newsCalls()).toEqual([]);
  });

  it('renders the five category chips with aria-pressed', async () => {
    await loadPage({ hash: '#/news', stored: { categories: ['cs.SE'], keywords: [] } });
    const chips = [...document.querySelectorAll('#category-chips button')];
    expect(chips.map((b) => b.textContent)).toEqual(['cs.AI', 'cs.LG', 'cs.SE', 'cs.CL', 'cs.CV']);
    expect(chips.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false', 'false']);
  });

  it('toggles a chip, saves to localStorage and loads after the 400 ms debounce', async () => {
    await loadPage({ hash: '#/news' });
    chip('cs.LG').click();
    expect(chip('cs.LG').getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('researchpath.interests.v1'))).toEqual({
      categories: ['cs.LG'],
      keywords: [],
    });
    expect(visible('#news-empty')).toBe(false);
    expect(newsCalls()).toEqual([]); // debounced
    await advance(400);
    expect(newsCalls()).toHaveLength(2);
    expect(newsCalls().sort()).toEqual(['/api/news/papers?categories=cs.LG', '/api/news/topics?categories=cs.LG']);
  });

  it('debounces several quick changes into one pair of requests', async () => {
    await loadPage({ hash: '#/news' });
    chip('cs.AI').click();
    chip('cs.LG').click();
    addKeywordText('graphs');
    await advance(400);
    expect(newsCalls()).toHaveLength(2);
    await advance(600);
    expect(newsCalls()).toHaveLength(2);
    expect(newsCalls()[0]).toBe('/api/news/papers?categories=cs.AI%2Ccs.LG&q=graphs');
  });

  it('adds a keyword, shows it with an accessible remove button, and removes it', async () => {
    await loadPage({ hash: '#/news' });
    addKeywordText('  Diffusion ');
    expect($('#keyword-input').value).toBe('');
    expect($('#keyword-list').textContent).toContain('Diffusion');
    const remove = $('#keyword-list button');
    expect(remove.getAttribute('aria-label')).toBe('Remove keyword Diffusion');
    remove.click();
    expect($('#keyword-list').children).toHaveLength(0);
    expect(visible('#news-empty')).toBe(true);
  });

  it('ignores an empty keyword silently', async () => {
    await loadPage({ hash: '#/news' });
    addKeywordText('   ');
    expect($('#keyword-list').children).toHaveLength(0);
    expect($('#news-error').textContent).toBe('');
  });

  it('shows the keyword validation message for a duplicate', async () => {
    await loadPage({ hash: '#/news', stored: { categories: [], keywords: ['graphs'] } });
    addKeywordText('GRAPHS');
    expect($('#news-error').textContent).toBe('This keyword is already in your list.');
    expect($('#keyword-list').children).toHaveLength(1);
  });

  it('keeps interests after a reload (localStorage)', async () => {
    await loadPage({ hash: '#/news' });
    chip('cs.CV').click();
    addKeywordText('segmentation');
    await advance(400);
    expect(newsCalls()).toHaveLength(2);

    await loadPage({ hash: '#/news' });
    expect(chip('cs.CV').getAttribute('aria-pressed')).toBe('true');
    expect($('#keyword-list').textContent).toContain('segmentation');
    expect(visible('#news-empty')).toBe(false);
  });

  it('still works when localStorage throws', async () => {
    const proto = Object.getPrototypeOf(localStorage);
    vi.spyOn(proto, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(proto, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await loadPage({ hash: '#/news' });
    expect(visible('#news-empty')).toBe(true);
    chip('cs.AI').click();
    expect(chip('cs.AI').getAttribute('aria-pressed')).toBe('true');
    await advance(400);
    expect(newsCalls()).toHaveLength(2);
    expect($('#papers-list').textContent).toContain('Diffusion Models for Graphs');
  });

  it('still works when saved data is invalid JSON', async () => {
    localStorage.setItem('researchpath.interests.v1', '{oops');
    await loadPage({ hash: '#/news' });
    expect(visible('#news-empty')).toBe(true);
    expect(newsCalls()).toEqual([]);
  });
});

describe('US-04 papers and topics on the page', () => {
  const stored = { categories: ['cs.LG'], keywords: [] };

  it('loads at once when the tab is opened with saved interests', async () => {
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#papers-list').textContent).toContain('Diffusion Models for Graphs'));
    expect(newsCalls()).toHaveLength(2);
  });

  it('shows a loading state until both requests are answered', async () => {
    let release;
    newsHandlers.papers = () => new Promise((r) => (release = () => r(reply(200, [PAPER]))));
    await loadPage({ hash: '#/news', stored });
    await flush();
    expect(visible('#news-loading')).toBe(true);
    release();
    await flush();
    expect(visible('#news-loading')).toBe(false);
  });

  it('renders a paper: title link in a new tab, authors, date, category, summary', async () => {
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#papers-list a')).toBeTruthy());
    const link = $('#papers-list a');
    expect(link.textContent).toBe('Diffusion Models for Graphs');
    expect(link.getAttribute('href')).toBe('https://arxiv.org/abs/2611.01234v2');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    const text = $('#papers-list').textContent;
    for (const part of ['Ada Lovelace, Alan Turing', '2026-11-09', 'cs.LG', 'We study diffusion on graphs.']) {
      expect(text).toContain(part);
    }
  });

  it('shows a paper whose url is not https as plain text, not a link', async () => {
    newsHandlers.papers = async () =>
      reply(200, [
        { ...PAPER, id: 'a', title: 'Plain http', url: 'http://arxiv.org/abs/a' },
        { ...PAPER, id: 'b', title: 'Script link', url: 'javascript:alert(1)' },
      ]);
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#papers-list').textContent).toContain('Plain http'));
    expect($('#papers-list a')).toBeNull();
    expect($('#papers-list').textContent).toContain('Script link');
  });

  it('renders HTML in a title as text, never as markup', async () => {
    newsHandlers.papers = async () =>
      reply(200, [{ ...PAPER, title: '<script>window.__pwned = 1</script><img src=x onerror=alert(1)>' }]);
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#papers-list').textContent).toContain('<script>'));
    expect($('#papers-list script')).toBeNull();
    expect($('#papers-list img')).toBeNull();
    expect(window.__pwned).toBeUndefined();
  });

  it('renders the hot topics with their counts', async () => {
    newsHandlers.topics = async () => reply(200, [TOPIC, { id: 'T2', name: 'Graph Theory', count: 40 }]);
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#topics-list').children).toHaveLength(2));
    const items = [...$('#topics-list').children].map((li) => li.textContent);
    expect(items[0]).toContain('Neural Networks and Applications');
    expect(items[0]).toContain('5123');
    expect(items[1]).toContain('Graph Theory');
    expect(items[1]).toContain('40');
  });

  it('shows empty results with a friendly line', async () => {
    newsHandlers.papers = async () => reply(200, []);
    newsHandlers.topics = async () => reply(200, []);
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#papers-list').children).toHaveLength(1));
    expect($('#papers-list').textContent.trim()).not.toBe('');
    expect($('#topics-list').textContent.trim()).not.toBe('');
  });

  it("shows the API's own error message when papers fail, topics still show", async () => {
    newsHandlers.papers = async () =>
      reply(502, { error: 'Could not load papers from arXiv. Please try again later.' });
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Could not load papers from arXiv. Please try again later.'),
    );
    await vi.waitFor(() => expect($('#topics-list').textContent).toContain('Neural Networks and Applications'));
  });

  it("shows the API's own error message when topics fail", async () => {
    newsHandlers.topics = async () =>
      reply(502, { error: 'OpenAlex did not answer in time. Please try again later.' });
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() =>
      expect($('#topics-section').textContent).toContain('OpenAlex did not answer in time. Please try again later.'),
    );
  });

  it('shows a network error message when fetch rejects', async () => {
    newsHandlers.papers = async () => {
      throw new TypeError('failed');
    };
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#papers-list').textContent).toContain('Network error'));
  });
});

function stubWidth(element, getWidth) {
  Object.defineProperty(element, 'clientWidth', { configurable: true, get: getWidth });
}

describe('US-04 roadmap is redrawn when it comes back into view', () => {
  it('redraws at the real width after loading on #/news and switching to #/roadmap', async () => {
    await loadPage({ hash: '#/news' });
    stubWidth($('#roadmap'), () => 900);
    const before = $('.roadmap-track');
    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect(visible('#view-roadmap')).toBe(true));
    await vi.waitFor(() => expect($('.roadmap-track').style.width).toBe('900px'));
    expect($('.roadmap-track')).not.toBe(before);
  });

  it('redraws again when the width changed meanwhile, not when it is the same', async () => {
    await loadPage({ hash: '#/news' });
    let width = 900;
    stubWidth($('#roadmap'), () => width);
    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect($('.roadmap-track').style.width).toBe('900px'));

    const drawn = $('.roadmap-track');
    window.location.hash = '#/news';
    await vi.waitFor(() => expect(visible('#view-news')).toBe(true));
    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect(visible('#view-roadmap')).toBe(true));
    await flush();
    expect($('.roadmap-track')).toBe(drawn); // same width: no redraw

    window.location.hash = '#/news';
    await vi.waitFor(() => expect(visible('#view-news')).toBe(true));
    width = 700;
    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect($('.roadmap-track').style.width).toBe('700px'));
  });

  it('does not redraw when the roadmap measures 0 (hidden), on resize', async () => {
    await loadPage({ hash: '#/news' });
    stubWidth($('#roadmap'), () => 0);
    const drawn = $('.roadmap-track');
    window.dispatchEvent(new Event('resize'));
    await advance(500);
    expect($('.roadmap-track')).toBe(drawn);
  });

  it('does not redraw on switching to the roadmap while it still measures 0', async () => {
    await loadPage({ hash: '#/news' });
    stubWidth($('#roadmap'), () => 0);
    const drawn = $('.roadmap-track');
    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect(visible('#view-roadmap')).toBe(true));
    await flush();
    expect($('.roadmap-track')).toBe(drawn);
  });
});

describe('US-04 startRouter callbacks', () => {
  async function start(hash) {
    document.body.innerHTML = bodyHtml;
    window.location.hash = hash;
    await flush();
    const onNews = vi.fn();
    const onRoadmap = vi.fn();
    startRouter({ onNews, onRoadmap });
    return { onNews, onRoadmap };
  }

  for (const hash of ['', '#/roadmap', '#progress-section']) {
    it(`calls onRoadmap and not onNews for "${hash}"`, async () => {
      const { onNews, onRoadmap } = await start(hash);
      expect(onRoadmap).toHaveBeenCalledTimes(1);
      expect(onNews).not.toHaveBeenCalled();
    });
  }

  it('calls onNews and not onRoadmap for #/news', async () => {
    const { onNews, onRoadmap } = await start('#/news');
    expect(onNews).toHaveBeenCalledTimes(1);
    expect(onRoadmap).not.toHaveBeenCalled();
  });

  it('calls the matching callback on each hashchange', async () => {
    const { onNews, onRoadmap } = await start('');
    window.location.hash = '#/news';
    await vi.waitFor(() => expect(onNews).toHaveBeenCalledTimes(1));
    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect(onRoadmap).toHaveBeenCalledTimes(2));
  });

  it('works without callbacks', async () => {
    document.body.innerHTML = bodyHtml;
    window.location.hash = '#/news';
    await flush();
    expect(() => startRouter()).not.toThrow();
  });
});

describe('US-04 tab switching side effects', () => {
  it('hides an open add popover when going to the news tab', async () => {
    await loadPage();
    $('#header-add').click();
    expect($('#add-popover').hidden).toBe(false);
    window.location.hash = '#/news';
    await vi.waitFor(() => expect(visible('#view-news')).toBe(true));
    expect($('#add-popover').hidden).toBe(true);
  });

  it('cancels a pending debounce when leaving the news tab: no news request', async () => {
    await loadPage({ hash: '#/news' });
    chip('cs.LG').click();
    await advance(100);
    window.location.hash = '#/roadmap';
    await vi.waitFor(() => expect(visible('#view-roadmap')).toBe(true));
    await advance(1000);
    expect(newsCalls()).toEqual([]);
  });

  it('latest request wins: a stale answer arriving late is not rendered', async () => {
    const stale = { release: null };
    let calls = 0;
    newsHandlers.papers = () => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          stale.release = () => resolve(reply(200, [{ ...PAPER, id: 's', title: 'Stale paper', url: 'https://arxiv.org/abs/s' }]));
        });
      }
      return Promise.resolve(reply(200, [{ ...PAPER, id: 'f', title: 'Fresh paper', url: 'https://arxiv.org/abs/f' }]));
    };
    await loadPage({ hash: '#/news', stored: { categories: ['cs.LG'], keywords: [] } });
    await vi.waitFor(() => expect(stale.release).toBeTruthy());

    chip('cs.AI').click();
    await advance(400);
    await vi.waitFor(() => expect($('#papers-list').textContent).toContain('Fresh paper'));

    stale.release();
    await flush();
    expect($('#papers-list').textContent).toContain('Fresh paper');
    expect($('#papers-list').textContent).not.toContain('Stale paper');
    expect(visible('#news-loading')).toBe(false);
  });
});
