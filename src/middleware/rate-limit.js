// Fixed-window limiter, one counter per client IP. State lives in the closure,
// so each app instance (and each test) has its own.
export function createRateLimiter({ now, limit = 30, windowMs = 60_000 }) {
  const windows = new Map();
  let lastSweep = now().getTime();

  // Dropping expired windows (at most once per window) keeps memory bounded.
  function sweep(t) {
    if (t - lastSweep < windowMs) return;
    lastSweep = t;
    for (const [ip, entry] of windows) {
      if (t - entry.start >= windowMs) windows.delete(ip);
    }
  }

  return function rateLimiter(req, res, next) {
    const t = now().getTime();
    sweep(t);

    let entry = windows.get(req.ip);
    if (!entry || t - entry.start >= windowMs) {
      entry = { start: t, count: 1 };
      windows.set(req.ip, entry);
    } else {
      entry.count += 1;
    }

    if (entry.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((entry.start + windowMs - t) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res
        .status(429)
        .json({ error: 'Too many requests. Please try again in a minute.' });
    }
    next();
  };
}
