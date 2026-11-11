import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers.js';

describe('US-02 GET /api/progress', () => {
  let app;

  // Creates milestones with the given statuses (all start as todo).
  async function seed(statuses) {
    for (const [i, status] of statuses.entries()) {
      const res = await request(app)
        .post('/api/milestones')
        .send({ title: `Milestone ${i}`, targetDate: '2026-12-01' });
      if (status !== 'todo') await request(app).patch(`/api/milestones/${res.body.id}/status`).send({ status });
    }
  }

  const progress = async () => (await request(app).get('/api/progress')).body;

  beforeEach(() => {
    app = createTestApp();
  });

  it('returns zeros when there are no milestones', async () => {
    const res = await request(app).get('/api/progress');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 0,
      done: 0,
      percent: 0,
      byStatus: { todo: 0, doing: 0, done: 0, blocked: 0 },
    });
  });

  it('gives 25 percent for 1 done out of 4', async () => {
    await seed(['done', 'todo', 'todo', 'doing']);
    const body = await progress();
    expect(body).toMatchObject({ total: 4, done: 1, percent: 25 });
  });

  it.each([
    ['1 of 3', ['done', 'todo', 'todo'], 33],
    ['2 of 3', ['done', 'done', 'todo'], 67],
    ['1 of 8', ['done', ...Array(7).fill('todo')], 13],
  ])('rounds the percent for %s', async (_name, statuses, percent) => {
    await seed(statuses);
    expect((await progress()).percent).toBe(percent);
  });

  it('counts each status and total equals the sum', async () => {
    await seed(['todo', 'doing', 'doing', 'done', 'blocked', 'blocked', 'blocked']);
    const body = await progress();
    expect(body.byStatus).toEqual({ todo: 1, doing: 2, done: 1, blocked: 3 });
    expect(body.total).toBe(7);
    expect(Object.values(body.byStatus).reduce((a, b) => a + b, 0)).toBe(body.total);
  });

  it('reflects a status change right away', async () => {
    await seed(['todo', 'todo']);
    expect((await progress()).percent).toBe(0);
    await request(app).patch('/api/milestones/1/status').send({ status: 'done' });
    expect(await progress()).toMatchObject({ done: 1, percent: 50 });
  });
});
