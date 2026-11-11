import { Router } from 'express';
import { countMilestonesByStatus } from '../db/milestones.js';
import { STATUSES } from '../validation/milestones.js';

export const progressRouter = Router();

progressRouter.get('/progress', (req, res) => {
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const { status, count } of countMilestonesByStatus(req.app.locals.db)) {
    byStatus[status] = count;
  }
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  const done = byStatus.done;
  const percent = total === 0 ? 0 : Math.round((done * 100) / total);
  res.status(200).json({ total, done, percent, byStatus });
});
