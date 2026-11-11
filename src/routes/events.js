import { Router } from 'express';
import { createEvent, listEvents } from '../db/events.js';
import { validateEvent } from '../validation/events.js';

export const eventsRouter = Router();

eventsRouter.get('/events', (req, res) => {
  res.status(200).json(listEvents(req.app.locals.db));
});

eventsRouter.post('/events', (req, res) => {
  const { value, error } = validateEvent(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const createdAt = req.app.locals.now().toISOString();
  res.status(201).json(createEvent(req.app.locals.db, { ...value, createdAt }));
});
