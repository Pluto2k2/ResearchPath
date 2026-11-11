# M09 — US-04: Research news tab (release v0.2.0)

| | |
|---|---|
| **Goal** | A second tab "Research news" where the student picks their interests and sees the latest papers and the hot topics in their field, from arXiv and OpenAlex through their official APIs. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `feature/research-news` |
| **Depends on** | M07 (v0.1.0 released) |
| **Status** | done |

## Context

[US-04](../mvp-scope.md#2-user-stories): *As a PhD student, I want a digest of new papers on
my topics (from arXiv / OpenAlex), so that I keep up with my field without searching every
day.* US-04 moves from the backlog into v0.2.0 with this mission. There are still no accounts,
so interests live in the browser (`localStorage`). Sources are official APIs only, no HTML
scraping: the [arXiv API](https://info.arxiv.org/help/api/user-manual.html) (Atom XML, max one
request every 3 seconds) and the [OpenAlex works API](https://docs.openalex.org/api-entities/works)
(JSON, "polite pool" when a `mailto` is sent).

Agents: `devops-engineer` (new dependency `fast-xml-parser`, version 0.2.0, `.env.example`),
`backend-dev` and `frontend-dev` (in parallel), `test-writer`, `code-reviewer`, `docs-writer`.
`CLAUDE.md` is updated in this mission (scope, architecture, configuration table).

## Acceptance criteria

### Navigation

- [x] The nav bar has two tabs, "Roadmap" and "Research news", with hash routing: `#/roadmap` (default, also for an empty or unknown hash) and `#/news`. The active tab is marked with `aria-current="page"`; switching tabs needs no reload and the browser back button works.
- [x] The Roadmap tab keeps working exactly as before (roadmap, progress, upcoming, add popover); existing tests stay green.

### Interests

- [x] On the news tab the student toggles chips from a preset list of arXiv categories (`cs.AI`, `cs.LG`, `cs.SE`, `cs.CL`, `cs.CV`) and adds or removes free keywords (trimmed, empty ignored, no duplicates, max 5 keywords of max 50 chars).
- [x] Interests are saved in `localStorage`; every read and write is wrapped in try/catch and the tab still works when storage is unavailable or holds invalid JSON.
- [x] With no interest selected, the tab shows an empty state asking the student to pick one, and calls no API.

### Latest papers

- [x] `GET /api/news/papers?categories=cs.AI,cs.LG&q=keyword` returns `200` with up to 20 papers from the arXiv API, newest first. Each paper is `{ id, title, authors, summary, published, category, url }`: `authors` an array of names, `summary` trimmed to max 300 chars (whitespace collapsed, ends with `…` when cut), `published` a `YYYY-MM-DD` date, `category` the primary arXiv category, `url` the `https://arxiv.org/abs/...` link.
- [x] `categories` only accepts values from the preset list; `q` is trimmed, max 100 chars. At least one of them is required. Invalid input returns `400` with a clear message.
- [x] The Atom XML is parsed with `fast-xml-parser`, not with regular expressions.
- [x] Requests to arXiv are spaced at least 3 seconds apart (queued, not dropped), and responses are cached server-side for 30 minutes per normalised query (sorted categories + lowercased keyword). The clock and the wait are injectable so tests don't sleep.

### Hot topics

- [x] `GET /api/news/topics?categories=...&q=...` returns `200` with the top 10 topics from the OpenAlex works API for works published in the last 365 days (from the injected `now()`), grouped by topic: `[{ id, name, count }]`, highest count first.
- [x] The search term is the keyword `q`, or, for categories without a keyword, a plain term per category (`cs.AI` → "artificial intelligence", `cs.LG` → "machine learning", `cs.SE` → "software engineering", `cs.CL` → "natural language processing", `cs.CV` → "computer vision"). Same validation as papers.
- [x] When `OPENALEX_MAILTO` is set, it is sent as the `mailto` parameter (polite pool). It is read only in `src/config.js`, listed in `.env.example` and in the `CLAUDE.md` configuration table.
- [x] Responses are cached server-side for 30 minutes per normalised query.

### Errors, security and tests

- [x] When an upstream API fails, times out (10 s) or returns something unparsable, the endpoint returns `502` with `{ "error": "<clear message>" }`, never a stack trace, upstream body or URL with secrets. Failures are not cached.
- [x] Upstream URLs are built with `URLSearchParams`, never by concatenating raw user input. Only `https://` links from the upstream responses reach the page.
- [x] The news tab shows a loading state, the papers (title as a link opening in a new tab with `rel="noopener noreferrer"`, authors, date, category, summary) and the hot topics with their counts, all rendered with `textContent` / `createElement`. API errors are shown with the API's message. The tab is usable on a phone and follows the UI design rules in `CLAUDE.md`.
- [x] Tests never call the real network: the fetch function is injected into `createApp` and mocked. Every criterion above has a test (normal, edge and error cases), including the 3-second spacing and the cache expiry with a fake clock.

### Release

- [x] `package.json` version is `0.2.0`. `CLAUDE.md` lists US-04 in scope, the news files in the architecture and `OPENALEX_MAILTO` in the configuration table. The tag `v0.2.0` is created only after the release pull request to `main` is merged, with the user's approval.

## Out of scope

- A daily email or push digest, accounts, saving interests server-side, more categories than the preset list.
- Scraping any HTML page, other sources than arXiv and OpenAlex, a persistent (database) cache.
- Paging, bookmarking or reading papers inside the app.

## Prompt

```
/mission docs/missions/M09-research-news.md
```

## How to verify (you)

1. `npm run dev`, open `http://localhost:3000`: the Roadmap tab works as before. Click "Research news": the URL becomes `#/news`, the back button returns to the roadmap.
2. Pick `cs.LG` and add the keyword "diffusion": up to 20 recent papers appear, newest first, with links to arxiv.org, and a list of hot topics with counts. Reload: the interests are still selected.
3. Disconnect from the network (or stop the server) and refresh the news: a clear error message appears, the roadmap tab still works.

## Result (filled by the agent)

- Files changed:
  - Configuration and wiring: `src/config.js` (reads `OPENALEX_MAILTO`), `src/app.js`, `src/server.js`.
  - Backend (new): `src/news/` with `errors.js`, `http.js`, `cache.js`, `rate-limit.js`, `arxiv.js`, `openalex.js`, `service.js`; `src/validation/news.js`; `src/routes/news.js`.
  - Frontend: `public/index.html`, `public/app.js`, `public/styles.css` (changed); `public/router.js`, `public/interests.js`, `public/news.js` (new).
  - Dependency and version: `package.json` (`fast-xml-parser` `^5.12.0`, version `0.2.0`), `package-lock.json`.
  - Configuration and rules: `.env.example` (`OPENALEX_MAILTO`), `CLAUDE.md` (scope, architecture, configuration table, 502 convention, tabs rule), updated by the orchestrator.
  - Docs: this report, `docs/missions/README.md`, `docs/mvp-scope.md`, `README.md`.
- Tests added:
  - New files: `tests/news-validation.test.js`, `tests/news-papers.test.js`, `tests/news-topics.test.js`, `tests/news-cache.test.js`, `tests/interests.test.js`, `tests/news.dom.test.js`, `tests/news-ui.test.js`.
  - `tests/helpers.js`: `createFakeClock`, `createNewsTestApp`, Atom fixtures.
  - `tests/config.test.js`: 2 new cases.
  - Upstream APIs are mocked. No test calls the real network and no test sleeps (fake clock and fake timers).
  - Cases added after the review: latest request wins; a topics `502` does not leak the upstream URL or the `mailto`.
- Lint / tests / build:
  - `npm run lint`: clean.
  - `npm test`: 23 files, 482 tests, all passing.
  - Manual smoke with the real APIs: papers `200` (20 items), topics `200` (10 items).
  - Build: not reported for this mission.
- Pull request: [#13](https://github.com/Pluto2k2/ResearchPath/pull/13); release [#14](https://github.com/Pluto2k2/ResearchPath/pull/14), tag [v0.2.0](https://github.com/Pluto2k2/ResearchPath/releases/tag/v0.2.0)
- Decisions:
  - Several keywords are sent as one comma-separated `q` with OR semantics; commas are therefore rejected inside a keyword.
  - Topics ignore the categories when a keyword is present.
  - A 400 ms debounce after each interest change.
  - On the news tab the section links and "+ Milestone" are hidden.
  - The header shows both a "Roadmap" tab and the "Roadmap" section link. The section link is kept because an existing test requires it.
- Review (`code-reviewer`):
  - Must fix (both fixed):
    1. The roadmap was drawn at width 0 when the page loaded on `#/news`. Fixed with an `onRoadmap` redraw.
    2. The DOM tests used real sleeps. Replaced by fake timers.
  - Should fix (all fixed):
    - Concurrent identical upstream requests are deduplicated.
    - The cache is bounded (500 entries; expired entries are purged).
    - Commas are rejected in keywords.
    - Open popovers are closed when switching to the news tab.
    - A pending debounced load is cancelled when leaving the news tab.
    - A keyword made only of quotes is treated as missing.
- Deferred from the review: see the M09 entry in [`docs/missions/README.md`](README.md#backlog-not-planned-as-missions-yet).

## Review notes (filled by you)

- What I checked: [TODO: what you checked by hand, e.g. the manual check steps above]
- What I asked the agent to change: [TODO: changes you asked for, if any]
- What was hard / what I learned: [TODO: what was hard or what you learned in this mission]
