import { DATE_FORMAT, isRealDate } from './dates.js';

const TITLE_MAX = 120;
const NOTES_MAX = 2000;

export const STATUSES = ['todo', 'doing', 'done', 'blocked'];

export function validateStatus(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }
  const status = typeof body.status === 'string' ? body.status.trim() : '';
  if (!STATUSES.includes(status)) {
    return { error: `Status must be one of: ${STATUSES.join(', ')}` };
  }
  return { value: { status } };
}

export function validateMilestone(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  let title = body.title;
  if (title !== undefined && title !== null && typeof title !== 'string') {
    return { error: 'Title must be a string' };
  }
  title = (title ?? '').trim();
  if (title === '') return { error: 'Title is required' };
  if (title.length > TITLE_MAX) {
    return { error: `Title must be at most ${TITLE_MAX} characters` };
  }

  let targetDate = body.targetDate;
  if (targetDate === undefined || targetDate === null) {
    return { error: 'Target date is required' };
  }
  if (typeof targetDate !== 'string') {
    return { error: 'Target date must use the YYYY-MM-DD format' };
  }
  targetDate = targetDate.trim();
  if (targetDate === '') return { error: 'Target date is required' };
  if (!DATE_FORMAT.test(targetDate)) {
    return { error: 'Target date must use the YYYY-MM-DD format' };
  }
  if (!isRealDate(targetDate)) {
    return { error: 'Target date must be a real calendar date' };
  }

  let notes = body.notes;
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return { error: 'Notes must be a string' };
  }
  notes = (notes ?? '').trim();
  if (notes.length > NOTES_MAX) {
    return { error: `Notes must be at most ${NOTES_MAX} characters` };
  }

  return { value: { title, targetDate, notes: notes === '' ? null : notes } };
}
