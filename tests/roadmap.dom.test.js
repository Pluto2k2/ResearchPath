// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Not imported from helpers.js: it loads src/app.js, which cannot load under happy-dom (non-file URL).
const TODAY = '2026-11-12';

const html = readFileSync(resolve(process.cwd(), 'public/index.html'), 'utf8');
const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1];

const MILESTONE = {
  id: 1,
  title: 'Literature review',
  targetDate: '2026-12-01',
  notes: 'Cover the last five years',
  status: 'todo',
  createdAt: '2026-11-01T10:00:00.000Z',
};

async function loadPage(milestones) {
  document.body.innerHTML = bodyHtml;
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () =>
      String(url).startsWith('/api/progress')
        ? { total: milestones.length, done: 0, percent: 0, byStatus: { todo: milestones.length, doing: 0, done: 0, blocked: 0 } }
        : milestones,
  }));
  vi.resetModules();
  await import('../public/app.js');
  await vi.waitFor(() => expect(document.querySelector('.roadmap-track')).toBeTruthy());
}

// The add popover is also role=dialog, so find the detail one through its title.
function detailPopover() {
  return document.getElementById('detail-title').parentElement;
}

function pointerdown(target) {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

afterEach(() => {
  // Close any popover left open so its document listeners do not leak into the next test.
  pressEscape();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('AC7 milestone details popover', () => {
  let node;
  let popover;

  beforeEach(async () => {
    await loadPage([MILESTONE]);
    node = document.querySelector('.node-btn:not(.add-node)');
  });

  it('opens the popover with the title and notes as text when a node is clicked', () => {
    node.click();
    popover = detailPopover();
    expect(popover.hidden).toBe(false);
    expect(popover.querySelector('.popover-title').textContent).toBe('Literature review');
    expect(popover.querySelector('.popover-notes').textContent).toBe('Cover the last five years');
  });

  it('closes on Escape and gives focus back to the milestone node', () => {
    node.click();
    popover = detailPopover();
    pressEscape();
    expect(popover.hidden).toBe(true);
    expect(document.activeElement).toBe(node);
  });

  it('closes with the x button and gives focus back to the milestone node', () => {
    node.click();
    node.click(); // toggles closed
    node.click(); // reopen
    popover = detailPopover();
    expect(popover.hidden).toBe(false);
    popover.querySelector('.popover-close').click();
    expect(popover.hidden).toBe(true);
    expect(document.activeElement).toBe(node);
  });

  it('closes on a pointerdown outside the popover', () => {
    node.click();
    popover = detailPopover();
    expect(popover.hidden).toBe(false);
    pointerdown(document.body);
    expect(popover.hidden).toBe(true);
  });
});

describe('AC6 the + node opens the add form', () => {
  it('shows #add-popover with the milestone form inside when + is clicked', async () => {
    await loadPage([MILESTONE]);
    const addPopover = document.getElementById('add-popover');
    expect(addPopover.hidden).toBe(true);
    document.querySelector('.add-node').click();
    expect(addPopover.hidden).toBe(false);
    expect(addPopover.contains(document.querySelector('#milestone-form'))).toBe(true);
  });

  it('opens from the header + Milestone button and Escape closes it, returning focus to that button', async () => {
    await loadPage([MILESTONE]);
    const addPopover = document.getElementById('add-popover');
    const headerAdd = document.getElementById('header-add');
    expect(addPopover.hidden).toBe(true);
    headerAdd.click();
    expect(addPopover.hidden).toBe(false);
    expect(addPopover.contains(document.querySelector('#milestone-form'))).toBe(true);
    pressEscape();
    expect(addPopover.hidden).toBe(true);
    expect(document.activeElement).toBe(headerAdd);
  });
});

describe('AC10 empty state', () => {
  it('shows "Start your path" when there are no milestones', async () => {
    await loadPage([]);
    expect(document.querySelector('#roadmap').textContent).toContain('Start your path');
  });
});
