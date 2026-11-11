import { Router } from 'express';
import { validateNewsQuery } from '../validation/news.js';
import { UpstreamError } from '../news/errors.js';

export const newsRouter = Router();

// Only upstream failures become a 502; anything else is a bug and goes to the 500 handler.
function newsHandler(method) {
  return async (req, res) => {
    const { value, error } = validateNewsQuery(req.query);
    if (error) return res.status(400).json({ error });
    try {
      const result = await req.app.locals.news[method](value);
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof UpstreamError) {
        return res.status(502).json({ error: err.message });
      }
      throw err;
    }
  };
}

newsRouter.get('/news/papers', newsHandler('getPapers'));
newsRouter.get('/news/topics', newsHandler('getTopics'));
