import { describe, it, expect } from 'vitest';
import { TODAY } from './helpers.js';
import { relativeLabel, isOverdue, formatShortDate } from '../public/dates.js';
import {
  PAD, MIN_GAP, MAX_GAP, MID, AMP,
  computeGap, nodeX, trackWidth, waveY, wavePath, labelSide,
  todayIndex, todayX, initialScrollLeft,
} from '../public/roadmap-layout.js';

describe('AC5 - wavy path with alternating labels', () => {
  it('has sane layout constants', () => {
    for (const c of [PAD, MIN_GAP, MAX_GAP, MID, AMP]) expect(typeof c).toBe('number');
    expect(MIN_GAP).toBeLessThan(MAX_GAP);
    expect(AMP).toBeGreaterThan(0);
  });

  it('alternates labels above and below', () => {
    expect([0, 1, 2, 3, 4].map(labelSide)).toEqual(['above', 'below', 'above', 'below', 'above']);
  });

  it.each([MIN_GAP, 150, MAX_GAP])('waveY alternates crest and trough on nodes (gap %i)', (gap) => {
    for (let i = 0; i < 8; i++) {
      const expected = i % 2 === 0 ? MID - AMP : MID + AMP;
      expect(waveY(nodeX(i, gap), gap)).toBeCloseTo(expected, 5);
    }
  });

  it('nodeX is strictly increasing with a step equal to the gap', () => {
    const gap = 130;
    for (let i = 0; i < 10; i++) {
      expect(nodeX(i + 1, gap)).toBeGreaterThan(nodeX(i, gap));
      expect(nodeX(i + 1, gap) - nodeX(i, gap)).toBeCloseTo(gap, 9);
    }
    expect(nodeX(0, gap)).toBe(PAD + gap / 2);
  });

  it('wavePath is a string starting with "M 0 "', () => {
    const d = wavePath(600, 120);
    expect(typeof d).toBe('string');
    expect(d.startsWith('M 0 ')).toBe(true);
    expect(d).toContain(' L ');
  });

  it.each([
    ['2026-11-12', 'today'],
    ['2026-11-13', 'in 1 day'],
    ['2026-12-12', 'in 30 days'],
    ['2026-11-11', '1 day overdue'],
    ['2026-11-02', '10 days overdue'],
  ])('relativeLabel %s -> %s', (target, label) => {
    expect(relativeLabel(target, TODAY)).toBe(label);
  });

  it('relativeLabel works across month end, year end and the 2028 leap day', () => {
    expect(relativeLabel('2026-12-01', '2026-11-30')).toBe('in 1 day');
    expect(relativeLabel('2027-01-01', '2026-12-31')).toBe('in 1 day');
    expect(relativeLabel('2026-12-31', '2027-01-01')).toBe('1 day overdue');
    expect(relativeLabel('2028-03-01', '2028-02-28')).toBe('in 2 days');
    expect(relativeLabel('2028-02-28', '2028-03-01')).toBe('2 days overdue');
  });

  it.each([
    ['2026-11-12', '12 Nov'],
    ['2026-01-05', '5 Jan'],
    ['2026-12-31', '31 Dec'],
    ['2027-02-09', '9 Feb'],
    ['2026-07-10', '10 Jul'],
  ])('formatShortDate %s -> %s (no leading zero)', (ymd, out) => {
    expect(formatShortDate(ymd)).toBe(out);
  });
});

describe('AC8 - TODAY marker and overdue state', () => {
  const ms = (...dates) => dates.map((targetDate) => ({ targetDate }));

  it('returns 0 for an empty roadmap', () => {
    expect(todayIndex([], TODAY)).toBe(0);
  });

  it('returns the length when every milestone is past', () => {
    expect(todayIndex(ms('2026-01-01', '2026-11-11'), TODAY)).toBe(2);
  });

  it('returns 0 when every milestone is in the future', () => {
    expect(todayIndex(ms('2026-11-13', '2027-01-01'), TODAY)).toBe(0);
  });

  it('returns the first future milestone in a mixed list', () => {
    expect(todayIndex(ms('2026-01-01', '2026-11-01', '2026-12-01', '2027-01-01'), TODAY)).toBe(2);
  });

  it('counts a milestone dated today as upcoming', () => {
    expect(todayIndex(ms('2026-11-01', TODAY, '2026-12-01'), TODAY)).toBe(1);
  });

  it('isOverdue: yesterday true, today false, tomorrow false', () => {
    expect(isOverdue('2026-11-11', TODAY)).toBe(true);
    expect(isOverdue(TODAY, TODAY)).toBe(false);
    expect(isOverdue('2026-11-13', TODAY)).toBe(false);
  });

  it('todayX sits between the previous node and the node at the index', () => {
    const gap = 140;
    for (const index of [1, 2, 5]) {
      const x = todayX(index, gap);
      expect(x).toBeGreaterThan(nodeX(index - 1, gap));
      expect(x).toBeLessThan(nodeX(index, gap));
    }
  });
});

describe('AC9 - spacing and initial scroll', () => {
  it.each([0, 1, 50])('computeGap stays within bounds for count %i', (count) => {
    for (const w of [0, 320, 2000]) {
      const gap = computeGap(w, count);
      expect(gap).toBeGreaterThanOrEqual(MIN_GAP);
      expect(gap).toBeLessThanOrEqual(MAX_GAP);
    }
  });

  it('computeGap uses the free width when it is within bounds', () => {
    const gap = computeGap(2 * PAD + 3 * 150, 2);
    expect(gap).toBeCloseTo(150, 9);
  });

  it.each([0, 1, 5, 30])('trackWidth covers the view, all nodes and the "+" slot (count %i)', (count) => {
    for (const visible of [320, 360, 1200]) {
      const gap = computeGap(visible, count);
      const width = trackWidth(visible, count, gap);
      expect(width).toBeGreaterThanOrEqual(visible);
      expect(nodeX(count, gap)).toBeLessThan(width);
    }
  });

  it('initialScrollLeft is 0 when the track fits', () => {
    expect(initialScrollLeft(500, 800, 800)).toBe(0);
    expect(initialScrollLeft(500, 1000, 800)).toBe(0);
  });

  it('scrolls so today is visible with 30 milestones in a 360px view', () => {
    const visible = 360;
    const count = 30;
    const gap = computeGap(visible, count);
    const width = trackWidth(visible, count, gap);
    for (const index of [0, 1, 15, 29, 30]) {
      const x = todayX(index, gap);
      const left = initialScrollLeft(x, visible, width);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(width - visible);
      expect(x).toBeGreaterThanOrEqual(left);
      expect(x).toBeLessThanOrEqual(left + visible);
    }
  });
});
