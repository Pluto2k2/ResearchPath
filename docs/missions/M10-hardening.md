# M10 — Hardening for the public site (release v0.2.1)

| | |
|---|---|
| **Goal** | The live app is safer and easier to run: `.env` is loaded, the news API cannot be abused as a proxy, CD proves the new release is live, and the known small bugs from the reviews are fixed. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `fix/hardening` |
| **Depends on** | M08, M09 (v0.2.0 released) |
| **Status** | done |

## Context

The app is public at https://researchpath.onrender.com since v0.1.0, and v0.2.0 added
`/api/news/*`, which calls arXiv and OpenAlex for anyone. The reviews of M02 to M09 left a list of
small, known issues in the backlog of [`docs/missions/README.md`](README.md). This mission fixes
the ones that matter for a public site, with no new feature and no new dependency.

Agents: `devops-engineer` (npm scripts, compose, CD workflow, version), `backend-dev` and
`frontend-dev` (in parallel), `test-writer`, `code-reviewer`, `docs-writer`.

## Acceptance criteria

### Configuration

- [x] `npm run dev` and `npm start` load `.env` when it exists, and still start when it doesn't (`node --env-file-if-exists=.env`). `docker compose` loads `.env` when it exists (`env_file` with `required: false`). Values already set in the environment win over `.env`. The Docker image's `CMD` is unchanged (production gets its settings from Render).
- [x] `src/config.js` stays the only file that reads `process.env`.

### Rate limit on the news API

- [x] Requests to `/api/news/*` are limited per client IP: at most 30 requests per minute (fixed window). Request 31 returns `429` with `{ "error": "Too many requests. Please try again in a minute." }` and a `Retry-After` header in seconds. Other `/api` routes are not limited.
- [x] The limiter uses the injected `now()` (tests use a fake clock, no sleeps), keeps its state per app instance, and drops expired windows so memory stays bounded. No new dependency.
- [x] The client IP is correct behind Render's proxy: Express `trust proxy` is set to `1` only when `NODE_ENV` is `production` (or through a config value read in `src/config.js`).

### CD proves the new release is live

- [x] `GET /api/health` returns `200` with `{ "status": "ok", "version": "<package.json version>", "commit": "<sha or null>" }`. `commit` comes from `RENDER_GIT_COMMIT` (set by Render at runtime), read only in `src/config.js`; it is `null` when unset.
- [x] The CD `deploy` job waits until `/api/health` returns the `commit` equal to `GITHUB_SHA` (same 15-minute deadline). When the live app reports `commit: null`, the job logs a warning and falls back to the current "status ok" check, so a missing variable never fails a deploy.

### Errors and shutdown

- [x] Body-parser client errors keep their status: a body over the limit returns `413` with `{ "error": "Request body is too large" }`; other 4xx errors from body-parser (bad charset, bad encoding) return their status with a clear `{ error }`; invalid JSON still returns `400` `"Invalid JSON"`. 5xx stays a generic message, never a stack trace.
- [x] The error handler does nothing more (calls `next(err)`) when the response headers are already sent.
- [x] On `SIGTERM` and `SIGINT`, `src/server.js` stops accepting connections, closes the database and exits with code 0 (forced exit after 10 s). `docker-compose.yml` sets `init: true`.

### Frontend fixes

- [x] A milestone with status `done` is never shown as overdue on the roadmap (no coral halo, no "N days overdue" style), even when its date has passed. Other statuses keep the current behaviour.
- [x] Event links in "Next 30 days" use `rel="noopener noreferrer"`, like paper links.

### Tests and release

- [x] Every criterion has a test: `.env` loading (the npm scripts contain the flag, compose has `env_file`), 429 after 30 requests and reset after a minute with a fake clock, per-IP separation, other routes not limited, health with and without commit, 413 and other body-parser 4xx, the `headersSent` guard, the done-milestone halo, the event link `rel`. Existing tests stay green; a test is changed only if this mission changes the requirement it checks (say which, and why).
- [x] `package.json` version is `0.2.1`. The `v0.2.1` tag is created only after the release pull request to `main` is merged, with the user's approval.

## Out of scope

