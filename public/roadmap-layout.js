// Pure layout maths for the wavy roadmap (no DOM, so it can be unit-tested in node). Units: px.

export const PAD = 24;
export const MIN_GAP = 110;
export const MAX_GAP = 190;
export const MID = 150;
export const AMP = 45;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The "+" node is the last slot, hence count + 1.
export function computeGap(visibleWidth, count) {
  const slots = count + 1;
  return clamp((visibleWidth - 2 * PAD) / slots, MIN_GAP, MAX_GAP);
}

export function nodeX(i, gap) {
  return PAD + gap / 2 + i * gap;
}

export function trackWidth(visibleWidth, count, gap) {
  return Math.max(visibleWidth, 2 * PAD + (count + 1) * gap);
}

// Cosine anchored on the first node: crests on even slots, troughs on odd slots.
export function waveY(x, gap) {
  return MID - AMP * Math.cos((Math.PI * (x - nodeX(0, gap))) / gap);
}

export function wavePath(width, gap) {
  const step = 4;
  const points = [];
  for (let x = 0; x < width; x += step) points.push(`L ${x} ${waveY(x, gap).toFixed(2)}`);
  points.push(`L ${width} ${waveY(width, gap).toFixed(2)}`);
  points[0] = `M 0 ${waveY(0, gap).toFixed(2)}`;
  return points.join(' ');
}

export function labelSide(i) {
  return i % 2 === 0 ? 'above' : 'below';
}

// Date strings are YYYY-MM-DD, so a plain string compare is a date compare.
export function todayIndex(milestones, today) {
  const index = milestones.findIndex((m) => m.targetDate >= today);
  return index === -1 ? milestones.length : index;
}

export function todayX(index, gap) {
  return nodeX(index, gap) - gap / 2;
}

export function initialScrollLeft(todayXValue, visibleWidth, width) {
  if (width <= visibleWidth) return 0;
  return clamp(todayXValue - visibleWidth / 2, 0, width - visibleWidth);
}
