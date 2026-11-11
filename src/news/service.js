import { UpstreamError } from './errors.js';
import { requestUpstream } from './http.js';
import { createTtlCache } from './cache.js';
import { createSpacer } from './rate-limit.js';
import { buildArxivUrl, parseArxivFeed } from './arxiv.js';
import { buildOpenAlexUrl, parseTopics, searchTerm } from './openalex.js';

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ARXIV_MESSAGES = {
  timeoutMessage: 'arXiv did not answer in time. Please try again later.',
  failMessage: 'Could not load papers from arXiv. Please try again later.',
};
const OPENALEX_MESSAGES = {
  timeoutMessage: 'OpenAlex did not answer in time. Please try again later.',
  failMessage: 'Could not load topics from OpenAlex. Please try again later.',
};

// Without an injected fetch (tests) nothing may reach the real network.
const rejectingFetch = () => Promise.reject(new Error('No fetch available'));

function cacheKey(kind, { categories, terms }) {
  return `${kind}|${categories.join(',')}|${terms.join(',')}`;
}

function parseOrFail(parse, text, failMessage) {
  try {
    return parse(text);
  } catch {
    throw new UpstreamError(failMessage);
  }
}

export function createNewsService({
  fetch = rejectingFetch,
  now,
  wait,
  mailto,
  ttlMs = DEFAULT_TTL_MS,
}) {
  const doFetch = fetch;
  const cache = createTtlCache({ now, ttlMs });
  const spacer = createSpacer({ now, wait });
  // Identical concurrent misses share one upstream request.
  const inFlight = new Map();

  function shared(key, load) {
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = load()
      .then((value) => {
        cache.set(key, value);
        return value;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  }

  function getPapers(query) {
    return shared(cacheKey('papers', query), () => {
      const url = buildArxivUrl(query);
      return spacer.schedule(async () => {
        const xml = await requestUpstream(doFetch, url, {
          ...ARXIV_MESSAGES,
          accept: 'application/atom+xml',
        });
        return parseOrFail(parseArxivFeed, xml, ARXIV_MESSAGES.failMessage);
      });
    });
  }

  function getTopics(query) {
    return shared(cacheKey('topics', query), async () => {
      const fromDate = new Date(now().getTime() - 365 * DAY_MS).toISOString().slice(0, 10);
      const url = buildOpenAlexUrl({ search: searchTerm(query), fromDate, mailto });
      const json = await requestUpstream(doFetch, url, {
        ...OPENALEX_MESSAGES,
        accept: 'application/json',
      });
      return parseOrFail(parseTopics, json, OPENALEX_MESSAGES.failMessage);
    });
  }

  return { getPapers, getTopics };
}
