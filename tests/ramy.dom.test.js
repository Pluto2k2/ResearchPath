// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Not imported from helpers.js: it loads src/app.js, which cannot load under happy-dom.
const TODAY = '2026-11-12';

const html = readFileSync(resolve(process.cwd(), 'public/index.html'), 'utf8');
const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1];

const make = (id, title, targetDate, status = 'todo') => ({
  id, title, targetDate, notes: '', status, createdAt: '2026-11-01T10:00:00.000Z',
});
const progress = (percent) => ({ total: 4, done: 0, percent, byStatus: { todo: 4, doing: 0, done: 0, blocked: 0 } });
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
const PAPER = {
  id: 'p1', title: 'A paper', authors: ['Ada'], summary: 's', published: '2026-11-09',
  category: 'cs.LG', url: 'https://arxiv.org/abs/p1',
};
const TOPIC = { id: 'T1', name: 'Graphs', count: 3 };

// Mutable server state: each test sets what the fake API answers.
let state;
let fetchMock;
let listeners;
let realAdd;
let realRemove;

function installFetch() {
  fetchMock = vi.fn(async (url, options) => {
    const path = String(url);
    const method = options?.method ?? 'GET';
    if (state.handlers[`${method} ${path.split('?')[0]}`]) return state.handlers[`${method} ${path.split('?')[0]}`](path, options);
    if (method === 'PATCH') return state.patch(path, options);
    if (method === 'POST' && path === '/api/milestones') return state.postMilestone(options);
    if (method === 'POST' && path === '/api/events') return state.postEvent(options);
    if (path.startsWith('/api/progress')) return reply(200, state.progress);
    if (path.startsWith('/api/upcoming')) return reply(200, state.upcoming);
    if (path.startsWith('/api/news/papers')) return state.papers(path);
    if (path.startsWith('/api/news/topics')) return state.topics(path);
    return reply(200, state.milestones);
  });
  globalThis.fetch = fetchMock;
}

const $ = (sel) => document.querySelector(sel);
const flush = () => vi.advanceTimersByTimeAsync(10);
const advance = (ms) => vi.advanceTimersByTimeAsync(ms);
const bubble = () => $('#ramy-bubble').textContent;
const heroSrc = () => $('#ramy .ramy-img').getAttribute('src');
const newsCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/news/'));

async function loadPage({ hash = '', stored, waitForTrack = true } = {}) {
  document.body.innerHTML = bodyHtml;
  window.location.hash = hash;
  await flush();
  if (stored !== undefined) localStorage.setItem('researchpath.interests.v1', JSON.stringify(stored));
  vi.resetModules();
  await import('../public/app.js');
  if (waitForTrack) await vi.waitFor(() => expect($('.roadmap-track')).toBeTruthy());
  await flush();
}

const nodes = () => [...document.querySelectorAll('.node-btn:not(.add-node)')];

