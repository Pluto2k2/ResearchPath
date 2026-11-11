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
const DONE_PAST = make(1, 'Literature review', '2026-11-01', 'done');
const TODO_PAST = make(2, 'Ethics approval', '2026-11-05', 'todo');
const PROGRESS = { total: 2, done: 1, percent: 50, byStatus: { todo: 1, doing: 0, done: 1, blocked: 0 } };

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

async function loadPage(milestones, patch) {
  document.body.innerHTML = bodyHtml;
  globalThis.fetch = vi.fn(async (url, options) => {
    if (options?.method === 'PATCH') return patch(url, options);
    if (String(url).startsWith('/api/progress')) return reply(200, PROGRESS);
    if (String(url).startsWith('/api/upcoming')) return reply(200, []);
    return reply(200, milestones);
  });
  vi.resetModules();
  await import('../public/app.js');
  await vi.waitFor(() => expect(document.querySelector('.roadmap-track')).toBeTruthy());
}

const nodes = () => [...document.querySelectorAll('.node-btn:not(.add-node)')];
const popover = () => document.getElementById('detail-title').parentElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('M10 a done milestone is not shown as overdue', () => {
  it('has no halo on a done past node and shows "N days ago"', async () => {
    await loadPage([DONE_PAST, TODO_PAST]);
    const node = nodes()[0];
    expect(node.classList.contains('is-overdue')).toBe(false);
    expect(node.querySelector('.node-rel').textContent).toContain('11 days ago');
    expect(node.querySelector('.node-rel').textContent).not.toContain('overdue');
    expect(node.getAttribute('aria-label')).toContain('11 days ago');
  });

  it('shows no overdue style in the detail popover of a done past milestone', async () => {
    await loadPage([DONE_PAST, TODO_PAST]);
    nodes()[0].click();
    const rel = popover().querySelector('.popover-relative');
    expect(rel.textContent).toBe('11 days ago');
    expect(rel.classList.contains('is-overdue')).toBe(false);
  });

  it('keeps the halo and "overdue" wording on a todo past node and its popover', async () => {
    await loadPage([DONE_PAST, TODO_PAST]);
    const node = nodes()[1];
    expect(node.classList.contains('is-overdue')).toBe(true);
    expect(node.querySelector('.node-rel').textContent).toContain('7 days overdue');
    node.click();
    const rel = popover().querySelector('.popover-relative');
    expect(rel.textContent).toBe('7 days overdue');
    expect(rel.classList.contains('is-overdue')).toBe(true);
  });

  it('brings the halo back when a done milestone is changed to todo', async () => {
    await loadPage([DONE_PAST, TODO_PAST], () => reply(200, { ...DONE_PAST, status: 'todo' }));
    nodes()[0].click();
    const select = document.getElementById('detail-status');
    select.value = 'todo';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(nodes()[0].classList.contains('is-overdue')).toBe(true));
    expect(nodes()[0].querySelector('.node-rel').textContent).toContain('11 days overdue');
  });
});
