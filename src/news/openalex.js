export const OPENALEX_ENDPOINT = 'https://api.openalex.org/works';
const MAX_TOPICS = 10;
const TOPIC_KEY = /^https:\/\/openalex\.org\/(T\d+)$/;

export const CATEGORY_TERMS = {
  'cs.AI': 'artificial intelligence',
  'cs.LG': 'machine learning',
  'cs.SE': 'software engineering',
  'cs.CL': 'natural language processing',
  'cs.CV': 'computer vision',
};

// A keyword replaces the category terms: it is the more specific wish.
export function searchTerm({ categories, terms }) {
  const values = terms.length > 0 ? terms : categories.map((c) => CATEGORY_TERMS[c]);
  return values.map((v) => `"${v.replaceAll('"', '')}"`).join(' OR ');
}

export function buildOpenAlexUrl({ search, fromDate, mailto }) {
  const params = new URLSearchParams({
    search,
    filter: `from_publication_date:${fromDate}`,
    group_by: 'topics.id',
  });
  if (mailto) params.set('mailto', mailto);
  return `${OPENALEX_ENDPOINT}?${params}`;
}

// Throws a plain Error when the payload is not usable; the service maps it to a 502.
export function parseTopics(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid OpenAlex JSON');
  }
  if (!Array.isArray(data?.group_by)) throw new Error('No group_by');

  return data.group_by
    .map((group) => {
      const match = typeof group?.key === 'string' ? TOPIC_KEY.exec(group.key) : null;
      const name = group?.key_display_name;
      if (!match || typeof name !== 'string' || name.trim() === '') return null;
      if (!Number.isInteger(group.count) || group.count < 0) return null;
      return { id: match[1], name: name.trim(), count: group.count };
    })
    .filter((topic) => topic !== null)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, MAX_TOPICS);
}
