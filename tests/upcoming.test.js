import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers.js';

// TODAY is 2026-11-12, so the window ends on 2026-12-12.
describe('US-03 GET /api/upcoming', () => {
  let app;
  const addEvent = async (title, date, extra = {}) =>
    (await request(app).post('/api/events').send({ title, type: 'conference', date, ...extra })).body;
  const addMilestone = async (title, targetDate) =>
    (await request(app).post('/api/milestones').send({ title, targetDate })).body;
  const setStatus = (id, status) => request(app).patch(`/api/milestones/${id}/status`).send({ status });
  const upcoming = async () => {
    const res = await request(app).get('/api/upcoming');
    expect(res.status).toBe(200);
    return res.body;
  };
  const titles = async () => (await upcoming()).map((i) => i.title);

  beforeEach(() => {
    app = createTestApp();
  });

  it('returns an empty array on an empty database', async () => {
    expect(await upcoming()).toEqual([]);
  });

  describe('events window', () => {
    it('includes an event today with daysLeft 0', async () => {
      await addEvent('today', '2026-11-12');
      const [item] = await upcoming();
      expect(item.title).toBe('today');
      expect(item.daysLeft).toBe(0);
      expect(item.overdue).toBe(false);
    });

    it('includes an event on the last day (today+30) with daysLeft 30', async () => {
      await addEvent('last', '2026-12-12');
      const [item] = await upcoming();
      expect(item.daysLeft).toBe(30);
    });

    it('excludes an event the day after the window', async () => {
      await addEvent('too far', '2026-12-13');
      expect(await upcoming()).toEqual([]);
    });

    it('excludes an event dated yesterday (past events are never overdue)', async () => {
      await addEvent('past', '2026-11-11');
      expect(await upcoming()).toEqual([]);
    });
  });

  describe('milestones', () => {
    it('includes a todo milestone in 5 days with its status', async () => {
      const m = await addMilestone('Draft', '2026-11-17');
      const [item] = await upcoming();
      expect(item).toMatchObject({
        kind: 'milestone', id: m.id, title: 'Draft', date: '2026-11-17',
        daysLeft: 5, overdue: false, status: 'todo',
      });
    });

    it('drops a milestone once it is set to done', async () => {
      const m = await addMilestone('Draft', '2026-11-17');
      expect(await titles()).toEqual(['Draft']);
      await setStatus(m.id, 'done');
      expect(await titles()).toEqual([]);
    });

    it.each(['doing', 'blocked'])('keeps a milestone with status %s', async (status) => {
      const m = await addMilestone('Draft', '2026-11-17');
      await setStatus(m.id, status);
      const [item] = await upcoming();
      expect(item.status).toBe(status);
    });

    it('lists a past todo milestone first, flagged overdue with negative daysLeft', async () => {
      await addEvent('soon', '2026-11-13');
      await addMilestone('Late', '2026-11-11');
      const items = await upcoming();
      expect(items.map((i) => i.title)).toEqual(['Late', 'soon']);
      expect(items[0]).toMatchObject({ overdue: true, daysLeft: -1, kind: 'milestone' });
    });

    it('excludes a past milestone that is done', async () => {
      const m = await addMilestone('Old', '2026-11-01');
      await setStatus(m.id, 'done');
      expect(await upcoming()).toEqual([]);
    });

    it('excludes a milestone dated after the window (today+31)', async () => {
      await addMilestone('Far', '2026-12-13');
      expect(await upcoming()).toEqual([]);
    });

    it('includes a milestone dated today without flagging it overdue', async () => {
      await addMilestone('Now', '2026-11-12');
      const [item] = await upcoming();
      expect(item).toMatchObject({ daysLeft: 0, overdue: false });
    });
  });

  describe('ordering', () => {
    it('puts several overdue milestones first, by date, before items of today', async () => {
      await addEvent('event today', '2026-11-12');
      await addMilestone('overdue newer', '2026-11-10');
      await addMilestone('overdue older', '2026-10-01');
      expect(await titles()).toEqual(['overdue older', 'overdue newer', 'event today']);
    });

    it('sorts the rest by date ascending', async () => {
      await addEvent('c', '2026-12-01');
      await addMilestone('a', '2026-11-14');
      await addEvent('b', '2026-11-20');
      expect(await titles()).toEqual(['a', 'b', 'c']);
    });

    it('puts a milestone before an event on the same date', async () => {
      await addEvent('event', '2026-11-20');
      await addMilestone('milestone', '2026-11-20');
      const items = await upcoming();
      expect(items.map((i) => i.kind)).toEqual(['milestone', 'event']);
    });
  });

  describe('item shape', () => {
    it('gives an event type and url, and no status key', async () => {
      const e = await addEvent('Conf', '2026-11-20', { url: 'https://conf.org' });
      const [item] = await upcoming();
      expect(item).toEqual({
        kind: 'event', id: e.id, title: 'Conf', date: '2026-11-20',
        daysLeft: 8, overdue: false, type: 'conference', url: 'https://conf.org',
      });
      expect('status' in item).toBe(false);
    });

    it('gives a null url when the event has none', async () => {
      await addEvent('Conf', '2026-11-20');
      const [item] = await upcoming();
      expect(item.url).toBeNull();
    });

    it('gives a milestone a status and no type or url key', async () => {
      await addMilestone('M', '2026-11-20');
      const [item] = await upcoming();
      expect(Object.keys(item).sort()).toEqual(
        ['date', 'daysLeft', 'id', 'kind', 'overdue', 'status', 'title'],
      );
      expect('type' in item).toBe(false);
      expect('url' in item).toBe(false);
    });

    it('sets overdue false on every non-overdue item', async () => {
      await addEvent('e', '2026-11-20');
      await addMilestone('m', '2026-11-25');
      const items = await upcoming();
      expect(items.every((i) => i.overdue === false)).toBe(true);
    });
  });
});
