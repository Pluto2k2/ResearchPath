import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db/index.js';
import { TODAY } from './helpers.js';

const valid = { title: 'ICML 2027', type: 'conference', date: '2027-07-10' };

function makeApp() {
  const db = openDatabase(':memory:');
  const app = createApp({ db, now: () => new Date(`${TODAY}T12:00:00Z`) });
  return { app, db };
}

describe('US-03 events table', () => {
  it('is created at startup with the 7 expected columns', () => {
    const { db } = makeApp();
    const columns = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
    expect(columns).toEqual(['id', 'title', 'type', 'date', 'url', 'notes', 'created_at']);
  });

  it('lets a fresh database accept a POST then a GET', async () => {
    const { app } = makeApp();
    const created = await request(app).post('/api/events').send(valid);
    expect(created.status).toBe(201);
    const list = await request(app).get('/api/events');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });
});

describe('US-03 POST /api/events', () => {
  let app;
  let db;
  const post = (body) => request(app).post('/api/events').send(body);
  const count = () => db.prepare('SELECT COUNT(*) AS n FROM events').get().n;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  describe('valid input', () => {
    it('returns 201 with the full camelCase event', async () => {
      const res = await post({
        title: 'ICML 2027',
        type: 'conference',
        date: '2027-07-10',
        url: 'https://icml.cc',
        notes: 'Vienna',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'ICML 2027',
        type: 'conference',
        date: '2027-07-10',
        url: 'https://icml.cc',
        notes: 'Vienna',
      });
      expect(Number.isInteger(res.body.id)).toBe(true);
      expect(typeof res.body.createdAt).toBe('string');
      expect(Object.keys(res.body).sort()).toEqual(
        ['createdAt', 'date', 'id', 'notes', 'title', 'type', 'url'],
      );
    });

    it.each(['conference', 'seminar', 'deadline', 'funding'])('accepts type "%s"', async (type) => {
      const res = await post({ ...valid, type });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe(type);
    });

    it('sets url and notes to null when missing', async () => {
      const res = await post(valid);
      expect(res.status).toBe(201);
      expect(res.body.url).toBeNull();
      expect(res.body.notes).toBeNull();
    });

    it('sets url and notes to null when blank after trimming', async () => {
      const res = await post({ ...valid, url: '   ', notes: '  \n ' });
      expect(res.status).toBe(201);
      expect(res.body.url).toBeNull();
      expect(res.body.notes).toBeNull();
    });

    it('trims title, url and notes', async () => {
      const res = await post({ ...valid, title: '  ICML  ', url: '  https://icml.cc  ', notes: '  hi  ' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('ICML');
      expect(res.body.url).toBe('https://icml.cc');
      expect(res.body.notes).toBe('hi');
    });

    it('accepts a title of exactly 120 characters', async () => {
      expect((await post({ ...valid, title: 'a'.repeat(120) })).status).toBe(201);
    });

    it('accepts a url of exactly 500 characters', async () => {
      const url = `https://x.org/${'a'.repeat(500 - 14)}`;
      expect(url).toHaveLength(500);
      expect((await post({ ...valid, url })).status).toBe(201);
    });

    it('accepts notes of exactly 2000 characters', async () => {
      expect((await post({ ...valid, notes: 'n'.repeat(2000) })).status).toBe(201);
    });

    it('accepts an http:// url', async () => {
      const res = await post({ ...valid, url: 'http://x.org' });
      expect(res.status).toBe(201);
      expect(res.body.url).toBe('http://x.org');
    });

    it('accepts a leap day', async () => {
      expect((await post({ ...valid, date: '2028-02-29' })).status).toBe(201);
    });

    it('stores HTML and SQL-looking text as plain data', async () => {
      const title = `<script>alert(1)</script>'; DROP TABLE events;--`;
      const res = await post({ ...valid, title });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe(title);
      expect((await request(app).get('/api/events')).body).toHaveLength(1);
    });
  });

  describe('invalid input', () => {
    const cases = [
      ['missing title', { type: 'seminar', date: '2027-01-01' }, 'Title is required'],
      ['blank title', { ...valid, title: '   ' }, 'Title is required'],
      ['non-string title', { ...valid, title: 42 }, 'Title must be a string'],
      ['title of 121 characters', { ...valid, title: 'a'.repeat(121) }, 'Title must be at most 120 characters'],
      ['missing type', { title: 'x', date: '2027-01-01' }, 'Type is required'],
      ['unknown type', { ...valid, type: 'workshop' }, 'Type must be one of: conference, seminar, deadline, funding'],
      ['wrong-case type', { ...valid, type: 'Conference' }, 'Type must be one of: conference, seminar, deadline, funding'],
      ['non-string type', { ...valid, type: 5 }, 'Type must be one of: conference, seminar, deadline, funding'],
      ['numeric date', { ...valid, date: 20261112 }, 'Date must use the YYYY-MM-DD format'],
      ['missing date', { title: 'x', type: 'seminar' }, 'Date is required'],
      ['wrong date format', { ...valid, date: '12/11/2026' }, 'Date must use the YYYY-MM-DD format'],
      ['2026-02-30', { ...valid, date: '2026-02-30' }, 'Date must be a real calendar date'],
      ['2027-02-29', { ...valid, date: '2027-02-29' }, 'Date must be a real calendar date'],
      ['2026-13-01', { ...valid, date: '2026-13-01' }, 'Date must be a real calendar date'],
      ['javascript: url', { ...valid, url: 'javascript:alert(1)' }, 'URL must start with http:// or https://'],
      ['ftp url', { ...valid, url: 'ftp://x' }, 'URL must start with http:// or https://'],
      ['url without scheme', { ...valid, url: 'www.x.org' }, 'URL must start with http:// or https://'],
      ['uppercase scheme', { ...valid, url: 'HTTPS://x.org' }, 'URL must start with http:// or https://'],
      ['url of 501 characters', { ...valid, url: `https://x.org/${'a'.repeat(501 - 14)}` }, 'URL must be at most 500 characters'],
      ['non-string url', { ...valid, url: 5 }, 'URL must be a string'],
      ['notes of 2001 characters', { ...valid, notes: 'n'.repeat(2001) }, 'Notes must be at most 2000 characters'],
      ['non-string notes', { ...valid, notes: {} }, 'Notes must be a string'],
    ];

    it.each(cases)('returns 400 for %s', async (_name, body, message) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: message });
    });

    it('returns 400 when the body is an array', async () => {
      const res = await post([valid]);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Request body must be a JSON object' });
    });

    it('returns 400 Invalid JSON when the body is null', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Content-Type', 'application/json')
        .send('null');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid JSON' });
    });

    it('returns 400 "Invalid JSON" for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Content-Type', 'application/json')
        .send('{"title": "x",');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid JSON' });
    });

    it('reports the first failing field in order (title before type)', async () => {
      const res = await post({ title: '', type: 'nope', date: 'bad' });
      expect(res.body.error).toBe('Title is required');
    });

    it('creates nothing when the request is rejected', async () => {
      await post({ ...valid, type: 'workshop' });
      await post({ ...valid, date: '2026-02-30' });
      await post({ ...valid, url: 'javascript:alert(1)' });
      expect(count()).toBe(0);
      expect((await request(app).get('/api/events')).body).toEqual([]);
    });
  });
});

describe('US-03 GET /api/events', () => {
  let app;
  const post = (body) => request(app).post('/api/events').send(body);

  beforeEach(() => {
    ({ app } = makeApp());
  });

  it('returns 200 and an empty array when there are no events', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns events with the earliest date first', async () => {
    await post({ title: 'C', type: 'seminar', date: '2027-03-01' });
    await post({ title: 'A', type: 'deadline', date: '2026-12-01' });
    await post({ title: 'B', type: 'funding', date: '2027-01-15' });
    const res = await request(app).get('/api/events');
    expect(res.body.map((e) => e.title)).toEqual(['A', 'B', 'C']);
  });

  it('keeps creation order for events on the same date', async () => {
    await post({ title: 'first', type: 'seminar', date: '2027-01-01' });
    await post({ title: 'second', type: 'seminar', date: '2027-01-01' });
    await post({ title: 'third', type: 'seminar', date: '2027-01-01' });
    const res = await request(app).get('/api/events');
    expect(res.body.map((e) => e.title)).toEqual(['first', 'second', 'third']);
  });
});