- Aligning the server's UTC "today" with the browser's local date, and the stale "today" after midnight (they need a design decision).
- Capping the arXiv queue, a persistent cache, editing or deleting events.
- CD running lint and tests, Docker build cache, npm audit fixes for dev dependencies.
- Any new feature or dependency.

## Prompt

```
/mission docs/missions/M10-hardening.md
```

## How to verify (you)

1. Write `PORT=3001` in `.env`, run `npm run dev`: the app listens on 3001. Delete `.env`: it starts on 3000.
2. Run `for i in $(seq 1 31); do curl -s -o /dev/null -w "%{http_code}\n" "localhost:3000/api/news/topics?categories=cs.AI"; done`: the last line is `429` (the first ones call OpenAlex, so run it once only).
3. After the release, open https://researchpath.onrender.com/api/health: it shows version `0.2.1` and the commit of the merge on `main`; the CD `deploy` job says it matched that commit.

## Result (filled by the agent)

- Files changed:
  - Configuration and release: `package.json` (version `0.2.1`; `start` and `dev` use `--env-file-if-exists=.env`), `package-lock.json`, `docker-compose.yml` (`env_file` with `required: false`, `init: true`), `.env.example` (documents `RENDER_GIT_COMMIT` and `TRUST_PROXY_HOPS`), `src/config.js` (reads `RENDER_GIT_COMMIT` and `TRUST_PROXY_HOPS`).
  - Server: `src/app.js` (news rate limit before the body parser, `trust proxy`, body-parser error mapping, `headersSent` guard), `src/server.js` (`trust proxy` from config, `SIGTERM` and `SIGINT` handling), `src/routes/health.js` (`commit` in the response), `src/middleware/rate-limit.js` (new), `src/shutdown.js` (new).
  - Frontend: `public/dates.js`, `public/roadmap.js`, `public/upcoming.js`.
  - CD: `.github/workflows/cd.yml` (the `deploy` job waits for the commit).
  - Docs: `README.md`, `docs/deployment.md`, `docs/missions/README.md`, this file. `CLAUDE.md` was updated by the orchestrator.
  - Tests: `tests/helpers.js` is also modified: `createNewsTestApp` now passes `trustProxy` and `commit` through to `createApp` (existing behaviour unchanged).
- Tests added: 7 new test files: `tests/hardening-config.test.js`, `tests/rate-limit.test.js`, `tests/hardening-errors.test.js`, `tests/shutdown.test.js`, `tests/done-overdue.test.js`, `tests/done-overdue.dom.test.js`, `tests/hardening-followups.test.js`. Total: 547 tests in 30 files (482 in 23 after M09), so 65 more tests and 7 more files.
  - Existing tests changed because the requirement changed: `tests/health.test.js` (the body now has `commit`), `tests/news-ui.test.js` (version `0.2.1`), `tests/upcoming.dom.test.js` (the event link `rel` is exactly `noopener noreferrer`).
- Lint / tests / build: `npm run lint` is clean. `npm test`: 547 tests passing in 30 files. The Docker image build is not reported here; CI builds the `prod` target on the pull request.
- Review: no must fix. The should-fix items were applied: the rate limiter runs before body parsing, the proxy hop count is configurable (`TRUST_PROXY_HOPS`), the forced-exit message uses `timeoutMs`, and there is a test for undecodable URL parameters.
- Deferred to the backlog ("Deferred from the M10 review" in [`docs/missions/README.md`](README.md)): verify Render's proxy hop count after deploy; per-IPv6-address limiting; a second Ctrl+C is ignored during shutdown; an older CD run can time out after two quick merges.
- Pull request: [#17](https://github.com/Pluto2k2/ResearchPath/pull/17); release [#18](https://github.com/Pluto2k2/ResearchPath/pull/18), tag [v0.2.1](https://github.com/Pluto2k2/ResearchPath/releases/tag/v0.2.1) on `6b50605`.
- Live check: the CD run for #18 logged "Live app reports commit 6b50605…" (https://github.com/Pluto2k2/ResearchPath/actions/runs/43079171611), and `/api/health` returns version `0.2.1` with that commit, so Render sets `RENDER_GIT_COMMIT`.

## Review notes (filled by you)

- What I checked: [TODO: what you checked yourself]
- What I asked the agent to change: [TODO: changes you asked for, if any]
- What was hard / what I learned: [TODO: what was hard and what you learned]
