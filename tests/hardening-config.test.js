import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));

function listJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listJs(full) : full.endsWith('.js') ? [full] : [];
  });
}

describe('M10 .env loading', () => {
  it('loads .env in npm start when the file exists', () => {
    expect(pkg.scripts.start).toContain('--env-file-if-exists=.env');
  });

  it('loads .env in npm run dev when the file exists', () => {
    expect(pkg.scripts.dev).toContain('--env-file-if-exists=.env');
  });

  it('does not use the strict --env-file flag, which fails when .env is missing', () => {
    expect(pkg.scripts.start).not.toMatch(/--env-file=/);
    expect(pkg.scripts.dev).not.toMatch(/--env-file=/);
  });

  it('docker-compose loads an optional .env through env_file', () => {
    const compose = read('docker-compose.yml');
    expect(compose).toMatch(/env_file:\s*\n\s*-\s*path:\s*\.env\s*\n\s*required:\s*false/);
  });

  it('docker-compose runs with an init process', () => {
    expect(read('docker-compose.yml')).toMatch(/^\s*init:\s*true\s*$/m);
  });

  it('keeps the Dockerfile CMD free of env-file flags', () => {
    const cmds = read('Dockerfile').split(/\r?\n/).filter((l) => l.startsWith('CMD'));
    expect(cmds.at(-1)).toBe('CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]');
    expect(cmds.at(-1)).not.toContain('env-file');
  });

  it('is released as version 0.3.0', () => {
    expect(pkg.version).toBe('0.3.0');
  });
});

describe('M10 config.js stays the only reader of process.env', () => {
  it('has no process.env in src/ outside config.js', () => {
    const offenders = listJs(resolve(root, 'src'))
      .filter((f) => !/[\\/]config\.js$/.test(f))
      .filter((f) => readFileSync(f, 'utf8').includes('process.env'));
    expect(offenders).toEqual([]);
  });
});

describe('M10 RENDER_GIT_COMMIT in config', () => {
  it('reads and trims the commit', () => {
    expect(loadConfig({ RENDER_GIT_COMMIT: '  abc123 ' }).commit).toBe('abc123');
  });

  it('leaves commit undefined when unset or blank', () => {
    expect(loadConfig({}).commit).toBeUndefined();
    expect(loadConfig({ RENDER_GIT_COMMIT: '' }).commit).toBeUndefined();
    expect(loadConfig({ RENDER_GIT_COMMIT: '   ' }).commit).toBeUndefined();
  });
});
