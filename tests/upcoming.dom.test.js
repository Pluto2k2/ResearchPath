// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysText, isSafeUrl, kindLabel, renderUpcoming, renderUpcomingItem } from '../public/upcoming.js';

// Not imported from helpers.js: it loads src/app.js, which cannot load under happy-dom.
const TODAY = '2026-11-12';

const html = readFileSync(resolve(process.cwd(), 'public/index.html'), 'utf8');
const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)[1];

const eventItem = (over = {}) => ({
  kind: 'event', id: 1, title: 'ICML', date: '2026-11-20', daysLeft: 8,
  overdue: false, type: 'conference', url: 'https://icml.cc', ...over,
});
const milestoneItem = (over = {}) => ({
  kind: 'milestone', id: 2, title: 'Draft', date: '2026-11-17', daysLeft: 5,
  overdue: false, status: 'todo', ...over,
});

const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  document.body.innerHTML = bodyHtml;
});

afterEach(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('US-03 page structure', () => {
  it('has an Upcoming nav link to #upcoming-section and the section exists', () => {
    const link = document.querySelector('nav a[href="#upcoming-section"]');
    expect(link.textContent.trim()).toBe('Upcoming');
    expect(document.querySelector('section#upcoming-section.card')).toBeTruthy();
  });

  it('has a "Next 30 days" heading, an add button and a list', () => {
    expect(document.querySelector('#upcoming-section h2').textContent).toBe('Next 30 days');
    const add = document.getElementById('event-add');
    expect(add.textContent.trim()).toBe('+ Event');
    expect(add.getAttribute('aria-label')).toBe('Add an event');
    expect(document.querySelector('ul#upcoming-list')).toBeTruthy();
  });

  it('has an event form with title, type (4 options), date, url and notes', () => {
    const form = document.getElementById('event-form');
    expect(form).toBeTruthy();
    for (const id of ['event-title', 'event-type', 'event-date', 'event-url', 'event-notes']) {
      expect(form.querySelector(`#${id}`), id).toBeTruthy();
      expect(form.querySelector(`label[for="${id}"]`), `label ${id}`).toBeTruthy();
    }
    const options = [...form.querySelectorAll('#event-type option')].map((o) => o.value);
    expect(options).toEqual(['conference', 'seminar', 'deadline', 'funding']);
    expect(form.querySelector('button[type="submit"]').textContent.trim()).toBe('Add event');
  });
});

describe('US-03 upcoming helpers', () => {
  it('formats days left, singular and plural', () => {
    expect(daysText({ daysLeft: 0 })).toBe('today');
    expect(daysText({ daysLeft: 1 })).toBe('1 day left');
    expect(daysText({ daysLeft: 8 })).toBe('8 days left');
    expect(daysText({ daysLeft: -1 })).toBe('1 day overdue');
    expect(daysText({ daysLeft: -3 })).toBe('3 days overdue');
  });

  it('labels the kind of each item', () => {
    expect(kindLabel(milestoneItem())).toBe('Milestone');
    expect(kindLabel(eventItem({ type: 'seminar' }))).toBe('Seminar');
    expect(kindLabel(eventItem({ type: 'deadline' }))).toBe('Deadline');
    expect(kindLabel(eventItem({ type: 'funding' }))).toBe('Funding call');
    expect(kindLabel(eventItem({ type: 'conference' }))).toBe('Conference');
  });

  it('accepts only http and https urls', () => {
    expect(isSafeUrl('https://x.org')).toBe(true);
    expect(isSafeUrl('http://x.org')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('ftp://x')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
  });
});

describe('US-03 rendering the Next 30 days panel', () => {
  it('shows date, days text and kind label for an item', () => {
    const li = renderUpcomingItem(eventItem());
    expect(li.classList.contains('upcoming-item')).toBe(true);
    expect(li.querySelector('.upcoming-date').textContent).toBe('20 Nov');
    expect(li.querySelector('.upcoming-days').textContent).toBe('8 days left');
    expect(li.querySelector('.upcoming-kind').textContent).toBe('Conference');
    expect(li.querySelector('.upcoming-title').textContent).toBe('ICML');
    expect(li.classList.contains('overdue')).toBe(false);
    expect(li.querySelector('.upcoming-flag')).toBeNull();
  });

  it('flags an overdue item with a class and the visible word "Overdue"', () => {
    const li = renderUpcomingItem(milestoneItem({ daysLeft: -2, overdue: true, date: '2026-11-10' }));
    expect(li.classList.contains('overdue')).toBe(true);
    expect(li.querySelector('.upcoming-flag').textContent).toBe('Overdue');
    expect(li.querySelector('.upcoming-days').textContent).toBe('2 days overdue');
  });

  it('opens an event url in a new tab with rel noopener', () => {
    const a = renderUpcomingItem(eventItem()).querySelector('a.upcoming-title');
    expect(a.getAttribute('href')).toBe('https://icml.cc');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('has no link for an event without url or for a milestone', () => {
    expect(renderUpcomingItem(eventItem({ url: null })).querySelector('a')).toBeNull();
    expect(renderUpcomingItem(milestoneItem()).querySelector('a')).toBeNull();
  });

  it('renders a javascript: url without a link', () => {
    const li = renderUpcomingItem(eventItem({ url: 'javascript:alert(1)' }));
    expect(li.querySelector('a')).toBeNull();
    expect(li.querySelector('.upcoming-title').textContent).toBe('ICML');
  });

  it('renders HTML in a title as text, never as elements', () => {
    const title = '<img src=x onerror=alert(1)>';
    const li = renderUpcomingItem(eventItem({ title }));
    expect(li.querySelector('img')).toBeNull();
    expect(li.querySelector('.upcoming-title').textContent).toBe(title);
  });

  it('renders every item, in the given order', () => {
    const list = document.getElementById('upcoming-list');
    renderUpcoming(list, [milestoneItem({ title: 'first' }), eventItem({ title: 'second' })]);
    expect([...list.querySelectorAll('.upcoming-title')].map((n) => n.textContent)).toEqual(['first', 'second']);
  });

  it('shows the empty state for an empty list and replaces old content', () => {
    const list = document.getElementById('upcoming-list');
    renderUpcoming(list, [eventItem()]);
    renderUpcoming(list, []);
    expect(list.querySelectorAll('.upcoming-item')).toHaveLength(0);
    expect(list.querySelector('li.upcoming-empty').textContent).toBe('Nothing due in the next 30 days.');
  });
});

describe('US-03 panel refreshes without a reload', () => {
  const MILESTONES = [{
    id: 2, title: 'Draft', targetDate: '2026-11-17', notes: '', status: 'todo',
    createdAt: '2026-11-01T10:00:00.000Z',
  }];
  const PROGRESS = { total: 1, done: 0, percent: 0, byStatus: { todo: 1, doing: 0, done: 0, blocked: 0 } };
  const errorText = () => document.getElementById('milestone-error').textContent;
  const titles = () => [...document.querySelectorAll('#upcoming-list .upcoming-title')].map((n) => n.textContent);

  // Returns the mocked fetch so tests can count the calls.
  async function loadPage({ upcoming, eventPost, patch }) {
    globalThis.fetch = vi.fn(async (url, options) => {
      const u = String(url);
      if (u === '/api/events' && options?.method === 'POST') return eventPost(options);
      if (options?.method === 'PATCH') return patch();
      if (u.startsWith('/api/upcoming')) return upcoming();
      if (u.startsWith('/api/progress')) return reply(200, PROGRESS);
      return reply(200, MILESTONES);
    });
    vi.resetModules();
    await import('../public/app.js');
    await vi.waitFor(() => expect(document.querySelector('.roadmap-track')).toBeTruthy());
    return globalThis.fetch;
  }
  const upcomingCalls = () => globalThis.fetch.mock.calls.filter(([u]) => String(u) === '/api/upcoming').length;

  function submitEvent() {
    document.getElementById('event-title').value = 'Grant call';
    document.getElementById('event-type').value = 'funding';
    document.getElementById('event-date').value = '2026-11-30';
    document.getElementById('event-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  it('loads the panel on page load', async () => {
    await loadPage({ upcoming: () => reply(200, [eventItem({ title: 'On load' })]) });
    await vi.waitFor(() => expect(titles()).toEqual(['On load']));
  });

  it('posts the event, refetches /api/upcoming and shows the new item', async () => {
    let added = false;
    let sent;
    await loadPage({
      upcoming: () => reply(200, added ? [eventItem({ title: 'Grant call', type: 'funding', url: null })] : []),
      eventPost: (options) => {
        added = true;
        sent = JSON.parse(options.body);
        return reply(201, { id: 9 });
      },
    });
    await vi.waitFor(() => expect(document.querySelector('.upcoming-empty')).toBeTruthy());
    const before = upcomingCalls();
    submitEvent();
    await vi.waitFor(() => expect(titles()).toEqual(['Grant call']));
    expect(upcomingCalls()).toBe(before + 1);
    expect(sent).toMatchObject({ title: 'Grant call', type: 'funding', date: '2026-11-30' });
    expect(errorText()).toBe('');
  });

  it('refetches the panel after a status change to done and the item disappears', async () => {
    let done = false;
    await loadPage({
      upcoming: () => reply(200, done ? [] : [milestoneItem({ title: 'Draft' })]),
      patch: () => {
        done = true;
        return reply(200, { ...MILESTONES[0], status: 'done' });
      },
    });
    await vi.waitFor(() => expect(titles()).toEqual(['Draft']));
    const before = upcomingCalls();
    document.querySelector('.node-btn:not(.add-node)').click();
    const select = document.getElementById('detail-status');
    select.value = 'done';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(titles()).toEqual([]));
    expect(upcomingCalls()).toBe(before + 1);
    expect(document.querySelector('.upcoming-empty')).toBeTruthy();
  });

  it('shows the API message in #milestone-error when the event POST fails', async () => {
    await loadPage({
      upcoming: () => reply(200, []),
      eventPost: () => reply(400, { error: 'Type must be one of: conference, seminar, deadline, funding' }),
    });
    const before = upcomingCalls();
    submitEvent();
    await vi.waitFor(() => expect(errorText()).toBe('Type must be one of: conference, seminar, deadline, funding'));
    expect(upcomingCalls()).toBe(before);
  });
});
