// The only file in src/ allowed to read process.env.
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    dbPath: env.DB_PATH || './data/researchpath.db',
    nodeEnv: env.NODE_ENV || 'development',
    // Optional: OpenAlex "polite pool" contact address.
    openAlexMailto: env.OPENALEX_MAILTO?.trim() || undefined,
  };
}

export const config = Object.freeze(loadConfig());
