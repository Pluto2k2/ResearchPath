import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: req.app.locals.version,
    commit: req.app.locals.commit,
  });
});
