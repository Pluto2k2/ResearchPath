import { formatShortDate, isOverdue, relativeLabel } from './dates.js';
import { STATUS_LABELS, STATUS_VALUES, statusClass, statusLabel } from './status.js';
import {
  MID,
  computeGap,
  initialScrollLeft,
  labelSide,
  nodeX,
  todayIndex,
  todayX,
  trackWidth,
  waveY,
  wavePath,
} from './roadmap-layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TRACK_HEIGHT = 300;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---- Popovers: shared open/close behaviour (Esc, outside pointerdown, focus handling) ----

let openPopover = null;

const FOCUSABLE = 'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])';

// fallback() returns the element to focus when the trigger was removed by a redraw.
export function bindPopover(popover, closeButton, { fallback } = {}) {
  let trigger = null;

  function close({ restoreFocus = true } = {}) {
    if (openPopover !== api) return;
    popover.hidden = true;
    openPopover = null;
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onPointerdown);
    if (restoreFocus) {
      const target = trigger && trigger.isConnected ? trigger : fallback?.();
      if (target) target.focus();
    }
    trigger = null;
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close();
    else if (event.key === 'Tab') trapTab(event);
  }

  // Keeps Tab / Shift+Tab cycling inside the open popover.
  function trapTab(event) {
    const items = [...popover.querySelectorAll(FOCUSABLE)].filter((node) => !node.disabled);
    if (items.length === 0) {
      event.preventDefault();
      popover.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!popover.contains(active) || active === popover) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // The trigger is excluded so that clicking it again toggles instead of close-then-reopen.
  function onPointerdown(event) {
    if (popover.contains(event.target)) return;
    if (trigger && trigger.contains(event.target)) return;
    close({ restoreFocus: false });
  }

  function open(newTrigger) {
    if (openPopover) openPopover.close({ restoreFocus: false });
    trigger = newTrigger;
    popover.hidden = false;
    openPopover = api;
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('pointerdown', onPointerdown);
    const target = popover.querySelector('input, textarea') || popover;
    target.focus();
  }

  const api = {
    open,
    close,
    isOpenFor: (candidate) => openPopover === api && trigger === candidate,
    isOpen: () => openPopover === api,
    // After a redraw the old trigger is gone: point at the new one.
    setTrigger: (newTrigger) => {
      if (openPopover === api) trigger = newTrigger;
    },
  };
  closeButton.addEventListener('click', () => close());
  return api;
}

let detail = null;

function getDetailPopover() {
  if (detail) return detail;
  const root = el('div', 'popover card');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', 'detail-title');
  root.tabIndex = -1;
  root.hidden = true;
  const closeButton = el('button', 'popover-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');
  const title = el('h2', 'popover-title');
  title.id = 'detail-title';
  const meta = el('p', 'popover-meta');
  const date = el('time', 'popover-date');
  const relative = el('span', 'popover-relative');
  meta.append(date, relative);
  const notes = el('p', 'popover-notes');
  const statusLabelEl = el('label', 'popover-status-label', 'Status');
  statusLabelEl.htmlFor = 'detail-status';
  const select = el('select', 'popover-status');
  select.id = 'detail-status';
  for (const value of STATUS_VALUES) {
    const option = el('option', undefined, STATUS_LABELS[value]);
    option.value = value;
    select.append(option);
  }
  root.append(closeButton, title, meta, notes, statusLabelEl, select);
  document.body.append(root);
  detail = {
    root,
    title,
    date,
    relative,
    notes,
    select,
    milestone: null,
    controller: bindPopover(root, closeButton),
  };
  select.addEventListener('change', () => onStatusChange(detail));
  return detail;
}

let statusHandler = null;

async function onStatusChange(d) {
  const previous = d.milestone.status;
  const wanted = d.select.value;
  if (wanted === previous || !statusHandler) return;
  d.select.disabled = true;
  let updated;
  try {
    updated = await statusHandler(d.milestone.id, wanted);
  } catch {
    updated = null;
  }
  // On failure the caller showed the error; the previous status stays displayed.
  if (!updated) d.select.value = d.milestone.status;
  d.select.disabled = false;
  if (d.controller.isOpen() && !d.root.contains(document.activeElement)) d.select.focus();
}

