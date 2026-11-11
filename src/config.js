// Non-negative integer, or undefined when unset, blank or invalid.
function parseHops(value) {
  const text = value?.trim();
  if (!text || !/^\d+$/.test(text)) return undefined;
  return Number(text);
}

// The only file in src/ allowed to read process.env.
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    dbPath: env.DB_PATH || './data/researchpath.db',
    nodeEnv: env.NODE_ENV || 'development',
    // Optional: OpenAlex "polite pool" contact address.
    openAlexMailto: env.OPENALEX_MAILTO?.trim() || undefined,
    // Optional: set by Render at runtime; shown by /api/health.
    commit: env.RENDER_GIT_COMMIT?.trim() || undefined,
    // Optional: number of proxy hops to trust for the client IP.
    trustProxyHops: parseHops(env.TRUST_PROXY_HOPS),
  };
}

export const config = Object.freeze(loadConfig());
