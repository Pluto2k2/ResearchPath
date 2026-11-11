import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestApp } from './helpers.js';
import { errorHandler } from '../src/app.js';

afterEach(() => vi.restoreAllMocks());

describe('API error handling', () => {
  it('returns 404 for an unknown GET /api route', async () => {
    const res = await request(createTestApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('returns 404 for an unknown POST /api route', async () => {
    const res = await request(createTestApp()).post('/api/nope').send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('returns 400 Invalid JSON for a malformed body', async () => {
    const res = await request(createTestApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });

  it('returns 400 Invalid JSON on an unknown api path too', async () => {
    const res = await request(createTestApp())
      .post('/api/nope')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });

  it('returns 500 with a generic message and no stack or details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.get('/boom', () => {
      throw new Error('secret SQL detail');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(res.text).not.toContain('secret SQL detail');
    expect(res.text).not.toMatch(/\bat \S/);
  });
});
