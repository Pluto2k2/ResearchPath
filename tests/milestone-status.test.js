import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers.js';

const MESSAGE = 'Status must be one of: todo, doing, done, blocked';

describe('US-02 PATCH /api/milestones/:id/status', () => {
  let app;
  let id;

  const patch = (target, body) => request(app).patch(`/api/milestones/${target}/status`).send(body);

  beforeEach(async () => {
    app = createTestApp();
    const res = await request(app)
      .post('/api/milestones')
      .send({ title: 'Literature review', targetDate: '2026-12-01', notes: 'Five years' });
    id = res.body.id;
  });

  it.each(['todo', 'doing', 'done', 'blocked'])('accepts "%s" and returns the updated milestone', async (status) => {
    const res = await patch(id, { status });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      title: 'Literature review',
      targetDate: '2026-12-01',
      notes: 'Five years',
      status,
    });
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('persists the new status in GET /api/milestones', async () => {
    await patch(id, { status: 'doing' });
    const list = await request(app).get('/api/milestones');
    expect(list.body.find((m) => m.id === id).status).toBe('doing');
  });

  it('trims the status before checking it', async () => {
    const res = await patch(id, { status: ' done ' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });

  it('accepts the same status twice', async () => {
    expect((await patch(id, { status: 'done' })).status).toBe(200);
    const again = await patch(id, { status: 'done' });
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('done');
  });

  it('ignores extra fields', async () => {
    const res = await patch(id, { status: 'doing', title: 'Hacked', id: 99 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Literature review');
    expect(res.body.id).toBe(id);
  });

  it.each([
    ['wrong case', { status: 'DONE' }],
    ['unknown value', { status: 'finished' }],
    ['empty string', { status: '' }],
    ['blank string', { status: '   ' }],
    ['number', { status: 123 }],
    ['null', { status: null }],
    ['missing field', {}],
    ['SQL text', { status: "done'; DROP TABLE milestones;--" }],
    ['HTML text', { status: '<script>alert(1)</script>' }],
  ])('rejects %s with 400 and the allowed values', async (_name, body) => {
    const res = await patch(id, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: MESSAGE });
  });

  it('rejects an array body with 400', async () => {
    const res = await patch(id, ['done']);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Request body must be a JSON object' });
  });

  it.each(['999', 'abc', '1.5', '-1', '99999999999999999999'])('answers 404 for id %s', async (badId) => {
    const res = await patch(badId, { status: 'done' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Milestone not found' });
  });

  it('answers 400 "Invalid JSON" for malformed JSON', async () => {
    const res = await request(app)
      .patch(`/api/milestones/${id}/status`)
      .set('Content-Type', 'application/json')
      .send('{"status": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });

  it('keeps the stored status unchanged after a failed PATCH', async () => {
    await patch(id, { status: 'doing' });
    await patch(id, { status: 'finished' });
    const list = await request(app).get('/api/milestones');
    expect(list.body.find((m) => m.id === id).status).toBe('doing');
  });
});