async function setStatus(index, value) {
  nodes()[index].click();
  const select = document.getElementById('detail-status');
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  localStorage.clear();
  state = {
    milestones: [],
    progress: progress(0),
    upcoming: [],
    handlers: {},
    patch: async () => reply(500, { error: 'no patch' }),
    postMilestone: async () => reply(500, { error: 'no post' }),
    postEvent: async () => reply(500, { error: 'no post' }),
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
  vi.clearAllTimers();
  document.body.innerHTML = '';
  window.location.hash = '';
  await flush();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('M11 hero Ramy shows the right message', () => {
  it('shows the first tip immediately, before any data has loaded', async () => {
    state.handlers['GET /api/milestones'] = () => new Promise(() => {});
    await loadPage({ waitForTrack: false });
    expect(bubble()).toBe('Click a milestone on the path to change its status.');
    expect(heroSrc()).toMatch(/mascot-idle\.png$/);
  });

  it('shows the overdue message with the thinking pose and its real size after load', async () => {
    state.milestones = [make(1, 'Ethics approval', '2026-11-05')];
    await loadPage();
    expect(bubble()).toBe('Ethics approval was due 7 days ago, want to update it?');
    const img = $('#ramy .ramy-img');
    expect(img.getAttribute('src')).toMatch(/mascot-thinking\.png$/);
    expect(img.getAttribute('width')).toBe('158');
    expect(img.getAttribute('height')).toBe('230');
  });

  it('asks for a first milestone when there are none', async () => {
    await loadPage();
    expect(bubble()).toBe('Add your first milestone with the + on the line.');
  });

  it('shows a due soon item from the upcoming list with the wave pose', async () => {
    state.milestones = [make(1, 'Chapter', '2026-11-14')];
    state.upcoming = [{ kind: 'milestone', id: 1, title: 'Chapter', date: '2026-11-14', status: 'todo', daysLeft: 2 }];
    await loadPage();
    expect(bubble()).toBe('Chapter is in 2 days!');
    expect(heroSrc()).toMatch(/mascot-wave\.png$/);
  });

  it('renders HTML in a title as text', async () => {
    state.milestones = [make(1, '<b>x</b>', '2026-11-05')];
    await loadPage();
    expect(bubble()).toContain('<b>x</b>');
    expect($('#ramy-bubble b')).toBeNull();
  });
});

describe('M11 hero Ramy updates after every data refresh', () => {
  it('updates after adding a milestone', async () => {
    await loadPage();
    expect(bubble()).toBe('Add your first milestone with the + on the line.');
    const created = make(1, 'Late one', '2026-11-08');
    state.postMilestone = async () => {
      state.milestones = [created];
      return reply(201, created);
    };
    const form = $('#milestone-form');
    form.elements.title.value = 'Late one';
    form.elements.targetDate.value = '2026-11-08';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await vi.waitFor(() => expect(bubble()).toBe('Late one was due 4 days ago, want to update it?'));
  });

  it('updates after adding an event', async () => {
    state.milestones = [make(1, 'Far away', '2027-01-01')];
    await loadPage();
    expect(bubble()).toBe('Click a milestone on the path to change its status.');
    state.postEvent = async () => {
      state.upcoming = [{ kind: 'event', id: 5, title: 'ICML', type: 'conference', date: '2026-11-15', daysLeft: 3 }];
      return reply(201, state.upcoming[0]);
    };
    const form = $('#event-form');
    form.elements.title.value = 'ICML';
    form.elements.date.value = '2026-11-15';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await vi.waitFor(() => expect(bubble()).toBe('ICML is in 3 days!'));
  });

  it('updates after a status change', async () => {
    state.milestones = [make(1, 'Chapter', '2027-01-01')];
    await loadPage();
    state.patch = async () => {
      state.progress = progress(50);
      return reply(200, make(1, 'Chapter', '2027-01-01', 'doing'));
    };
    await setStatus(0, 'doing');
    expect(bubble()).toBe("You're 50% through your roadmap!");
    expect(heroSrc()).toMatch(/mascot-celebrate\.png$/);
  });
});

describe('M11 clicking Ramy cycles the messages', () => {
  it('goes to the next matching rule, then the tips, then wraps to the first', async () => {
    state.milestones = [make(1, 'Late', '2026-11-10')];
    state.progress = progress(50);
    await loadPage();
    const first = 'Late was due 2 days ago, want to update it?';
    expect(bubble()).toBe(first);

    const seen = [];
    for (let i = 0; i < 7; i += 1) {
      $('#ramy-button').click();
      seen.push(bubble());
    }
    expect(seen[0]).toBe("You're 50% through your roadmap!");
    expect(seen[1]).toBe('Click a milestone on the path to change its status.');
    expect(seen[6]).toBe('Overdue milestones get a coral halo on the path.');

    $('#ramy-button').click();
    expect(bubble()).toBe(first);
    expect(heroSrc()).toMatch(/mascot-thinking\.png$/);
  });
});

describe('M11 Ramy celebrates a finished milestone', () => {
  const doneMs = () => make(1, 'Chapter', '2027-01-01', 'done');

  function armDone() {
    state.milestones = [make(1, 'Chapter', '2027-01-01', 'doing')];
    state.patch = async () => {
      state.progress = progress(100);
      return reply(200, doneMs());
    };
  }

  it('shows the celebrate pose and text, then returns to the current message after 2 s', async () => {
    armDone();
    await loadPage();
    await setStatus(0, 'done');
    expect(heroSrc()).toMatch(/mascot-celebrate\.png$/);
    expect(bubble()).toBe('Well done, one more milestone finished!');

    await advance(1900);
    expect(bubble()).toBe('Well done, one more milestone finished!');
    await advance(200);
    expect(bubble()).toBe("You're 100% through your roadmap!");
  });

  it('is cancelled by a click on Ramy during the celebration', async () => {
    armDone();
    await loadPage();
    await setStatus(0, 'done');
    $('#ramy-button').click();
    const after = bubble();
    expect(after).not.toBe('Well done, one more milestone finished!');
    await advance(3000);
    expect(bubble()).toBe(after);
  });

  it('is cancelled by a data refresh during the celebration', async () => {
    armDone();
    await loadPage();
    await setStatus(0, 'done');
    state.patch = async () => reply(200, make(1, 'Chapter', '2027-01-01', 'doing'));
    await setStatus(0, 'doing');
    const after = bubble();
    expect(after).not.toBe('Well done, one more milestone finished!');
    await advance(3000);
    expect(bubble()).toBe(after);
  });

  it('does not celebrate when a done milestone stays done', async () => {
    state.milestones = [doneMs()];
    state.progress = progress(100);
    state.patch = async () => reply(200, doneMs());
    await loadPage();
    await setStatus(0, 'done');
    expect(bubble()).not.toBe('Well done, one more milestone finished!');
    expect(bubble()).toBe("You're 100% through your roadmap!");
  });

  it('does not celebrate when the status request fails', async () => {
    armDone();
    state.patch = async () => reply(400, { error: 'Invalid status' });
    await loadPage();
    await setStatus(0, 'done');
    expect(bubble()).not.toBe('Well done, one more milestone finished!');
  });
});

describe('M11 upcoming list empty state', () => {
  it('shows a small sleeping Ramy and the unchanged sentence', async () => {
    await loadPage();
    const empty = $('#upcoming-list .upcoming-empty');
    expect(empty).toBeTruthy();
    const img = empty.querySelector('img[src$="mascot-sleep.png"]');
    expect(img).toBeTruthy();
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('width')).toBe('161');
    expect(img.getAttribute('height')).toBe('222');
    expect(empty.textContent).toBe('Nothing due in the next 30 days.');
  });

  it('shows no sleeping Ramy when there are items', async () => {
    state.upcoming = [{ kind: 'event', id: 1, title: 'ICML', type: 'conference', date: '2026-11-20', daysLeft: 8 }];
    await loadPage();
    expect($('#upcoming-list img')).toBeNull();
  });
});

describe('M11 Ramy in Research news', () => {
  const stored = { categories: ['cs.LG'], keywords: [] };
  const news = () => $('#news-ramy');
  const newsSrc = () => news().querySelector('.ramy-img').getAttribute('src');
  const newsText = () => news().querySelector('.ramy-bubble').textContent;

  it('holds the tablet while papers are loading', async () => {
    state.papers = () => new Promise(() => {});
    await loadPage({ hash: '#/news', stored });
    expect(news().hidden).toBe(false);
    expect(newsSrc()).toMatch(/mascot-tablet\.png$/);
    expect(newsText()).toBe('Fetching the latest papers...');
    expect($('#news-retry').hidden).toBe(true);
  });

  it('reads next to the papers when both requests succeed', async () => {
    await loadPage({ hash: '#/news', stored });
    expect(newsSrc()).toMatch(/mascot-reading\.png$/);
    expect(newsText()).toBe('Here are the latest papers for you.');
    expect($('#news-retry').hidden).toBe(true);
  });

  it('thinks and offers a retry when papers fail, and retry refetches both endpoints', async () => {
    let fail = true;
    state.papers = async () => (fail ? reply(502, { error: 'Upstream down' }) : reply(200, [PAPER]));
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect(newsText()).toBe("I couldn't load the papers. Try again?"));
    expect(newsSrc()).toMatch(/mascot-thinking\.png$/);
    expect($('#news-retry').hidden).toBe(false);
    await flush();
    // Relative count: a late hashchange from happy-dom must not make the test depend on timing.
    const before = newsCalls().length;
    expect(before).toBeGreaterThanOrEqual(2);

    fail = false;
    $('#news-retry').click();
    await vi.waitFor(() => expect(newsText()).toBe('Here are the latest papers for you.'));
    await flush();
    const added = newsCalls().slice(before);
    expect(added.filter((u) => u.startsWith('/api/news/papers'))).toHaveLength(1);
    expect(added.filter((u) => u.startsWith('/api/news/topics'))).toHaveLength(1);
    expect(newsSrc()).toMatch(/mascot-reading\.png$/);
    expect($('#news-retry').hidden).toBe(true);
  });

  it('moves focus from the retry button to the papers heading and hides the button', async () => {
    let fail = true;
    state.papers = async () => (fail ? reply(502, { error: 'Upstream down' }) : reply(200, [PAPER]));
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect($('#news-retry').hidden).toBe(false));
    expect($('#papers-heading').getAttribute('tabindex')).toBe('-1');
    fail = false;
    $('#news-retry').focus();
    expect(document.activeElement).toBe($('#news-retry'));
    $('#news-retry').click();
    await flush();
    expect(document.activeElement).toBe($('#papers-heading'));
    expect($('#news-retry').hidden).toBe(true);
  });

  it('ignores a stale answer that arrives after the interests changed', async () => {
    let calls = 0;
    let failFirst;
    state.papers = () => {
      calls += 1;
      if (calls === 1) return new Promise((_, reject) => (failFirst = () => reject(new TypeError('late'))));
      return Promise.resolve(reply(200, [PAPER]));
    };
    await loadPage({ hash: '#/news', stored });
    await vi.waitFor(() => expect(failFirst).toBeTruthy());
    [...document.querySelectorAll('#category-chips button')].find((b) => b.textContent === 'cs.AI').click();
    await advance(400);
    await vi.waitFor(() => expect(newsText()).toBe('Here are the latest papers for you.'));
    failFirst();
    await flush();
    expect(newsText()).toBe('Here are the latest papers for you.');
    expect(newsSrc()).toMatch(/mascot-reading\.png$/);
    expect($('#news-retry').hidden).toBe(true);
  });

  it('is shy when only the hot topics fail', async () => {
    state.topics = async () => reply(502, { error: 'Topics down' });
    await loadPage({ hash: '#/news', stored });
    expect(newsSrc()).toMatch(/mascot-shy\.png$/);
    expect(newsText()).toBe('Hot topics are unavailable right now.');
    expect($('#news-retry').hidden).toBe(true);
  });

  it('is hidden when no interest is selected', async () => {
    await loadPage({ hash: '#/news' });
    expect(news().hidden).toBe(true);
    expect(newsCalls()).toEqual([]);
  });
});

