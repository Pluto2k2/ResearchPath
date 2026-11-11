import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers.js';
import { errorHandler } from '../src/app.js';

afterEach(() => vi.restoreAllMocks());

function fakeRes() {
  const res = { headersSent: false };
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('M10 body-parser errors keep their status', () => {
  it('returns 413 when the JSON body is over 100 kB', async () => {
    const body = JSON.stringify({ title: 'x'.repeat(102_400) });
    const res = await request(createTestApp())
      .post('/api/milestones')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Request body is too large' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns 415 for an unsupported charset', async () => {
    const res = await request(createTestApp())
      .post('/api/milestones')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{}');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Unsupported charset' });
  });

  it('returns 415 for an unsupported content encoding', async () => {
    const res = await request(createTestApp())
      .post('/api/milestones')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'bogus')
      .send('{}');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Unsupported content encoding' });
  });

  it('still returns 400 Invalid JSON for malformed JSON', async () => {
    const res = await request(createTestApp())
      .post('/api/milestones')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON' });
  });

  it('returns 400 with the fixed message for a corrupt gzip body, without zlib details', async () => {
    const res = await request(createTestApp())
      .post('/api/milestones')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('not really gzip');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
    expect(res.text).not.toContain('header check');
  });
});

describe('M10 errorHandler unit', () => {
  it('maps request.aborted to 400 "Request aborted"', () => {
    const res = fakeRes();
    errorHandler({ type: 'request.aborted' }, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Request aborted' });
  });

  it('maps request.size.invalid to 400', () => {
    const res = fakeRes();
    errorHandler({ type: 'request.size.invalid' }, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Request size did not match content length' });
  });

  it('keeps another 4xx status with a fixed message, never err.message', () => {
    const res = fakeRes();
    const err = Object.assign(new Error('client controlled <script>'), { status: 418 });
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid request' });
  });

  it('answers a plain Error with a generic 500 and no stack', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeRes();
    errorHandler(new Error('secret SQL detail'), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret SQL detail');
  });

  it('treats a 5xx status as a generic 500', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeRes();
    errorHandler(Object.assign(new Error('boom'), { status: 503 }), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('calls next(err) and sends nothing when headers are already sent', () => {
    const res = fakeRes();
    res.headersSent = true;
    const next = vi.fn();
    const err = new Error('late');
    errorHandler(err, {}, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
