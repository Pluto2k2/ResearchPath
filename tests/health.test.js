import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp, TODAY } from './helpers.js';

describe('Test helpers', () => {
  it('freezes today to 2026-11-12', () => {
    expect(TODAY).toBe('2026-11-12');
  });
});

describe('Health check (GET /api/health)', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(createTestApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers with a JSON content type', async () => {
    const res = await request(createTestApp()).get('/api/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
