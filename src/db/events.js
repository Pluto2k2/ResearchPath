const ORDER = 'ORDER BY date ASC, created_at ASC, id ASC';

function toEvent(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    date: row.date,
    url: row.url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function createEvent(db, { title, type, date, url, notes, createdAt }) {
  const result = db
    .prepare('INSERT INTO events (title, type, date, url, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(title, type, date, url, notes, createdAt);
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(result.lastInsertRowid));
  return toEvent(row);
}

export function listEvents(db) {
  return db.prepare(`SELECT * FROM events ${ORDER}`).all().map(toEvent);
}

export function listEventsBetween(db, from, to) {
  return db
    .prepare(`SELECT * FROM events WHERE date >= ? AND date <= ? ${ORDER}`)
    .all(from, to)
    .map(toEvent);
}
