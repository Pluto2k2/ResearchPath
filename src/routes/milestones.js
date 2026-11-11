import { Router } from 'express';
import { createMilestone, listMilestones, updateMilestoneStatus } from '../db/milestones.js';
import { validateMilestone, validateStatus } from '../validation/milestones.js';

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

milestonesRouter.patch('/milestones/:id/status', (req, res) => {
  const { id: rawId } = req.params;
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id)) {
    return res.status(404).json({ error: 'Milestone not found' });
  }
  const { value, error } = validateStatus(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const milestone = updateMilestoneStatus(req.app.locals.db, id, value.status);
  if (!milestone) {
    return res.status(404).json({ error: 'Milestone not found' });
  }
  res.status(200).json(milestone);
});
