import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TIPS, ramyMessage, ramyMessages, shortTitle } from '../public/ramy.js';

const TODAY = '2026-11-12';

const ms = (id, title, targetDate, status = 'todo') => ({ id, title, targetDate, notes: '', status });
const up = (kind, id, title, date, extra = {}) => ({ kind, id, title, date, ...extra });

const EXPECTED_TIPS = [
  'Click a milestone on the path to change its status.',
  'Add conferences, seminars and funding calls with + Event.',
  'Everything due soon is listed under Next 30 days.',
  'Pick arXiv categories in Research news to see new papers.',
  'Split a big milestone into smaller ones to keep moving.',
  'Overdue milestones get a coral halo on the path.',
];

describe('M11 Ramy brain: overdue milestone (priority 1)', () => {
  it('says how many days overdue and uses the thinking pose', () => {
    const r = ramyMessage({ milestones: [ms(1, 'Ethics approval', '2026-11-09')], today: TODAY });
    expect(r).toEqual({ pose: 'thinking', text: 'Ethics approval was due 3 days ago, want to update it?' });
  });

  it('uses the singular for 1 day', () => {
    const r = ramyMessage({ milestones: [ms(1, 'Ethics', '2026-11-11')], today: TODAY });
    expect(r.text).toBe('Ethics was due 1 day ago, want to update it?');
  });

  it('picks the oldest of several overdue milestones', () => {
    const r = ramyMessage({
      milestones: [ms(1, 'Newer', '2026-11-10'), ms(2, 'Oldest', '2026-10-01'), ms(3, 'Middle', '2026-11-01')],
      today: TODAY,
    });
    expect(r.text).toContain('Oldest was due 42 days ago');
  });

  it('breaks a date tie with the lower id', () => {
    const r = ramyMessage({
      milestones: [ms(7, 'Seven', '2026-11-05'), ms(3, 'Three', '2026-11-05')],
      today: TODAY,
    });
    expect(r.text.startsWith('Three was due')).toBe(true);
  });

  it('never treats a done past milestone as overdue', () => {
    const r = ramyMessage({ milestones: [ms(1, 'Finished', '2026-10-01', 'done')], today: TODAY });
    expect(r.pose).toBe('idle');
    expect(r.text).toBe(TIPS[0]);
  });

  it('ignores a done milestone and reports the older not-done one', () => {
    const r = ramyMessage({
      milestones: [ms(1, 'Finished', '2026-09-01', 'done'), ms(2, 'Pending', '2026-11-10', 'doing')],
      today: TODAY,
    });
    expect(r.text.startsWith('Pending was due 2 days ago')).toBe(true);
  });

  it('is not overdue on its own date (today)', () => {
    const r = ramyMessage({ milestones: [ms(1, 'Today thing', TODAY)], today: TODAY });
    expect(r.pose).not.toBe('thinking');
  });
});

describe('M11 Ramy brain: due within 7 days (priority 2)', () => {
  const soon = (date, extra) => ramyMessage({ upcoming: [up('milestone', 1, 'Draft', date, extra)], today: TODAY });

  it('is today', () => expect(soon('2026-11-12')).toEqual({ pose: 'wave', text: 'Draft is today!' }));
  it('is tomorrow', () => expect(soon('2026-11-13').text).toBe('Draft is tomorrow!'));
  it('is in 2 days', () => expect(soon('2026-11-14').text).toBe('Draft is in 2 days!'));
  it('still matches at exactly 7 days', () => {
    const r = soon('2026-11-19');
    expect(r).toEqual({ pose: 'wave', text: 'Draft is in 7 days!' });
  });

  it('does not match at 8 days', () => {
    expect(soon('2026-11-20')).toEqual({ pose: 'idle', text: TIPS[0] });
  });

  it('works for events too', () => {
    const r = ramyMessage({ upcoming: [up('event', 4, 'ICML', '2026-11-15', { type: 'conference' })], today: TODAY });
    expect(r.text).toBe('ICML is in 3 days!');
  });

  it('picks the nearest item', () => {
    const r = ramyMessage({
      upcoming: [up('event', 1, 'Far', '2026-11-18'), up('event', 2, 'Near', '2026-11-13')],
      today: TODAY,
    });
    expect(r.text).toBe('Near is tomorrow!');
  });

  it('prefers a milestone over an event on the same day', () => {
    const r = ramyMessage({
      upcoming: [up('event', 1, 'Seminar', '2026-11-14'), up('milestone', 9, 'Chapter', '2026-11-14')],
      today: TODAY,
    });
    expect(r.text).toBe('Chapter is in 2 days!');
  });

  it('breaks a tie between two items of the same kind and date with the lower id', () => {
    const r = ramyMessage({
      upcoming: [up('event', 9, 'Nine', '2026-11-14'), up('event', 2, 'Two', '2026-11-14')],
      today: TODAY,
    });
    expect(r.text).toBe('Two is in 2 days!');
  });

  it('skips a done milestone in the upcoming list', () => {
    const r = ramyMessage({
      upcoming: [up('milestone', 1, 'Done one', '2026-11-13', { status: 'done' }), up('event', 2, 'Talk', '2026-11-16')],
      today: TODAY,
    });
    expect(r.text).toBe('Talk is in 4 days!');
  });

  it('ignores upcoming items with an invalid date', () => {
    const r = ramyMessage({ upcoming: [up('event', 1, 'Bad', 'soon'), up('event', 2, 'Bad2', '2026-02-30')], today: TODAY });
    expect(r).toEqual({ pose: 'idle', text: TIPS[0] });
  });
});

