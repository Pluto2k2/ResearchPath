import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/index.js';

const dbs = [];
const dirs = [];

afterEach(() => {
  for (const db of dbs.splice(0)) {
    try {
      db.close();
    } catch {
      // already closed
    }
  }
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Database opening', () => {
  it('opens an in-memory database that answers queries', () => {
    const db = openDatabase(':memory:');
    dbs.push(db);
    expect(db.prepare('SELECT 1 AS one').get().one).toBe(1);
  });

  it('creates the missing parent folder and the file for a file path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-db-'));
    dirs.push(root);
    const file = path.join(root, 'a', 'b', 'test.db');
    const db = openDatabase(file);
    dbs.push(db);
    expect(db.prepare('SELECT 1 AS one').get().one).toBe(1);
    expect(fs.existsSync(path.dirname(file))).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
  });
});
