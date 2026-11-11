import { Router } from 'express';
import { listEventsBetween } from '../db/events.js';
import { listOpenMilestonesUntil } from '../db/milestones.js';

export const upcomingRouter = Router();

const DAY_MS = 86400000;
const WINDOW_DAYS = 30;

function utcMs(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

upcomingRouter.get('/upcoming', (req, res) => {
  const { db, now } = req.app.locals;
  const today = now().toISOString().slice(0, 10);
  const todayMs = utcMs(today);
  const end = new Date(todayMs + WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
  const daysLeft = (date) => Math.round((utcMs(date) - todayMs) / DAY_MS);

  const milestones = listOpenMilestonesUntil(db, end).map((m) => ({
    kind: 'milestone',
    id: m.id,
    title: m.title,
    date: m.targetDate,
    daysLeft: daysLeft(m.targetDate),
    overdue: m.targetDate < today,
    status: m.status,
  }));
  const events = listEventsBetween(db, today, end).map((e) => ({
    kind: 'event',
    id: e.id,
    title: e.title,
    date: e.date,
    daysLeft: daysLeft(e.date),
    overdue: false,
    type: e.type,
    url: e.url,
  }));

  const rank = (item) => (item.kind === 'milestone' ? 0 : 1);
  const items = [...milestones, ...events].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      rank(a) - rank(b) ||
      a.id - b.id,
  );
  res.status(200).json(items);
});
