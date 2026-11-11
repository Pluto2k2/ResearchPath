// Single source for the four statuses: API value -> label shown to the user.
export const STATUS_LABELS = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
};

export const STATUS_VALUES = Object.keys(STATUS_LABELS);

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? STATUS_LABELS.todo;
}

export function statusClass(status) {
  return `status-${status in STATUS_LABELS ? status : 'todo'}`;
}
