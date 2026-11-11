export const NEWS_CATEGORIES = ['cs.AI', 'cs.LG', 'cs.SE', 'cs.CL', 'cs.CV'];
const MAX_KEYWORD_LENGTH = 100;

function cleanList(text, transform) {
  const items = text
    .split(',')
    .map((item) => transform(item.trim()))
    .filter((item) => item !== '');
  return [...new Set(items)].sort();
}

// Pure: takes req.query and returns { value } or { error }.
export function validateNewsQuery(query) {
  const { categories: rawCategories = '', q: rawQ = '' } = query ?? {};
  if (typeof rawCategories !== 'string' || typeof rawQ !== 'string') {
    return { error: 'categories and q must each be given once' };
  }

  const q = rawQ.trim();
  if (q.length > MAX_KEYWORD_LENGTH) {
    return { error: `Keyword must be at most ${MAX_KEYWORD_LENGTH} characters` };
  }

  const categories = cleanList(rawCategories, (c) => c);
  if (categories.some((c) => !NEWS_CATEGORIES.includes(c))) {
    return { error: `Unknown category. Allowed: ${NEWS_CATEGORIES.join(', ')}` };
  }
  const terms = cleanList(q, (t) => t.toLowerCase().replaceAll('"', '').trim());

  if (categories.length === 0 && terms.length === 0) {
    return { error: 'Pick at least one category or keyword' };
  }
  return { value: { categories, terms } };
}
