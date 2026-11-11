// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Not imported from helpers.js: it loads src/app.js, which cannot load under happy-dom.
const TODAY = '2026-11-12';

const html = readFileSync(resolve(process.cwd(), 'public/index.html'), 'utf8');
const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1];

const make = (id, title, targetDate, status) => ({
  id, title, targetDate, notes: '', status, createdAt: '2026-11-01T10:00:00.000Z',
});
const MILESTONES = [
  make(1, 'Literature review', '2026-11-01', 'done'),
  make(2, 'Ethics approval', '2026-11-20', 'doing'),
  make(3, 'First experiment', '2026-12-10', 'todo'),
  make(4, 'Lab access', '2026-12-20', 'blocked'),
];
const PROGRESS = { total: 4, done: 1, percent: 25, byStatus: { todo: 1, doing: 1, done: 1, blocked: 1 } };
const PROGRESS_AFTER = { total: 4, done: 2, percent: 50, byStatus: { todo: 0, doing: 1, done: 2, blocked: 1 } };

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

// patch handles PATCH requests (returns a response or throws); progress answers GET /api/progress.
async function loadPage({ patch, progress = () => reply(200, PROGRESS) } = {}) {
  document.body.innerHTML = bodyHtml;
  globalThis.fetch = vi.fn(async (url, options) => {
    if (options?.method === 'PATCH') return patch(url, options);
    if (String(url).startsWith('/api/progress')) return progress();
    return reply(200, MILESTONES);
  });
  vi.resetModules();
  await import('../public/app.js');
  await vi.waitFor(() => expect(document.querySelector('.roadmap-track')).toBeTruthy());
  await vi.waitFor(() => expect(document.querySelector('#progress-text').textContent).toContain('milestones done'));
}

const nodes = () => [...document.querySelectorAll('.node-btn:not(.add-node)')];
const select = () => document.getElementById('detail-status');
const errorText = () => document.getElementById('milestone-error').textContent;

