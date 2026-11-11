import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { validateNewsQuery } from '../src/validation/news.js';
import { createNewsTestApp } from './helpers.js';

const MISSING = 'Pick at least one category or keyword';
const UNKNOWN = 'Unknown category. Allowed: cs.AI, cs.LG, cs.SE, cs.CL, cs.CV';
const TOO_LONG = 'Keyword must be at most 100 characters';
const ONCE = 'categories and q must each be given once';

describe('US-04 news query validation', () => {
  it('accepts categories only', () => {
    expect(validateNewsQuery({ categories: 'cs.AI,cs.LG' })).toEqual({
      value: { categories: ['cs.AI', 'cs.LG'], terms: [] },
    });
  });

  it('accepts q only', () => {
    expect(validateNewsQuery({ q: 'Diffusion' })).toEqual({
      value: { categories: [], terms: ['diffusion'] },
    });
  });

  it('accepts both', () => {
    expect(validateNewsQuery({ categories: 'cs.CV', q: 'graphs' })).toEqual({
      value: { categories: ['cs.CV'], terms: ['graphs'] },
    });
  });

  it('dedupes and sorts categories and lowercased terms', () => {
    expect(validateNewsQuery({ categories: 'cs.LG,cs.AI,cs.LG', q: 'Zeta, alpha ,ZETA' })).toEqual({
      value: { categories: ['cs.AI', 'cs.LG'], terms: ['alpha', 'zeta'] },
    });
  });

  it('trims spaces around commas and drops empty items', () => {
    expect(validateNewsQuery({ categories: ' cs.AI , ,cs.SE,', q: ' a ,, b ' })).toEqual({
      value: { categories: ['cs.AI', 'cs.SE'], terms: ['a', 'b'] },
    });
  });

  it('rejects an unknown category', () => {
    expect(validateNewsQuery({ categories: 'cs.XX' })).toEqual({ error: UNKNOWN });
  });

  it('rejects a lower-case category (match is case-sensitive)', () => {
    expect(validateNewsQuery({ categories: 'cs.ai' })).toEqual({ error: UNKNOWN });
  });

  it('rejects when one category in a list is unknown', () => {
    expect(validateNewsQuery({ categories: 'cs.AI,math.CO', q: 'x' })).toEqual({ error: UNKNOWN });
  });

  it('rejects a query with neither parameter', () => {
    expect(validateNewsQuery({})).toEqual({ error: MISSING });
  });

  it('rejects blank q without categories', () => {
    expect(validateNewsQuery({ q: '   ' })).toEqual({ error: MISSING });
  });

  it('counts q=", ," as missing', () => {
    expect(validateNewsQuery({ q: ', ,' })).toEqual({ error: MISSING });
  });

  it('counts a q made only of double quotes as missing', () => {
    expect(validateNewsQuery({ q: '""' })).toEqual({ error: MISSING });
  });

  it('accepts a q of exactly 100 characters', () => {
    const q = 'a'.repeat(100);
    expect(validateNewsQuery({ q })).toEqual({ value: { categories: [], terms: [q] } });
  });

  it('rejects a q of 101 characters', () => {
    expect(validateNewsQuery({ q: 'a'.repeat(101) })).toEqual({ error: TOO_LONG });
  });

  it('measures the 100 characters after trimming', () => {
    expect(validateNewsQuery({ q: `  ${'a'.repeat(100)}  ` }).value.terms).toHaveLength(1);
  });

  it('rejects repeated parameters (arrays)', () => {
    expect(validateNewsQuery({ categories: ['cs.AI', 'cs.LG'] })).toEqual({ error: ONCE });
    expect(validateNewsQuery({ q: ['a', 'b'] })).toEqual({ error: ONCE });
  });
});

describe('US-04 news endpoints answer 400 for invalid input', () => {
  for (const path of ['/api/news/papers', '/api/news/topics']) {
    it(`${path}: missing params -> 400 with the exact message and no upstream call`, async () => {
      const fetch = vi.fn();
      const res = await request(createNewsTestApp({ fetch })).get(path);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: MISSING });
      expect(fetch).not.toHaveBeenCalled();
    });

    it(`${path}: unknown category -> 400`, async () => {
      const res = await request(createNewsTestApp({ fetch: vi.fn() })).get(path).query({ categories: 'cs.ai' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: UNKNOWN });
    });

    it(`${path}: q of 101 characters -> 400`, async () => {
      const res = await request(createNewsTestApp({ fetch: vi.fn() })).get(path).query({ q: 'a'.repeat(101) });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: TOO_LONG });
    });

    it(`${path}: q of only double quotes -> 400`, async () => {
      const res = await request(createNewsTestApp({ fetch: vi.fn() })).get(path).query({ q: '""' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: MISSING });
    });

    it(`${path}: repeated parameter -> 400`, async () => {
      const res = await request(createNewsTestApp({ fetch: vi.fn() })).get(`${path}?categories=cs.AI&categories=cs.LG`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: ONCE });
    });

    it(`${path}: HTML or SQL in q is only ever sent encoded as a parameter`, async () => {
      const fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }));
      const res = await request(createNewsTestApp({ fetch }))
        .get(path)
        .query({ q: "<script>'; DROP TABLE milestones;--" });
      expect(res.status).toBe(502);
      const sent = String(fetch.mock.calls[0][0]);
      expect(sent).not.toContain('<script>');
      expect(sent).not.toContain(' ');
    });
  }
});
