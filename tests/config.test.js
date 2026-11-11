import { describe, it, expect } from 'vitest';
import { loadConfig, config } from '../src/config.js';

describe('Configuration', () => {
  it('uses defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      dbPath: './data/researchpath.db',
      nodeEnv: 'development',
    });
  });

  it('reads overrides from the environment', () => {
    expect(
      loadConfig({ PORT: '4000', DB_PATH: ':memory:', NODE_ENV: 'production' }),
    ).toEqual({ port: 4000, dbPath: ':memory:', nodeEnv: 'production' });
  });

  it('falls back to port 3000 when PORT is not a number', () => {
    expect(loadConfig({ PORT: 'abc' }).port).toBe(3000);
  });

  it('exports a frozen config object', () => {
    expect(Object.isFrozen(config)).toBe(true);
  });
});
