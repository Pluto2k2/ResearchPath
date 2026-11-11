import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers.js';

describe('Static frontend', () => {
  it('serves the index page at /', async () => {
    const res = await request(createTestApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<title>ResearchPath</title>');
    expect(res.text).toContain('<header');
  });

  it('serves /styles.css as CSS', async () => {
    const res = await request(createTestApp()).get('/styles.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
  });

  it('serves /app.js as JavaScript', async () => {
    const res = await request(createTestApp()).get('/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });
});
