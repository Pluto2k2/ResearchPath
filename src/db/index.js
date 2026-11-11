import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  // SQLite creates the file but not its folder.
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  return new DatabaseSync(path);
}