describe('M11 Ramy brain: progress step (priority 3)', () => {
  const pct = (percent) => ramyMessage({ milestones: [ms(1, 'A', '2027-01-01')], progress: { percent }, today: TODAY });

  it('has no message at 0 and 24 percent', () => {
    expect(pct(0).pose).toBe('idle');
    expect(pct(24).pose).toBe('idle');
  });

  it('celebrates the step at 25', () => expect(pct(25)).toEqual({ pose: 'celebrate', text: "You're 25% through your roadmap!" }));
  it('uses the highest step at or below the percent (74 -> 50)', () => expect(pct(74).text).toBe("You're 50% through your roadmap!"));
  it('handles 100 percent', () => expect(pct(100).text).toBe("You're 100% through your roadmap!"));
  it('ignores a non-numeric percent', () => expect(pct('50').pose).toBe('idle'));
});

describe('M11 Ramy brain: empty roadmap and tips (priorities 4 and 5)', () => {
  it('asks for a first milestone when the list is empty', () => {
    expect(ramyMessage({ milestones: [], today: TODAY })).toEqual({
      pose: 'thinking',
      text: 'Add your first milestone with the + on the line.',
    });
  });

  it('does not use the empty text when milestones are undefined', () => {
    expect(ramyMessage({ today: TODAY })).toEqual({ pose: 'idle', text: TIPS[0] });
  });

  it('returns a tip with no argument at all', () => {
    const r = ramyMessage();
    expect(r.pose).toBe('idle');
    expect(TIPS).toContain(r.text);
  });

  it('treats non-array inputs as missing', () => {
    expect(() => ramyMessage({ milestones: 'x', upcoming: 5, progress: null, today: TODAY })).not.toThrow();
    expect(ramyMessage({ milestones: 'x', upcoming: 5, progress: null, today: TODAY }).text).toBe(TIPS[0]);
  });

  it('skips overdue and due-soon when today is invalid', () => {
    const input = {
      milestones: [ms(1, 'Old', '2026-01-01')],
      upcoming: [up('event', 1, 'Soon', '2026-11-13')],
    };
    for (const today of [undefined, '', 'tomorrow', '2026-1-1', 20261112]) {
      expect(ramyMessage({ ...input, today }).pose).toBe('idle');
    }
  });

  it('exposes exactly six tips, in order', () => {
    expect(TIPS).toEqual(EXPECTED_TIPS);
  });
});

describe('M11 Ramy brain: ordering', () => {
  it('lists overdue > due soon > progress > empty > tips, then the six tips exactly', () => {
    const all = ramyMessages({
      milestones: [ms(1, 'Late', '2026-11-10')],
      upcoming: [up('event', 1, 'Talk', '2026-11-13')],
      progress: { percent: 50 },
      today: TODAY,
    });
    expect(all.slice(0, 3).map((m) => m.pose)).toEqual(['thinking', 'wave', 'celebrate']);
    expect(all.slice(3)).toEqual(EXPECTED_TIPS.map((text) => ({ pose: 'idle', text })));
  });

  it('puts the empty message after progress and before the tips', () => {
    const all = ramyMessages({ milestones: [], progress: { percent: 25 }, upcoming: [], today: TODAY });
    expect(all.map((m) => m.pose).slice(0, 2)).toEqual(['celebrate', 'thinking']);
    expect(all).toHaveLength(2 + EXPECTED_TIPS.length);
  });

  it('returns only the tips when nothing matches, and is never empty', () => {
    expect(ramyMessages({})).toHaveLength(6);
    expect(ramyMessages().length).toBeGreaterThan(0);
  });

  it('ramyMessage is the first of ramyMessages', () => {
    const input = { milestones: [ms(1, 'Late', '2026-11-10')], today: TODAY };
    expect(ramyMessage(input)).toEqual(ramyMessages(input)[0]);
  });
});

describe('M11 Ramy brain: shortTitle', () => {
  it('keeps a 40 character title', () => {
    const t = 'a'.repeat(40);
    expect(shortTitle(t)).toBe(t);
  });

  it('cuts 41 characters to 39 plus an ellipsis', () => {
    expect(shortTitle('a'.repeat(41))).toBe(`${'a'.repeat(39)}…`);
  });

  it('never leaves a lone surrogate when an emoji sits at the cut', () => {
    const title = `${'a'.repeat(38)}😀😀😀`;
    const out = shortTitle(title);
    expect(out).toBe(`${'a'.repeat(38)}😀…`);
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it('trims the title and falls back to Untitled for blank or non-string', () => {
    expect(shortTitle('  Hello  ')).toBe('Hello');
    for (const v of ['', '   ', undefined, null, 5, {}]) expect(shortTitle(v)).toBe('Untitled');
  });

  it('is used in messages', () => {
    const r = ramyMessage({ milestones: [ms(1, 'x'.repeat(60), '2026-11-01')], today: TODAY });
    expect(r.text.startsWith(`${'x'.repeat(39)}… was due 11 days ago`)).toBe(true);
    const blank = ramyMessage({ milestones: [ms(1, '   ', '2026-11-01')], today: TODAY });
    expect(blank.text.startsWith('Untitled was due')).toBe(true);
  });
});

describe('M11 Ramy brain: purity', () => {
  const code = readFileSync(resolve(process.cwd(), 'public/ramy.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('uses no DOM, network, clock or randomness', () => {
    expect(code).not.toMatch(/\bdocument\b/);
    expect(code).not.toMatch(/\bwindow\b/);
    expect(code).not.toMatch(/\bfetch\b/);
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/new Date\(\s*\)/);
    expect(code).not.toMatch(/Date\.now/);
  });

  it('gives the same answer for the same input', () => {
    const input = { milestones: [ms(1, 'Late', '2026-11-10')], today: TODAY };
    expect(ramyMessages(input)).toEqual(ramyMessages(input));
  });
});

