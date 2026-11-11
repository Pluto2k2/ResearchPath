import { describe, it, expect } from 'vitest';
import { milestoneOverdue, milestoneRelativeLabel } from '../public/dates.js';

const TODAY = '2026-11-12';
const m = (status, targetDate) => ({ status, targetDate });

describe('M10 done milestones are never overdue (helpers)', () => {
  it('does not mark a done milestone with a past date as overdue', () => {
    expect(milestoneOverdue(m('done', '2026-11-01'), TODAY)).toBe(false);
  });

  it('labels a done past milestone "N days ago"', () => {
    expect(milestoneRelativeLabel(m('done', '2026-11-01'), TODAY)).toBe('11 days ago');
  });

  it('uses the singular for 1 day ago', () => {
    expect(milestoneRelativeLabel(m('done', '2026-11-11'), TODAY)).toBe('1 day ago');
  });

  it.each(['todo', 'doing', 'blocked'])('keeps %s past milestones overdue with the old label', (status) => {
    expect(milestoneOverdue(m(status, '2026-11-01'), TODAY)).toBe(true);
    expect(milestoneRelativeLabel(m(status, '2026-11-01'), TODAY)).toBe('11 days overdue');
  });

  it('keeps the normal label for a done milestone dated today or in the future', () => {
    expect(milestoneRelativeLabel(m('done', TODAY), TODAY)).toBe('today');
    expect(milestoneRelativeLabel(m('done', '2026-11-15'), TODAY)).toBe('in 3 days');
    expect(milestoneOverdue(m('done', TODAY), TODAY)).toBe(false);
    expect(milestoneOverdue(m('done', '2026-11-15'), TODAY)).toBe(false);
  });
});
