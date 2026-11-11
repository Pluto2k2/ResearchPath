import { Router } from 'express';
import { createMilestone, listMilestones } from '../db/milestones.js';
import { validateMilestone } from '../validation/milestones.js';

export const milestonesRouter = Router();

milestonesRouter.get('/milestones', (req, res) => {
  res.status(200).json(listMilestones(req.app.locals.db));
});

milestonesRouter.post('/milestones', (req, res) => {
  const { value, error } = validateMilestone(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const createdAt = req.app.locals.now().toISOString();
  const milestone = createMilestone(req.app.locals.db, { ...value, createdAt });
  res.status(201).json(milestone);
});
