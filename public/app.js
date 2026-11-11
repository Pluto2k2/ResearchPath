import { localToday } from './dates.js';
import { bindPopover, renderRoadmap } from './roadmap.js';
import { initHeroRamy } from './mascot.js';
import { initNews } from './news.js';
import { startRouter } from './router.js';
import { STATUS_VALUES } from './status.js';
import { renderUpcoming } from './upcoming.js';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const NETWORK_ERROR = 'Network error. Check your connection and try again.';
const RESIZE_DELAY_MS = 150;

const form = document.querySelector('#milestone-form');
const errorBox = document.querySelector('#milestone-error');
const roadmap = document.querySelector('#roadmap');
const addPopover = document.getElementById('add-popover');
const submitButton = form.querySelector('button[type="submit"]');
const addPopoverController = bindPopover(
  addPopover,
  addPopover.querySelector('.popover-close'),
  { fallback: () => roadmap.querySelector('.add-node') },
);

const upcomingList = document.querySelector('#upcoming-list');
const eventAdd = document.querySelector('#event-add');
const eventForm = document.querySelector('#event-form');
const eventSubmit = eventForm.querySelector('button[type="submit"]');
const eventPopover = document.getElementById('event-popover');
const eventPopoverController = bindPopover(eventPopover, eventPopover.querySelector('.popover-close'));

const headerAdd = document.querySelector('#header-add');
let milestones = [];
let milestonesLoaded = false;
let lastProgress = null;
let lastUpcoming = null;
const hero = initHeroRamy();
let openedBy = null;
let lastWidth = 0;

function draw() {
  lastWidth = roadmap.clientWidth;
  const wasOpen = addPopoverController.isOpen();
  renderRoadmap(roadmap, milestones, localToday(new Date()), {
    onAdd: toggleAdd,
    onStatus: changeStatus,
  });
  // The "+" was rebuilt: keep an open add popover attached to the new one
  // (unless it was opened from the header button, which is never rebuilt).
  if (wasOpen && openedBy !== headerAdd) {
    openedBy = roadmap.querySelector('.add-node');
    addPopoverController.setTrigger(openedBy);
  }
}

function toggleAdd(trigger) {
  if (addPopoverController.isOpenFor(trigger)) addPopoverController.close();
  else {
    openedBy = trigger;
    addPopoverController.open(trigger);
  }
}

// Focus goes back to whichever control opened the popover.
function focusOpener() {
  const target = openedBy?.isConnected ? openedBy : roadmap.querySelector('.add-node');
  target?.focus();
}

// Closes the popover (so the message at the top is visible) and puts focus back on "+".
function failSubmit(message) {
  errorBox.textContent = message;
  addPopoverController.close();
  focusOpener();
}

async function readError(res) {
  try {
    const body = await res.json();
    return typeof body.error === 'string' ? body.error : GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

const progressText = document.querySelector('#progress-text');
const progressBar = document.querySelector('#progress-bar');
const progressFill = document.querySelector('#progress-fill');

function isCount(n) {
  return Number.isInteger(n) && n >= 0;
}

function renderProgress(p) {
  const ok =
    p &&
    isCount(p.total) &&
    isCount(p.done) &&
    typeof p.percent === 'number' &&
    p.percent >= 0 &&
    p.percent <= 100 &&
    p.byStatus &&
    STATUS_VALUES.every((s) => isCount(p.byStatus[s]));
  if (!ok) throw new Error(GENERIC_ERROR);
  progressText.textContent = `${p.done} of ${p.total} milestones done (${p.percent}%)`;
  progressBar.setAttribute('aria-valuenow', String(p.percent));
  progressFill.style.width = `${p.percent}%`;
  for (const status of STATUS_VALUES) {
    document.querySelector(`#progress-count-${status}`).textContent = String(p.byStatus[status]);
  }
}

// Never throws: a progress problem must not break the rest of the page.
let progressRequest = 0;

async function loadProgress() {
  // Only the latest request may update the page: an older, slower answer is dropped.
  const mine = ++progressRequest;
  try {
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    if (mine === progressRequest) {
      renderProgress(data);
      lastProgress = data;
    }
  } catch (err) {
    if (mine !== progressRequest) return;
    errorBox.textContent = err instanceof TypeError ? NETWORK_ERROR : err.message || GENERIC_ERROR;
  }
}

// Same latest-request-wins rule as loadProgress. Never throws.
let upcomingRequest = 0;

async function loadUpcoming() {
  const mine = ++upcomingRequest;
  try {
    const res = await fetch('/api/upcoming');
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(GENERIC_ERROR);
    if (mine === upcomingRequest) {
      renderUpcoming(upcomingList, data);
      lastUpcoming = data;
    }
  } catch (err) {
    if (mine !== upcomingRequest) return;
    errorBox.textContent = err instanceof TypeError ? NETWORK_ERROR : err.message || GENERIC_ERROR;
  }
}

function refreshRamy() {
  hero.update({
    milestones: milestonesLoaded ? milestones : null,
    progress: lastProgress,
    upcoming: lastUpcoming,
    today: localToday(new Date()),
  });
}

async function onEventSubmit(event) {
  event.preventDefault();
  errorBox.textContent = '';
  const payload = {
    title: eventForm.elements.title.value,
    type: eventForm.elements.type.value,
    date: eventForm.elements.date.value,
    url: eventForm.elements.url.value,
    notes: eventForm.elements.notes.value,
  };
  eventSubmit.disabled = true;
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Typed values stay in the form for the next try.
      showError(await readError(res));
      eventPopoverController.close();
      return;
    }
    eventForm.reset();
    eventPopoverController.close();
    await loadUpcoming();
    refreshRamy();
  } catch {
    showError(NETWORK_ERROR);
    eventPopoverController.close();
  } finally {
    eventSubmit.disabled = false;
  }
}