function chooseStatus(value) {
  select().value = value;
  select().dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('US-02 status badge on each milestone', () => {
  it('gives every node a status shape class and the status name in its text', async () => {
    await loadPage();
    const expected = [['done', 'Done'], ['doing', 'In progress'], ['todo', 'To do'], ['blocked', 'Blocked']];
    const found = nodes();
    expect(found).toHaveLength(4);
    for (const [i, [value, label]] of expected.entries()) {
      expect(found[i].querySelector(`.node-shape.status-${value}`), value).toBeTruthy();
      expect(found[i].querySelector('.node-status').textContent).toContain(label);
      expect(found[i].getAttribute('aria-label')).toContain(label);
    }
  });
});

describe('US-02 status selector in the detail popover', () => {
  it('has a labelled select with the four options preselected to the current status', async () => {
    await loadPage();
    nodes()[1].click();
    const label = document.querySelector('label.popover-status-label');
    expect(label.textContent).toBe('Status');
    expect(label.htmlFor).toBe('detail-status');
    expect([...select().options].map((o) => o.value)).toEqual(['todo', 'doing', 'done', 'blocked']);
    expect(select().value).toBe('doing');
  });

  it('preselects the status of the milestone that was clicked', async () => {
    await loadPage();
    nodes()[3].click();
    expect(select().value).toBe('blocked');
  });
});

describe('US-02 progress card', () => {
  it('shows the sentence, one count per status and the progressbar values', async () => {
    await loadPage();
    expect(document.getElementById('progress-text').textContent).toBe('1 of 4 milestones done (25%)');
    for (const status of ['todo', 'doing', 'done', 'blocked']) {
      expect(document.getElementById(`progress-count-${status}`).textContent).toBe('1');
    }
    const bar = document.getElementById('progress-bar');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    expect(document.getElementById('progress-fill').style.width).toBe('25%');
    expect(document.querySelectorAll('.progress-status-name')).toHaveLength(4);
  });

  it('is reachable from a nav link', async () => {
    await loadPage();
    expect(document.querySelector('nav a[href="#progress-section"]')).toBeTruthy();
    expect(document.querySelector('section#progress-section.card')).toBeTruthy();
  });

  it('shows the generic message when the progress response is malformed', async () => {
    document.body.innerHTML = bodyHtml;
    globalThis.fetch = vi.fn(async (url) =>
      String(url).startsWith('/api/progress') ? reply(200, { total: 'x' }) : reply(200, MILESTONES));
    vi.resetModules();
    await import('../public/app.js');
    await vi.waitFor(() => expect(errorText()).toBe('Something went wrong. Please try again.'));
  });
});

describe('US-02 changing a status from the page', () => {
  it('updates the badge and the progress without a reload after a successful PATCH', async () => {
    let progressCalls = 0;
    await loadPage({
      patch: (url, options) => {
        expect(url).toBe('/api/milestones/2/status');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(options.body)).toEqual({ status: 'done' });
        return reply(200, { ...MILESTONES[1], status: 'done' });
      },
      progress: () => reply(200, progressCalls++ === 0 ? PROGRESS : PROGRESS_AFTER),
    });
    nodes()[1].click();
    chooseStatus('done');
    await vi.waitFor(() => expect(document.getElementById('progress-text').textContent).toBe('2 of 4 milestones done (50%)'));
    expect(document.getElementById('progress-count-done').textContent).toBe('2');
    expect(document.getElementById('progress-bar').getAttribute('aria-valuenow')).toBe('50');
    expect(nodes()[1].querySelector('.node-shape').classList.contains('status-done')).toBe(true);
    expect(nodes()[1].querySelector('.node-status').textContent).toContain('Done');
    expect(errorText()).toBe('');
  });

  it('shows the API message and keeps the previous status after a 400', async () => {
    await loadPage({ patch: () => reply(400, { error: 'Status must be one of: todo, doing, done, blocked' }) });
    nodes()[1].click();
    chooseStatus('done');
    await vi.waitFor(() => expect(errorText()).toBe('Status must be one of: todo, doing, done, blocked'));
    expect(select().value).toBe('doing');
    expect(select().disabled).toBe(false);
    const shape = nodes()[1].querySelector('.node-shape');
    expect(shape.classList.contains('status-doing')).toBe(true);
    expect(shape.classList.contains('status-done')).toBe(false);
    expect(document.getElementById('progress-text').textContent).toBe('1 of 4 milestones done (25%)');
  });

  it('shows the API message for a 404', async () => {
    await loadPage({ patch: () => reply(404, { error: 'Milestone not found' }) });
    nodes()[0].click();
    chooseStatus('todo');
    await vi.waitFor(() => expect(errorText()).toBe('Milestone not found'));
    expect(select().value).toBe('done');
  });

  it('shows the network message and keeps the status when fetch rejects', async () => {
    await loadPage({
      patch: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    nodes()[1].click();
    chooseStatus('blocked');
    await vi.waitFor(() => expect(errorText()).toBe('Network error. Check your connection and try again.'));
    expect(select().value).toBe('doing');
    expect(nodes()[1].querySelector('.node-shape').classList.contains('status-doing')).toBe(true);
  });
});

describe('US-02 popover behaviour around a status change', () => {
  const okPatch = () => reply(200, { ...MILESTONES[1], status: 'done' });

  it('keeps the detail popover open and shows the new value after a successful PATCH', async () => {
    await loadPage({ patch: okPatch, progress: () => reply(200, PROGRESS_AFTER) });
    nodes()[1].click();
    chooseStatus('done');
    await vi.waitFor(() => expect(nodes()[1].querySelector('.node-shape.status-done')).toBeTruthy());
    await vi.waitFor(() => expect(select().disabled).toBe(false));
    const popover = document.getElementById('detail-title').parentElement;
    expect(popover.hidden).toBe(false);
    expect(select().value).toBe('done');
  });

  it('returns focus to the new node button for that milestone on Escape after the redraw', async () => {
    await loadPage({ patch: okPatch, progress: () => reply(200, PROGRESS_AFTER) });
    const oldNode = nodes()[1];
    oldNode.click();
    chooseStatus('done');
    await vi.waitFor(() => expect(nodes()[1].querySelector('.node-shape.status-done')).toBeTruthy());
    await vi.waitFor(() => expect(select().disabled).toBe(false));
    const newNode = nodes()[1];
    expect(newNode).not.toBe(oldNode);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('detail-title').parentElement.hidden).toBe(true);
    expect(document.activeElement).toBe(newNode);
  });

  it('disables the select while the PATCH is in flight and re-enables it afterwards', async () => {
    let release;
    const pending = new Promise((r) => {
      release = r;
    });
    await loadPage({ patch: () => pending, progress: () => reply(200, PROGRESS_AFTER) });
    nodes()[1].click();
    chooseStatus('done');
    expect(select().disabled).toBe(true);
    release(okPatch());
    await vi.waitFor(() => expect(select().disabled).toBe(false));
    expect(select().value).toBe('done');
  });

  it('calls scrollIntoView on the error area when a status change fails', async () => {
    await loadPage({ patch: () => reply(400, { error: 'Status must be one of: todo, doing, done, blocked' }) });
    const scroll = vi.fn();
    document.getElementById('milestone-error').scrollIntoView = scroll;
    nodes()[1].click();
    chooseStatus('done');
    await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
  });

  it('ignores an older progress response that arrives after a newer one', async () => {
    let releaseOld;
    const old = new Promise((r) => {
      releaseOld = r;
    });
    document.body.innerHTML = bodyHtml;
    let progressCalls = 0;
    globalThis.fetch = vi.fn(async (url, options) => {
      if (options?.method === 'PATCH') return okPatch();
      if (String(url).startsWith('/api/progress')) {
        // The first (initial) request stays pending; the one after the PATCH answers at once.
        return progressCalls++ === 0 ? old : reply(200, PROGRESS_AFTER);
      }
      return reply(200, MILESTONES);
    });
    vi.resetModules();
    await import('../public/app.js');
    await vi.waitFor(() => expect(document.querySelector('.roadmap-track')).toBeTruthy());
    nodes()[1].click();
    chooseStatus('done');
    await vi.waitFor(() => expect(document.getElementById('progress-text').textContent).toBe('2 of 4 milestones done (50%)'));
    releaseOld(reply(200, PROGRESS));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('progress-text').textContent).toBe('2 of 4 milestones done (50%)');
    expect(document.getElementById('progress-bar').getAttribute('aria-valuenow')).toBe('50');
  });

  // Not tested: closing the popover when the open milestone vanishes from the list. The page has
  // no delete flow, so it cannot be reached without touching internals.
});
