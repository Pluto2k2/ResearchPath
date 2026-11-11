import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const ARXIV_ENDPOINT = 'https://export.arxiv.org/api/query';
const MAX_PAPERS = 20;
const MAX_SUMMARY = 300;
const ARRAY_TAGS = ['entry', 'author', 'link', 'category'];

export function buildArxivUrl({ categories, terms }) {
  const parts = [];
  if (categories.length > 0) {
    parts.push(`(${categories.map((c) => `cat:${c}`).join(' OR ')})`);
  }
  if (terms.length > 0) {
    // Quotes are stripped so a keyword cannot break out of its phrase.
    parts.push(`(${terms.map((t) => `all:"${t.replaceAll('"', '')}"`).join(' OR ')})`);
  }
  const params = new URLSearchParams({
    search_query: parts.join(' AND '),
    start: '0',
    max_results: String(MAX_PAPERS),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
  });
  return `${ARXIV_ENDPOINT}?${params}`;
}

// Built once: the options never change. Entities (&amp;) must be decoded, so it is explicit.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  processEntities: true,
  isArray: (name) => ARRAY_TAGS.includes(name),
});

function collapse(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

export function trimSummary(text) {
  const clean = collapse(text);
  if (clean.length <= MAX_SUMMARY) return clean;
  return `${clean.slice(0, MAX_SUMMARY - 1).trimEnd()}…`;
}

function toPaper(entry) {
  const rawId = typeof entry?.id === 'string' ? entry.id : '';
  const marker = rawId.indexOf('/abs/');
  const id = marker === -1 ? '' : rawId.slice(marker + 5).trim();
  const title = collapse(entry?.title);
  const published = typeof entry?.published === 'string' ? entry.published.slice(0, 10) : '';
  if (!/^[\w./-]+$/.test(id) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(published)) return null;

  const authors = (entry.author ?? [])
    .map((a) => collapse(a?.name))
    .filter((name) => name !== '');
  const categories = entry.category ?? [];
  const category = entry.primary_category?.['@_term'] ?? categories[0]?.['@_term'] ?? '';

  return {
    id,
    title,
    authors,
    summary: trimSummary(entry.summary),
    published,
    category: typeof category === 'string' ? category : '',
    url: `https://arxiv.org/abs/${id}`,
  };
}

function byPublishedDesc(a, b) {
  if (a.published === b.published) return 0;
  return a.published < b.published ? 1 : -1;
}

// Throws a plain Error when the feed is not usable; the service maps it to a 502.
export function parseArxivFeed(xml) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid arXiv XML');
  const feed = parser.parse(xml)?.feed;
  if (!feed || typeof feed !== 'object') throw new Error('No feed element');

  const entries = feed.entry ?? [];
  // arXiv reports query errors as a feed with one entry pointing at /api/errors.
  if (entries.some((e) => typeof e?.id === 'string' && e.id.includes('/api/errors'))) {
    throw new Error('arXiv error feed');
  }
  return entries
    .map(toPaper)
    .filter((paper) => paper !== null)
    .sort(byPublishedDesc)
    .slice(0, MAX_PAPERS);
}
