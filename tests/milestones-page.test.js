import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp, TODAY } from './helpers.js';
import { localToday, daysLabel } from '../public/dates.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

describe('AC5 - days label computed from the browser date', () => {
  it.each([
    ['2026-11-12', 'today'],
    ['2026-11-13', '1 day left'],
    ['2026-12-12', '30 days left'],
    ['2026-11-11', '1 day overdue'],
    ['2026-11-02', '10 days overdue'],
    ['2026-10-25', '18 days overdue'],
  ])('%s -> %s', (target, label) => {
    expect(daysLabel(target, TODAY)).toBe(label);
  });

  it('works across a month and year boundary', () => {
    expect(daysLabel('2027-01-01', '2026-12-31')).toBe('1 day left');
    expect(daysLabel('2026-12-31', '2027-01-01')).toBe('1 day overdue');
  });

  it('works across a leap day', () => {
    expect(daysLabel('2028-03-01', '2028-02-28')).toBe('2 days left');
  });

  it('localToday uses the local calendar day, even late in the evening', () => {
    expect(localToday(new Date(2026, 10, 12, 23, 30))).toBe('2026-11-12');
    expect(localToday(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05');
  });
});

describe('AC6 - the page has a form to add milestones', () => {
  it('serves the form fields, error area and roadmap container', async () => {
    const res = await request(createTestApp()).get('/');
    expect(res.status).toBe(200);
    for (const id of [
      'milestone-form',
      'milestone-title',
      'milestone-date',
      'milestone-notes',
      'milestone-error',
      'roadmap',
    ]) {
      expect(res.text).toContain(`id="${id}"`);
    }
  });
});

describe('AC7 - HTML is displayed as text, not interpreted (client side)', () => {
  it('no public script uses innerHTML', () => {
    const files = fs.readdirSync(publicDir).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(fs.readFileSync(path.join(publicDir, f), 'utf8'), f).not.toContain('innerHTML');
    }
  });
});
