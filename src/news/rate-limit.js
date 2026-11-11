// arXiv asks for at most one request every 3 seconds. Tasks are queued, never dropped.
export function createSpacer({ now, wait, intervalMs = 3000 }) {
  let lastStart = null;
  let chain = Promise.resolve();

  function schedule(task) {
    const result = chain.then(async () => {
      const nowMs = now().getTime();
      const start = lastStart === null ? nowMs : Math.max(nowMs, lastStart + intervalMs);
      if (start > nowMs) await wait(start - nowMs);
      lastStart = start;
      return task();
    });
    // A failed task must not break the chain for the next ones.
    chain = result.catch(() => {});
    return result;
  }

  return { schedule };
}
