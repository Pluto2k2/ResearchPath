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
