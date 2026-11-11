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

export function listMilestones(db) {
  return db
    .prepare('SELECT * FROM milestones ORDER BY target_date ASC, created_at ASC, id ASC')
    .all()
    .map(toMilestone);
}
