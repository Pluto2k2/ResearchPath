import { daysLabel, localToday } from './dates.js';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

const form = document.querySelector('#milestone-form');
const errorBox = document.querySelector('#milestone-error');
const roadmap = document.querySelector('#roadmap');
const submitButton = form.querySelector('button[type="submit"]');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderMilestone(m, today) {
  const li = el('li', 'timeline-item');
  li.append(el('h3', 'timeline-title', m.title));
  const meta = el('p', 'timeline-meta');
  meta.append(el('time', 'timeline-date', m.targetDate));
  meta.append(el('span', 'timeline-days', daysLabel(m.targetDate, today)));
  li.append(meta);
  if (m.notes !== null && m.notes !== undefined && m.notes !== '') {
    li.append(el('p', 'timeline-notes', m.notes));
  }
  return li;
}

function renderRoadmap(milestones) {
  roadmap.replaceChildren();
  if (milestones.length === 0) {
    roadmap.append(el('li', 'timeline-empty', 'No milestones yet. Add your first one above.'));
    return;
  }
  const today = localToday(new Date());
  for (const m of milestones) roadmap.append(renderMilestone(m, today));
}

async function readError(res) {
  try {
    const body = await res.json();
    return typeof body.error === 'string' ? body.error : GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

async function loadRoadmap() {
  try {
    const res = await fetch('/api/milestones');
    if (!res.ok) throw new Error(await readError(res));
    renderRoadmap(await res.json());
    errorBox.textContent = '';
  } catch (err) {
    errorBox.textContent = err.message || GENERIC_ERROR;
  }
}

async function onSubmit(event) {
  event.preventDefault();
  errorBox.textContent = '';
  const payload = {
    title: form.elements.title.value,
    targetDate: form.elements.targetDate.value,
    notes: form.elements.notes.value,
  };
  // Disabled during the request so a double tap cannot create the milestone twice.
  submitButton.disabled = true;
  try {
    const res = await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      errorBox.textContent = await readError(res);
      return;
    }
    form.reset();
    await loadRoadmap();
  } catch {
    errorBox.textContent = GENERIC_ERROR;
  } finally {
    submitButton.disabled = false;
  }
}

form.addEventListener('submit', onSubmit);
loadRoadmap();