describe('M11 review fixes', () => {
  const callsOf = () => fetchMock.mock.calls.map(([u, o]) => `${o?.method ?? 'GET'} ${u}`).sort();

  it('never says "Add your first milestone" when /api/milestones fails with 500', async () => {
    state.handlers['GET /api/milestones'] = async () => reply(500, { error: 'Server broke' });
    await loadPage({ waitForTrack: false });
    await flush();
    expect(bubble()).not.toBe('Add your first milestone with the + on the line.');
    expect(bubble()).not.toBe('');
  });

  it('setMascot does not rewrite the bubble for the same text, but still updates the image', async () => {
    document.body.innerHTML = bodyHtml;
    const { setMascot } = await import('../public/mascot.js');
    setMascot('idle', 'Same text');
    const observer = new MutationObserver(() => {});
    observer.observe($('#ramy-bubble'), { childList: true, characterData: true, subtree: true });
    setMascot('wave', 'Same text');
    expect(observer.takeRecords()).toHaveLength(0);
    expect(heroSrc()).toMatch(/mascot-wave\.png$/);
    setMascot('wave', 'Other text');
    expect(observer.takeRecords().length).toBeGreaterThan(0);
    observer.disconnect();
  });

  it('gives focus back to the opener before the refresh resolves, then updates the bubble', async () => {
    await loadPage();
    expect(bubble()).toBe('Add your first milestone with the + on the line.');
    let held = false;
    const releases = [];
    const hold = (fn) => () => (held ? new Promise((r) => releases.push(() => r(fn()))) : fn());
    state.handlers['GET /api/progress'] = hold(() => reply(200, state.progress));
    state.handlers['GET /api/upcoming'] = hold(() => reply(200, state.upcoming));
    const created = make(1, 'Late one', '2026-11-08');
    state.postMilestone = async () => {
      state.milestones = [created];
      held = true;
      return reply(201, created);
    };
    const opener = $('#header-add');
    opener.click();
    const form = $('#milestone-form');
    form.elements.title.value = 'Late one';
    form.elements.targetDate.value = '2026-11-08';
    form.elements.title.focus();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    expect(document.activeElement).toBe(opener);
    expect(bubble()).toBe('Add your first milestone with the + on the line.');
    held = false;
    for (const release of releases) release();
    await flush();
    expect(bubble()).toBe('Late one was due 4 days ago, want to update it?');
  });

  it('asks the API once each after adding a milestone', async () => {
    await loadPage();
    const created = make(1, 'Chapter', '2027-01-01');
    state.postMilestone = async () => {
      state.milestones = [created];
      return reply(201, created);
    };
    fetchMock.mockClear();
    const form = $('#milestone-form');
    form.elements.title.value = 'Chapter';
    form.elements.targetDate.value = '2027-01-01';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    await flush();
    expect(callsOf()).toEqual(['GET /api/milestones', 'GET /api/progress', 'GET /api/upcoming', 'POST /api/milestones']);
  });

  it('asks only for the status change, progress and upcoming after a status change', async () => {
    state.milestones = [make(1, 'Chapter', '2027-01-01')];
    await loadPage();
    state.patch = async () => reply(200, make(1, 'Chapter', '2027-01-01', 'doing'));
    fetchMock.mockClear();
    await setStatus(0, 'doing');
    await flush();
    expect(callsOf()).toEqual(['GET /api/progress', 'GET /api/upcoming', 'PATCH /api/milestones/1/status']);
  });
});
