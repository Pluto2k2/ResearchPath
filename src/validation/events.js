import { DATE_FORMAT, isRealDate } from './dates.js';

const TITLE_MAX = 120;
const URL_MAX = 500;
const NOTES_MAX = 2000;

export const EVENT_TYPES = ['conference', 'seminar', 'deadline', 'funding'];

export function validateEvent(body) {
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

  const rawType = body.type;
  if (rawType === undefined || rawType === null || (typeof rawType === 'string' && rawType.trim() === '')) {
    return { error: 'Type is required' };
  }
  const type = typeof rawType === 'string' ? rawType.trim() : '';
  if (!EVENT_TYPES.includes(type)) {
    return { error: `Type must be one of: ${EVENT_TYPES.join(', ')}` };
  }

  let date = body.date;
  if (date === undefined || date === null) return { error: 'Date is required' };
  if (typeof date !== 'string') return { error: 'Date must use the YYYY-MM-DD format' };
  date = date.trim();
  if (date === '') return { error: 'Date is required' };
  if (!DATE_FORMAT.test(date)) return { error: 'Date must use the YYYY-MM-DD format' };
  if (!isRealDate(date)) return { error: 'Date must be a real calendar date' };

  let url = body.url;
  if (url !== undefined && url !== null && typeof url !== 'string') {
    return { error: 'URL must be a string' };
  }
  url = (url ?? '').trim();
  if (url.length > URL_MAX) {
    return { error: `URL must be at most ${URL_MAX} characters` };
  }
  if (url !== '' && !url.startsWith('http://') && !url.startsWith('https://')) {
    return { error: 'URL must start with http:// or https://' };
  }

  let notes = body.notes;
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return { error: 'Notes must be a string' };
  }
  notes = (notes ?? '').trim();
  if (notes.length > NOTES_MAX) {
    return { error: `Notes must be at most ${NOTES_MAX} characters` };
  }

  return {
    value: {
      title,
      type,
      date,
      url: url === '' ? null : url,
      notes: notes === '' ? null : notes,
    },
  };
}
