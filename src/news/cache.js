// Only successful answers are stored by the caller, so a failure is retried next time.
export function createTtlCache({ now, ttlMs, maxEntries = 500 }) {
  const entries = new Map();

  function get(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now().getTime() >= entry.expiresAt) {
      entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value) {
    const nowMs = now().getTime();
    for (const [k, entry] of entries) {
      if (nowMs >= entry.expiresAt) entries.delete(k);
    }
    // Delete first so re-setting a key moves it to the end (newest).
    entries.delete(key);
    entries.set(key, { value, expiresAt: nowMs + ttlMs });
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  }

  return { get, set };
}
