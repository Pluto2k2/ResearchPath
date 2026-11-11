# M02 — Bootstrap the project skeleton

| | |
|---|---|
| **Goal** | An empty but working app runs in the DevContainer and in Docker: health endpoint, static page, lint and one passing test. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `chore/bootstrap-skeleton` |
| **Depends on** | M01 |
| **Status** | todo |

## Context

Every feature mission builds on the same structure (see "Planned architecture" in
`CLAUDE.md`). This mission creates it once, with the test helpers the later missions rely on.
Agents: `devops-engineer` (config, Docker, DevContainer), `backend-dev` (`src/`),
`frontend-dev` (`public/`), `test-writer` (`tests/`).

## Acceptance criteria

- [ ] `package.json`: `"type": "module"`, `engines.node` `>=22.13`, scripts `start`, `dev` (`node --watch`), `test` (`vitest run`), `lint` (`eslint .`); dependencies Express 5, dev dependencies Vitest, Supertest, ESLint. `package-lock.json` committed.
- [ ] `src/config.js` reads `PORT`, `DB_PATH`, `NODE_ENV` with the defaults from `CLAUDE.md`; it is the only file that reads `process.env`.
- [ ] `src/db/index.js` exports `openDatabase(path)` using `node:sqlite` (creates the parent folder of a file path; `:memory:` works).
- [ ] `src/app.js` exports `createApp({ db, now })` (`now()` returns a `Date`); `src/server.js` starts it on `PORT` with `now = () => new Date()`.
- [ ] `GET /api/health` returns `200` with `{ "status": "ok" }`.
- [ ] Unknown `/api/*` route returns `404` with `{ "error": "Not found" }`; a body with invalid JSON returns `400` with `{ "error": "Invalid JSON" }`; unexpected errors return `500` with `{ "error": "Internal server error" }` (no stack trace).
- [ ] `public/index.html`, `app.js`, `styles.css` are served at `/`: page title "ResearchPath", a header and an empty responsive layout (usable at 360 px wide).
- [ ] `tests/helpers.js` exports `TODAY = '2026-11-12'` and a function that returns a Supertest-ready app with a fresh in-memory database and `now()` frozen to `TODAY`.
- [ ] Tests cover health, unknown route and invalid JSON; `npm run lint` and `npm test` pass.
- [ ] `.gitignore` (`node_modules/`, `.env`, `data/`, coverage), `.env.example` with every variable.
- [ ] `Dockerfile` multi-stage (`dev` stage, `prod` last stage: `npm ci --omit=dev`, non-root user, `HEALTHCHECK` on `/api/health`), `.dockerignore`, `docker-compose.yml` with an `app` service (bind mount for development).
- [ ] `.devcontainer/devcontainer.json` (Node 22, ESLint extension, port 3000 forwarded, `npm install` after create).

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
- Tests added:
- Lint / tests / build:
- Pull request:

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
