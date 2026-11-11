# M02 — Bootstrap the project skeleton

| | |
|---|---|
| **Goal** | An empty but working app runs in the DevContainer and in Docker: health endpoint, static page, lint and one passing test. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `chore/bootstrap-skeleton` |
| **Depends on** | M01 |
| **Status** | done |

## Context

Every feature mission builds on the same structure (see "Planned architecture" in
`CLAUDE.md`). This mission creates it once, with the test helpers the later missions rely on.
Agents: `devops-engineer` (config, Docker, DevContainer), `backend-dev` (`src/`),
`frontend-dev` (`public/`), `test-writer` (`tests/`).

## Acceptance criteria

- [x] `package.json`: `"type": "module"`, `engines.node` `>=22.13`, scripts `start`, `dev` (`node --watch`), `test` (`vitest run`), `lint` (`eslint .`); dependencies Express 5, dev dependencies Vitest, Supertest, ESLint. `package-lock.json` committed.
- [x] `src/config.js` reads `PORT`, `DB_PATH`, `NODE_ENV` with the defaults from `CLAUDE.md`; it is the only file that reads `process.env`.
- [x] `src/db/index.js` exports `openDatabase(path)` using `node:sqlite` (creates the parent folder of a file path; `:memory:` works).
- [x] `src/app.js` exports `createApp({ db, now })` (`now()` returns a `Date`); `src/server.js` starts it on `PORT` with `now = () => new Date()`.
- [x] `GET /api/health` returns `200` with `{ "status": "ok" }`.
- [x] Unknown `/api/*` route returns `404` with `{ "error": "Not found" }`; a body with invalid JSON returns `400` with `{ "error": "Invalid JSON" }`; unexpected errors return `500` with `{ "error": "Internal server error" }` (no stack trace).
- [x] `public/index.html`, `app.js`, `styles.css` are served at `/`: page title "ResearchPath", a header and an empty responsive layout (usable at 360 px wide).
- [x] `tests/helpers.js` exports `TODAY = '2026-11-12'` and a function that returns a Supertest-ready app with a fresh in-memory database and `now()` frozen to `TODAY`.
- [x] Tests cover health, unknown route and invalid JSON; `npm run lint` and `npm test` pass.
- [x] `.gitignore` (`node_modules/`, `.env`, `data/`, coverage), `.env.example` with every variable.
- [x] `Dockerfile` multi-stage (`dev` stage, `prod` last stage: `npm ci --omit=dev`, non-root user, `HEALTHCHECK` on `/api/health`), `.dockerignore`, `docker-compose.yml` with an `app` service (bind mount for development).
- [x] `.devcontainer/devcontainer.json` (Node 22, ESLint extension, port 3000 forwarded, `npm install` after create).

## Out of scope

- Any milestone or event feature, database table, or CI workflow (M03).
- Any dependency other than the ones listed above.

## Prompt

```
/mission docs/missions/M02-bootstrap-skeleton.md
```

## How to verify (you)

1. Open the folder in the DevContainer, run `npm run dev`, open http://localhost:3000: the empty ResearchPath page shows.
2. `curl http://localhost:3000/api/health` returns `{"status":"ok"}`.
3. `npm run lint && npm test` are green; `docker compose up` (or `docker build --target prod -t researchpath .` and `docker run -p 3000:3000 researchpath`) serves the same page.

## Result (filled by the agent)

- Files changed:
  - `package.json`, `package-lock.json`, `eslint.config.js`, `.gitignore`, `.env.example`
  - `Dockerfile` (stages: base, dev, deps, prod), `.dockerignore`, `docker-compose.yml`
  - `.devcontainer/devcontainer.json`
  - `src/config.js`, `src/db/index.js`, `src/app.js`, `src/server.js`, `src/routes/health.js`
  - `public/index.html`, `public/app.js`, `public/styles.css`
  - `tests/helpers.js`, `tests/health.test.js`, `tests/errors.test.js`, `tests/static.test.js`, `tests/config.test.js`, `tests/db.test.js`
- Tests added: 17 tests in 5 files
  - `health` + `TODAY` helper: 3
  - errors (404, 400, 500): 5
  - static page: 3
  - config: 4
  - db: 2
- Lint / tests / build:
  - `npm run lint`: clean
  - `npm test`: 17/17 passed
  - `docker compose config -q`: OK
  - `docker build --target prod`: OK. The container answers `/api/health` with `{"status":"ok"}`, serves `/`, and runs as user `node`.
  - Node prints a harmless ExperimentalWarning for `node:sqlite`.
  - Versions: Node 22.21.0, Express 5.3.0, Vitest 5.1.0, Supertest 7.3.2, ESLint 10.14.0, `@eslint/js` 10.0.1, `globals` 17.14.0. The last two were approved by the user as extra devDependencies for the ESLint flat config.
- Pull request: [#2](https://github.com/Pluto2k2/ResearchPath/pull/2)
- Reviewer follow-ups (not applied):
  - The error handler maps other 4xx body-parser errors (e.g. 413) to 500.
  - No `res.headersSent` guard in the error handler.
  - No SIGTERM handling and no `init: true` in Docker, so a container stop waits 10 s.
  - The HEALTHCHECK hardcodes port 3000, while Render sets `PORT`. (fixed in M07)

## Review notes (filled by you)

- What I checked: The dev and prod Docker images, `/api/health` in the browser, and the first passing tests.
- What I asked the agent to change: Move the review follow-ups (SIGTERM handling, `headersSent` guard, 4xx body-parser errors) to the backlog; they were fixed in M10.
- What was hard / what I learned: Running Docker on Windows: `docker build` needs the build context (`.`), and port 8080 was already in use, so I used 8081. `node:sqlite` prints an ExperimentalWarning, hidden in M07.
