// Pure date helpers (no DOM) so they can be unit-tested in node.

const pad = (n) => String(n).padStart(2, '0');

export function localToday(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toUtcMs(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// Using UTC midnights keeps DST changes from shifting the day count.
export function daysLabel(targetDate, today) {
  const diff = Math.round((toUtcMs(targetDate) - toUtcMs(today)) / 86400000);
  if (diff === 0) return 'today';
  const n = Math.abs(diff);
  const unit = n === 1 ? 'day' : 'days';
  return diff > 0 ? `${n} ${unit} left` : `${n} ${unit} overdue`;
}

export function dayDiff(targetDate, today) {
  return Math.round((toUtcMs(targetDate) - toUtcMs(today)) / 86400000);
}

// Roadmap wording: "in 3 days" reads better under a node than "3 days left".
export function relativeLabel(targetDate, today) {
  const diff = dayDiff(targetDate, today);
  if (diff === 0) return 'today';
  const n = Math.abs(diff);
  const unit = n === 1 ? 'day' : 'days';
  return diff > 0 ? `in ${n} ${unit}` : `${n} ${unit} overdue`;
}

// A milestone dated today is not overdue: the day is not over yet.
export function isOverdue(targetDate, today) {
  return targetDate < today;
}

// A finished milestone is never late: the past date just means it was done.
export function milestoneOverdue(m, today) {
  return m.status !== 'done' && isOverdue(m.targetDate, today);
}

export function milestoneRelativeLabel(m, today) {
  if (m.status === 'done' && isOverdue(m.targetDate, today)) {
    const n = Math.abs(dayDiff(m.targetDate, today));
    return `${n} ${n === 1 ? 'day' : 'days'} ago`;
  }
  return relativeLabel(m.targetDate, today);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Hand-made instead of Intl so the output never depends on the browser locale.
export function formatShortDate(ymd) {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
