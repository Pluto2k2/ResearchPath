export const PRESET_CATEGORIES = ['cs.AI', 'cs.LG', 'cs.SE', 'cs.CL', 'cs.CV'];
export const STORAGE_KEY = 'researchpath.interests.v1';

const MAX_KEYWORDS = 5;
const MAX_KEYWORD_LENGTH = 50;
const MAX_TOTAL_LENGTH = 100;

const empty = () => ({ categories: [], keywords: [] });

function getStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage can be blocked by the browser
  }
}

export function normaliseInterests(raw) {
  if (!raw || typeof raw !== 'object') return empty();
  const categories = Array.isArray(raw.categories)
    ? PRESET_CATEGORIES.filter((c) => raw.categories.includes(c))
    : [];
  const keywords = [];
  if (Array.isArray(raw.keywords)) {
    for (const item of raw.keywords) {
      if (typeof item !== 'string') continue;
      const k = item.trim();
      if (!k || k.length > MAX_KEYWORD_LENGTH || k.includes(',')) continue;
      if (keywords.some((x) => x.toLowerCase() === k.toLowerCase())) continue;
      if (keywords.length >= MAX_KEYWORDS) break;
      if ([...keywords, k].join(',').length > MAX_TOTAL_LENGTH) break;
      keywords.push(k);
    }
  }
  return { categories, keywords };
}

export function loadInterests(storage) {
  try {
    const store = getStorage(storage);
    const text = store?.getItem(STORAGE_KEY);
    if (!text) return empty();
    return normaliseInterests(JSON.parse(text));
  } catch {
    return empty();
  }
}

export function saveInterests(storage, interests) {
  try {
    const store = getStorage(storage);
    if (!store) return false;
    store.setItem(STORAGE_KEY, JSON.stringify(interests));
    return true;
  } catch {
    return false;
  }
}

export function toggleCategory(interests, category) {
  if (!PRESET_CATEGORIES.includes(category)) return interests;
  const has = interests.categories.includes(category);
  const next = has
    ? interests.categories.filter((c) => c !== category)
    : [...interests.categories, category];
  return { ...interests, categories: PRESET_CATEGORIES.filter((c) => next.includes(c)) };
}

export function addKeyword(interests, raw) {
  const k = String(raw ?? '').trim();
  if (!k) return { interests };
  if (k.includes(',')) return { error: 'Keywords cannot contain commas.' };
  if (k.length > MAX_KEYWORD_LENGTH) return { error: 'Keywords can be at most 50 characters.' };
  if (interests.keywords.some((x) => x.toLowerCase() === k.toLowerCase())) {
    return { error: 'This keyword is already in your list.' };
  }
  if (interests.keywords.length >= MAX_KEYWORDS) return { error: 'You can add at most 5 keywords.' };
  const keywords = [...interests.keywords, k];
  if (keywords.join(',').length > MAX_TOTAL_LENGTH) {
    return { error: 'Your keywords can use at most 100 characters in total.' };
  }
  return { interests: { ...interests, keywords } };
}

export function removeKeyword(interests, keyword) {
  return { ...interests, keywords: interests.keywords.filter((k) => k !== keyword) };
}
