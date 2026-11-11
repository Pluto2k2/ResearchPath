function toMilestone(row) {
  return {
    id: row.id,
    title: row.title,
    targetDate: row.target_date,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function createMilestone(db, { title, targetDate, notes, createdAt }) {
  const result = db
    .prepare('INSERT INTO milestones (title, target_date, notes, created_at) VALUES (?, ?, ?, ?)')
    .run(title, targetDate, notes, createdAt);
  const row = db
    .prepare('SELECT * FROM milestones WHERE id = ?')
    .get(Number(result.lastInsertRowid));
  return toMilestone(row);
}

export function updateMilestoneStatus(db, id, status) {
  const result = db.prepare('UPDATE milestones SET status = ? WHERE id = ?').run(status, id);
  if (result.changes === 0) return null;
  return toMilestone(db.prepare('SELECT * FROM milestones WHERE id = ?').get(id));
}

export function countMilestonesByStatus(db) {
  return db
    .prepare('SELECT status, COUNT(*) AS count FROM milestones GROUP BY status')
    .all()
    .map((row) => ({ status: row.status, count: row.count }));
}

export function listMilestones(db) {
  return db
    .prepare('SELECT * FROM milestones ORDER BY target_date ASC, created_at ASC, id ASC')
    .all()
    .map(toMilestone);
}
