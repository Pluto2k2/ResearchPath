import { formatShortDate } from './dates.js';
import { createRamyImage } from './mascot.js';

const EVENT_LABELS = {
  conference: 'Conference',
  seminar: 'Seminar',
  deadline: 'Deadline',
  funding: 'Funding call',
};

export function kindLabel(item) {
  if (item.kind === 'milestone') return 'Milestone';
  return EVENT_LABELS[item.type] ?? 'Event';
}

// Shows the server's daysLeft as is: the client never recomputes it.
export function daysText(item) {
  const n = Math.abs(item.daysLeft);
  if (item.daysLeft === 0) return 'today';
  const unit = n === 1 ? 'day' : 'days';
  return item.daysLeft > 0 ? `${n} ${unit} left` : `${n} ${unit} overdue`;
}

// Blocks javascript: and other schemes even if the server let one through.
export function isSafeUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderUpcomingItem(item) {
  const li = el('li', 'upcoming-item');
  const overdue = item.overdue === true || item.daysLeft < 0;
  if (overdue) li.classList.add('overdue');

  li.append(el('span', 'upcoming-date', formatShortDate(item.date)));
  li.append(el('span', 'upcoming-kind', kindLabel(item)));

  if (item.kind === 'event' && isSafeUrl(item.url)) {
    const a = el('a', 'upcoming-title', item.title);
    a.href = item.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    li.append(a);
  } else {
    li.append(el('span', 'upcoming-title', item.title));
  }

  li.append(el('span', 'upcoming-days', daysText(item)));
  if (overdue) li.append(el('span', 'upcoming-flag', 'Overdue'));
  return li;
}

export function renderUpcoming(listEl, items) {
  listEl.replaceChildren();
  if (!items || items.length === 0) {
    const empty = el('li', 'upcoming-empty');
    empty.append(createRamyImage('sleep'), el('span', null, 'Nothing due in the next 30 days.'));
    listEl.append(empty);
    return;
  }
  for (const item of items) listEl.append(renderUpcomingItem(item));
}
