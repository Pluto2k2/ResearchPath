import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/index.js';
import { createTestApp, TODAY } from './helpers.js';

const post = (app, body) => request(app).post('/api/milestones').send(body);
const valid = { title: 'Literature review', targetDate: '2027-01-15' };

const dbs = [];
const dirs = [];
afterEach(() => {
  for (const db of dbs.splice(0)) {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('AC1 - milestones table is created at startup', () => {
  it('creates the milestones table with the six columns', () => {
    const db = openDatabase(':memory:');
    dbs.push(db);
    const names = db
      .prepare('PRAGMA table_info(milestones)')
      .all()
      .map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['id', 'title', 'target_date', 'notes', 'status', 'created_at']),
    );
    expect(names).toHaveLength(6);
  });

  it('can open the same file twice without error and keeps the rows', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-ms-'));
    dirs.push(dir);
    const file = path.join(dir, 'ms.db');
    const first = openDatabase(file);
    dbs.push(first);
    first
      .prepare(
        "INSERT INTO milestones (title, target_date, status, created_at) VALUES ('A', '2027-01-01', 'todo', '2026-11-12T12:00:00.000Z')",
      )
      .run();
    first.close();
    let second;
    expect(() => {
      second = openDatabase(file);
    }).not.toThrow();
    dbs.push(second);
    expect(second.prepare('SELECT COUNT(*) AS n FROM milestones').get().n).toBe(1);
  });
});

