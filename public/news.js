import { routeFromHash } from './router.js';
import {
  PRESET_CATEGORIES,
  addKeyword,
  loadInterests,
  removeKeyword,
  saveInterests,
  toggleCategory,
} from './interests.js';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const NETWORK_ERROR = 'Network error. Check your connection and try again.';
const DEBOUNCE_MS = 400;

export function buildNewsQuery(interests) {
  const params = new URLSearchParams();
  if (interests.categories.length) params.set('categories', interests.categories.join(','));
  if (interests.keywords.length) params.set('q', interests.keywords.join(','));
  return params.toString();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderPapers(list, papers) {
  list.replaceChildren();
  if (papers.length === 0) {
    list.append(el('li', 'news-none', 'No recent papers found.'));
    return;
  }
  for (const paper of papers) {
    const item = el('li', 'paper');
    const heading = el('h3', 'paper-title');
    if (typeof paper.url === 'string' && /^https:\/\//.test(paper.url)) {
      const a = el('a', null, paper.title);
      a.href = paper.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      heading.append(a);
    } else {
      heading.textContent = paper.title;
    }
    const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : '';
    const meta = el('p', 'paper-meta');
    meta.append(el('span', 'paper-date', paper.published), ' ', el('span', 'paper-category', paper.category));
    item.append(heading, meta, el('p', 'paper-authors', authors), el('p', 'paper-summary', paper.summary));
    list.append(item);
  }
}

export function renderTopics(list, topics) {
  list.replaceChildren();
  if (topics.length === 0) {
    list.append(el('li', 'news-none', 'No hot topics found.'));
    return;
  }
  for (const topic of topics) {
    const item = el('li', 'topic');
    item.append(el('span', 'topic-name', topic.name), el('span', 'topic-count', String(topic.count)));
    list.append(item);
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : GENERIC_ERROR);
    if (!Array.isArray(body)) throw new Error(GENERIC_ERROR);
    return body;
  } catch (err) {
    if (err instanceof TypeError) throw new Error(NETWORK_ERROR, { cause: err });
    throw err;
  }
}

export function initNews() {
  const root = document.querySelector('#view-news');
  if (!root) return { activate() {} };
  const chips = document.querySelector('#category-chips');
  const form = document.querySelector('#keyword-form');
  const input = document.querySelector('#keyword-input');
  const keywordList = document.querySelector('#keyword-list');
  const errorBox = document.querySelector('#news-error');
  const emptyBox = document.querySelector('#news-empty');
  const loading = document.querySelector('#news-loading');
  const papersSection = document.querySelector('#papers-section');
  const papersList = document.querySelector('#papers-list');
  const topicsSection = document.querySelector('#topics-section');
  const topicsList = document.querySelector('#topics-list');

  let interests = loadInterests();
  let request = 0;
  let timer = null;

  function renderInterests() {
    chips.replaceChildren();
    for (const category of PRESET_CATEGORIES) {
      const chip = el('button', 'chip', category);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(interests.categories.includes(category)));
      chip.addEventListener('click', () => change(toggleCategory(interests, category)));
      chips.append(chip);
    }
    keywordList.replaceChildren();
    for (const keyword of interests.keywords) {
      const item = el('li', 'keyword');
      const remove = el('button', 'keyword-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove keyword ${keyword}`);
      remove.addEventListener('click', () => change(removeKeyword(interests, keyword)));
      item.append(el('span', 'keyword-text', keyword), remove);
      keywordList.append(item);
    }
  }

  function hasInterests() {
    return interests.categories.length > 0 || interests.keywords.length > 0;
  }

  function showEmpty() {
    const any = hasInterests();
    emptyBox.hidden = any;
    papersSection.hidden = !any;
    topicsSection.hidden = !any;
    if (!any) loading.hidden = true;
  }

  function change(next) {
    interests = next;
    saveInterests(undefined, interests);
    renderInterests();
    showEmpty();
    request += 1; // drops any answer still on its way
    clearTimeout(timer);
    errorBox.textContent = '';
    if (hasInterests()) timer = setTimeout(load, DEBOUNCE_MS);
  }

  function show(list, render, result) {
    if (result.status === 'fulfilled') {
      render(list, result.value);
    } else {
      list.replaceChildren(el('li', 'form-error', result.reason?.message || GENERIC_ERROR));
    }
  }

  async function load() {
    clearTimeout(timer);
    if (!hasInterests() || routeFromHash(window.location.hash) !== 'news') return;
    const mine = ++request;
    const query = buildNewsQuery(interests);
    loading.hidden = false;
    errorBox.textContent = '';
    const [papers, topics] = await Promise.allSettled([
      fetchJson(`/api/news/papers?${query}`),
      fetchJson(`/api/news/topics?${query}`),
    ]);
    if (mine !== request) return;
    loading.hidden = true;
    show(papersList, renderPapers, papers);
    show(topicsList, renderTopics, topics);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    const result = addKeyword(interests, input.value);
    if (result.error) {
      errorBox.textContent = result.error;
      return;
    }
    input.value = '';
    change(result.interests);
  });

  renderInterests();
  showEmpty();
  return { activate: load };
}