function fillDetail(d, milestone, today) {
  d.milestone = milestone;
  d.title.textContent = milestone.title;
  d.date.textContent = milestone.targetDate;
  d.relative.textContent = relativeLabel(milestone.targetDate, today);
  d.relative.classList.toggle('is-overdue', isOverdue(milestone.targetDate, today));
  const hasNotes = typeof milestone.notes === 'string' && milestone.notes !== '';
  d.notes.textContent = hasNotes ? milestone.notes : '';
  d.notes.hidden = !hasNotes;
  d.select.value = STATUS_VALUES.includes(milestone.status) ? milestone.status : 'todo';
}

function showDetail(milestone, today, trigger) {
  const d = getDetailPopover();
  if (d.controller.isOpenFor(trigger)) {
    d.controller.close();
    return;
  }
  fillDetail(d, milestone, today);
  d.controller.open(trigger);
}

// ---- Path rendering ----

function buildPath(width, gap) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'roadmap-wave');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(TRACK_HEIGHT));
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', wavePath(width, gap));
  path.setAttribute('fill', 'none');
  svg.append(path);
  return svg;
}

function placeNode(button, x, gap, i) {
  button.style.left = `${x}px`;
  button.style.top = `${waveY(x, gap)}px`;
  button.style.setProperty('--i', String(i));
}

function buildMilestoneNode(milestone, i, gap, today) {
  const rel = relativeLabel(milestone.targetDate, today);
  const short = formatShortDate(milestone.targetDate);
  const overdue = isOverdue(milestone.targetDate, today);
  const button = el('button', `node-btn${overdue ? ' is-overdue' : ''}`);
  button.type = 'button';
  button.setAttribute('aria-label', `${milestone.title}, ${short}, ${rel}, ${statusLabel(milestone.status)}`);
  placeNode(button, nodeX(i, gap), gap, i);

  const label = el('span', `node-label ${labelSide(i)}`);
  label.setAttribute('aria-hidden', 'true');
  // The status sits on the relative line: a 4th line would crowd the neighbouring labels.
  const relLine = el('span', 'node-rel', rel);
  relLine.append(el('span', 'node-status', ` · ${statusLabel(milestone.status)}`));
  label.append(
    el('span', 'node-date', short),
    el('span', 'node-title', milestone.title),
    relLine,
  );
  button.append(el('span', `node-shape ${statusClass(milestone.status)}`), label);
  return button;
}

function buildAddNode(count, gap, handlers) {
  const button = el('button', 'node-btn add-node');
  button.type = 'button';
  button.setAttribute('aria-label', 'Add a milestone');
  placeNode(button, nodeX(count, gap), gap, count);
  button.append(el('span', 'node-shape', '+'));
  if (count === 0) button.append(el('span', 'start-label', 'Start your path'));
  button.addEventListener('click', () => handlers.onAdd(button));
  return button;
}

function buildTodayMarker(index, gap) {
  const marker = el('div', 'today-marker');
  marker.setAttribute('aria-hidden', 'true');
  marker.style.left = `${todayX(index, gap)}px`;
  marker.append(el('span', 'today-label', 'TODAY'));
  return marker;
}

export function renderRoadmap(container, milestones, today, handlers) {
  statusHandler = handlers.onStatus ?? null;
  // An open detail popover survives a redraw (e.g. after a status change).
  const openId = detail?.controller.isOpen() ? detail.milestone?.id : null;
  container.replaceChildren();
  const visible = container.clientWidth;
  const count = milestones.length;
  const gap = computeGap(visible, count);
  const width = trackWidth(visible, count, gap);

  const track = el('div', 'roadmap-track');
  track.style.width = `${width}px`;
  track.style.height = `${TRACK_HEIGHT}px`;
  track.style.setProperty('--gap', `${gap}px`);
  track.style.setProperty('--mid', `${MID}px`);
  track.append(buildPath(width, gap));

  const index = todayIndex(milestones, today);
  if (count > 0) track.append(buildTodayMarker(index, gap));
  let reopened = false;
  milestones.forEach((m, i) => {
    const node = buildMilestoneNode(m, i, gap, today);
    node.addEventListener('click', () => showDetail(m, today, node));
    track.append(node);
    if (m.id === openId) {
      fillDetail(detail, m, today);
      detail.controller.setTrigger(node);
      reopened = true;
    }
  });
  track.append(buildAddNode(count, gap, handlers));
  container.append(track);
  if (openId !== null && openId !== undefined && !reopened) detail.controller.close({ restoreFocus: false });

  container.scrollLeft = initialScrollLeft(todayX(index, gap), visible, width);
}