// The popover is far from the message at the top, so scroll it into view.
function showError(message) {
  errorBox.textContent = message;
  if (typeof errorBox.scrollIntoView === 'function') errorBox.scrollIntoView({ block: 'nearest' });
}

// Returns the updated milestone, or null after showing the error (status stays unchanged).
async function changeStatus(id, status) {
  errorBox.textContent = '';
  const was = milestones.find((m) => m.id === id)?.status;
  try {
    const res = await fetch(`/api/milestones/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      showError(await readError(res));
      return null;
    }
    const updated = await res.json();
    milestones = milestones.map((m) => (m.id === updated.id ? updated : m));
    draw();
    await Promise.all([loadProgress(), loadUpcoming()]);
    refreshRamy();
    if (updated.status === 'done' && was !== 'done') hero.celebrate();
    return updated;
  } catch {
    showError(NETWORK_ERROR);
    return null;
  }
}

async function loadRoadmap() {
  try {
    const res = await fetch('/api/milestones');
    if (!res.ok) throw new Error(await readError(res));
    milestones = await res.json();
    milestonesLoaded = true;
    draw();
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
      // The typed values stay in the form for the next try.
      failSubmit(await readError(res));
      return;
    }
    addPopoverController.close();
    form.reset();
    await loadRoadmap();
    focusOpener();
    Promise.all([loadProgress(), loadUpcoming()]).then(refreshRamy);
  } catch {
    // fetch itself threw (offline): same handling as an API error.
    failSubmit(NETWORK_ERROR);
  } finally {
    submitButton.disabled = false;
  }
}

// Debounced, and only on width change: phone browsers fire resize when the URL bar hides.
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const width = roadmap.clientWidth;
    // A hidden roadmap (news tab) measures 0: drawing then would break the layout.
    if (width !== 0 && width !== lastWidth) draw();
  }, RESIZE_DELAY_MS);
});

headerAdd.addEventListener('click', () => toggleAdd(headerAdd));
form.addEventListener('submit', onSubmit);
eventAdd.addEventListener('click', () => {
  if (eventPopoverController.isOpenFor(eventAdd)) eventPopoverController.close();
  else eventPopoverController.open(eventAdd);
});
eventForm.addEventListener('submit', onEventSubmit);
Promise.all([loadRoadmap(), loadProgress(), loadUpcoming()]).then(refreshRamy);

const news = initNews();
startRouter({
  onNews: () => {
    // Popovers belong to the roadmap tab; a synthetic outside press closes whichever is open.
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    news.activate();
  },
  // The roadmap may have been drawn (or resized) while hidden: redraw at its real width.
  onRoadmap: () => {
    const width = roadmap.clientWidth;
    if (width !== 0 && width !== lastWidth) draw();
  },
});
