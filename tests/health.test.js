import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { createTestApp, createNewsTestApp, TODAY } from './helpers.js';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

describe('Test helpers', () => {
  it('freezes today to 2026-11-12', () => {
    expect(TODAY).toBe('2026-11-12');
  });
});

describe('Health check (GET /api/health)', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(createTestApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version, commit: null });
  });

  it('reports the package.json version', async () => {
    const res = await request(createTestApp()).get('/api/health');
    expect(res.body.version).toBe(version);
  });

  it('reports the commit given to createApp', async () => {
    const res = await request(createNewsTestApp({ commit: 'abc' })).get('/api/health');
    expect(res.body).toEqual({ status: 'ok', version, commit: 'abc' });
  });

  it('answers with a JSON content type', async () => {
    const res = await request(createTestApp()).get('/api/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