describe('AC2 - POST /api/milestones creates a milestone', () => {
  it('returns 201 with the exact shape', async () => {
    const res = await post(createTestApp(), { ...valid, notes: 'Read 30 papers' });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('number');
    expect(res.body).toEqual({
      id: res.body.id,
      title: 'Literature review',
      targetDate: '2027-01-15',
      notes: 'Read 30 papers',
      status: 'todo',
      createdAt: new Date(`${TODAY}T12:00:00Z`).toISOString(),
    });
  });

  it('trims title and notes', async () => {
    const res = await post(createTestApp(), {
      title: '  Write chapter 1  ',
      targetDate: '2027-01-15',
      notes: '  some notes \n',
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write chapter 1');
    expect(res.body.notes).toBe('some notes');
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty', ''],
    ['blank', '   '],
  ])('stores %s notes as null', async (_label, notes) => {
    const body = { ...valid };
    if (notes !== undefined) body.notes = notes;
    const res = await post(createTestApp(), body);
    expect(res.status).toBe(201);
    expect(res.body.notes).toBeNull();
  });

  it('accepts a 120-character title and 2000-character notes', async () => {
    const res = await post(createTestApp(), {
      ...valid,
      title: 'a'.repeat(120),
      notes: 'n'.repeat(2000),
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toHaveLength(120);
    expect(res.body.notes).toHaveLength(2000);
  });

  it('accepts a leap day and a past date', async () => {
    const app = createTestApp();
    expect((await post(app, { ...valid, targetDate: '2028-02-29' })).status).toBe(201);
    expect((await post(app, { ...valid, targetDate: '2020-01-01' })).status).toBe(201);
  });

  it('ignores unknown fields such as status', async () => {
    const res = await post(createTestApp(), { ...valid, status: 'done' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('todo');
  });

  it('makes the created milestone appear in the list', async () => {
    const app = createTestApp();
    const created = await post(app, valid);
    const list = await request(app).get('/api/milestones');
    expect(list.body).toEqual([created.body]);
  });
});

describe('AC3 - invalid input returns 400 with a clear message', () => {
  const cases = [
    ['missing title', { targetDate: '2027-01-15' }, 'Title is required'],
    ['null title', { title: null, targetDate: '2027-01-15' }, 'Title is required'],
    ['blank title', { title: '   ', targetDate: '2027-01-15' }, 'Title is required'],
    ['non-string title', { title: 42, targetDate: '2027-01-15' }, 'Title must be a string'],
    [
      'too long title',
      { title: 'a'.repeat(121), targetDate: '2027-01-15' },
      'Title must be at most 120 characters',
    ],
    ['missing date', { title: 'T' }, 'Target date is required'],
    ['null date', { title: 'T', targetDate: null }, 'Target date is required'],
    ['blank date', { title: 'T', targetDate: '  ' }, 'Target date is required'],
    [
      'slash date',
      { title: 'T', targetDate: '12/01/2026' },
      'Target date must use the YYYY-MM-DD format',
    ],
    [
      'unpadded date',
      { title: 'T', targetDate: '2026-1-5' },
      'Target date must use the YYYY-MM-DD format',
    ],
    [
      'numeric date',
      { title: 'T', targetDate: 20261201 },
      'Target date must use the YYYY-MM-DD format',
    ],
    [
      'Feb 30',
      { title: 'T', targetDate: '2026-02-30' },
      'Target date must be a real calendar date',
    ],
    [
      'Feb 29 in a non-leap year',
      { title: 'T', targetDate: '2026-02-29' },
      'Target date must be a real calendar date',
    ],
    [
      'month 13',
      { title: 'T', targetDate: '2026-13-01' },
      'Target date must be a real calendar date',
    ],
    [
      'non-string notes',
      { ...valid, notes: 123 },
      'Notes must be a string',
    ],
    [
      'too long notes',
      { ...valid, notes: 'n'.repeat(2001) },
      'Notes must be at most 2000 characters',
    ],
    ['array body', [valid], 'Request body must be a JSON object'],
  ];

  it.each(cases)('rejects %s', async (_label, body, message) => {
    const app = createTestApp();
    const res = await post(app, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: message });
  });

  it('rejects a request with no JSON body', async () => {
    const res = await request(createTestApp()).post('/api/milestones');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Request body must be a JSON object' });
  });

  it('rejects malformed JSON with "Invalid JSON"', async () => {
    const res = await request(createTestApp())
      .post('/api/milestones')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });

  it('stores nothing after rejections', async () => {
    const app = createTestApp();
    await post(app, { title: '', targetDate: '2027-01-15' });
    await post(app, { title: 'T', targetDate: '2026-02-30' });
    const list = await request(app).get('/api/milestones');
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
  });
});

describe('AC4 - GET /api/milestones lists earliest first', () => {
  it('returns 200 and an empty array when there is no data', async () => {
    const res = await request(createTestApp()).get('/api/milestones');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('sorts by target date ascending', async () => {
    const app = createTestApp();
    await post(app, { title: 'late', targetDate: '2027-06-01' });
    await post(app, { title: 'early', targetDate: '2026-12-01' });
    await post(app, { title: 'middle', targetDate: '2027-02-01' });
    const res = await request(app).get('/api/milestones');
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.title)).toEqual(['early', 'middle', 'late']);
  });

  it('keeps insertion order for the same date', async () => {
    const app = createTestApp();
    await post(app, { title: 'first', targetDate: '2027-01-01' });
    await post(app, { title: 'second', targetDate: '2027-01-01' });
    const res = await request(app).get('/api/milestones');
    expect(res.body.map((m) => m.title)).toEqual(['first', 'second']);
  });
});

describe('AC7 - HTML in input is stored as plain text (server side)', () => {
  it('returns title and notes unchanged', async () => {
    const app = createTestApp();
    const res = await post(app, {
      title: '<b>test</b>',
      targetDate: '2027-01-15',
      notes: '<script>x</script>',
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('<b>test</b>');
    expect(res.body.notes).toBe('<script>x</script>');
    const list = await request(app).get('/api/milestones');
    expect(list.body[0].title).toBe('<b>test</b>');
    expect(list.body[0].notes).toBe('<script>x</script>');
  });

  it('treats SQL in input as plain text', async () => {
    const app = createTestApp();
    const title = "x'); DROP TABLE milestones; --";
    const res = await post(app, { title, targetDate: '2027-01-15' });
    expect(res.status).toBe(201);
    const list = await request(app).get('/api/milestones');
    expect(list.body[0].title).toBe(title);
  });
});
