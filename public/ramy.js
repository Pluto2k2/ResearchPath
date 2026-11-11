// Ramy's brain: pure functions (no DOM, no fetch, no clock, no randomness) so the
// same logic can be reused later, for example in email reminders.
import { dayDiff } from './dates.js';

export const TIPS = [
  'Click a milestone on the path to change its status.',
  'Add conferences, seminars and funding calls with + Event.',
  'Everything due soon is listed under Next 30 days.',
  'Pick arXiv categories in Research news to see new papers.',
  'Split a big milestone into smaller ones to keep moving.',
  'Overdue milestones get a coral halo on the path.',
];

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const STEPS = [25, 50, 75, 100];
const DUE_SOON_DAYS = 7;

function isDate(value) {
  if (typeof value !== 'string' || !YMD.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// Array.from counts code points, so a surrogate pair is never cut in half.
export function shortTitle(title, max = 40) {
  if (typeof title !== 'string' || title.trim() === '') return 'Untitled';
  const text = title.trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

function plural(n) {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function overdueMessage(milestones, today) {
  const late = milestones
    .filter((m) => m && m.status !== 'done' && isDate(m.targetDate) && m.targetDate < today)
    .sort((a, b) => (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : byId(a, b)));
  if (late.length === 0) return null;
  const n = -dayDiff(late[0].targetDate, today);
  return {
    pose: 'thinking',
    text: `${shortTitle(late[0].title)} was due ${plural(n)} ago, want to update it?`,
  };
}

function dueSoonMessage(upcoming, today) {
  const soon = [];
  for (const item of upcoming) {
    if (!item || !isDate(item.date)) continue;
    if (item.kind === 'milestone' && item.status === 'done') continue;
    const d = dayDiff(item.date, today);
    if (d >= 0 && d <= DUE_SOON_DAYS) soon.push({ item, d });
  }
  if (soon.length === 0) return null;
  const rank = (x) => (x.item.kind === 'milestone' ? 0 : 1);
  soon.sort((a, b) => a.d - b.d || rank(a) - rank(b) || byId(a.item, b.item));
  const { item, d } = soon[0];
  const t = shortTitle(item.title);
  const when = d === 0 ? 'is today!' : d === 1 ? 'is tomorrow!' : `is in ${d} days!`;
  return { pose: 'wave', text: `${t} ${when}` };
}

function progressMessage(progress) {
  const percent = progress?.percent;
  if (typeof percent !== 'number') return null;
  const reached = STEPS.filter((s) => s <= percent);
  if (reached.length === 0) return null;
  return { pose: 'celebrate', text: `You're ${reached[reached.length - 1]}% through your roadmap!` };
}

export function ramyMessages({ milestones, progress, upcoming, today } = {}) {
  const list = [];
  const validToday = typeof today === 'string' && YMD.test(today);
  if (validToday && Array.isArray(milestones)) {
    const m = overdueMessage(milestones, today);
    if (m) list.push(m);
  }
  if (validToday && Array.isArray(upcoming)) {
    const m = dueSoonMessage(upcoming, today);
    if (m) list.push(m);
  }
  const step = progressMessage(progress);
  if (step) list.push(step);
  if (Array.isArray(milestones) && milestones.length === 0) {
    list.push({ pose: 'thinking', text: 'Add your first milestone with the + on the line.' });
  }
  for (const text of TIPS) list.push({ pose: 'idle', text });
  return list;
}

export function ramyMessage(input) {
  return ramyMessages(input)[0];
}
