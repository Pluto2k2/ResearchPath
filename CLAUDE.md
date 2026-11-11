# CLAUDE.md

Guidance for Claude Code (and every subagent) working in this repository.

## Project

**ResearchPath** is a web app for PhD students in their first years. It shows an interactive
roadmap of their research milestones, their overall progress, and everything due in the next
30 days: milestones plus the conferences, seminars, submission deadlines and funding calls they
add. The goal: they see where they stand and never miss a date.

- One user, no accounts in the MVP (accounts are backlog, US-07).
- Scope and user stories: [`docs/mvp-scope.md`](docs/mvp-scope.md).
- Work plan: [`docs/missions/README.md`](docs/missions/README.md).

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 (>= 22.13, so `node:sqlite` works without a flag), ES modules |
| Server | Express 5 |
| Database | SQLite through the built-in `node:sqlite` module (`DatabaseSync`), no ORM |
| Frontend | Plain HTML, CSS and JavaScript (ES modules), no framework, no build step |
| Tests | Vitest + Supertest |
| Lint | ESLint (flat config, `eslint.config.js`) |
| Dev environment | DevContainer (`.devcontainer/`) |
| Deployment | Docker image (multi-stage `Dockerfile`), deployed from `main` to Render (free plan: the disk is not persistent, see M07) |

Do not add a dependency (npm package, framework, ORM, CSS library) without asking first.

## Planned architecture

None of this exists yet. Mission M02 creates the skeleton.

```
src/
  server.js            # entry point: reads config, opens the db, calls createApp, listen()
  app.js               # createApp({ db, now }) -> Express app (no listen, used by tests)
  config.js            # the ONLY file that reads process.env
  db/
    index.js           # openDatabase(path): opens SQLite, creates tables (CREATE TABLE IF NOT EXISTS)
    milestones.js      # queries for one resource, maps snake_case rows to camelCase objects
    events.js
  validation/
    milestones.js      # pure functions: validateX(body) -> { value } or { error }
    events.js
  routes/
    health.js          # GET /api/health
    milestones.js      # Express routers: routes -> validation -> db
    events.js
public/
  index.html           # single page, served statically by Express
  app.js               # ES module: fetch wrapper, rendering, forms
  styles.css           # responsive layout (phone first)
tests/
  helpers.js           # fresh in-memory db + clock frozen to TODAY = '2026-11-12' for each test
  <feature>.test.js    # one file per user story / feature
```

Request flow: **route -> validation -> db -> JSON response**. Routes contain no SQL; db files
contain no HTTP logic; validation functions are pure and need no db.

### Data (planned)

- `milestones`: `id`, `title`, `target_date`, `notes`, `status` (`todo`, `doing`, `done`, `blocked`), `created_at`.
- `events`: `id`, `title`, `type` (`conference`, `seminar`, `deadline`, `funding`), `date`, `url`, `notes`, `created_at`.

### Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/researchpath.db` | SQLite file (`:memory:` in tests) |
| `NODE_ENV` | `development` | `production` in the Docker image |

## Conventions

### API

- All endpoints live under `/api`. JSON in, JSON out.
- JSON keys are camelCase (`targetDate`); database columns are snake_case (`target_date`). The mapping happens in `src/db/`.
- Errors always have the shape `{ "error": "<clear message for the user>" }`:
  - `400` invalid input or invalid JSON (`"Invalid JSON"`),
  - `404` unknown id or unknown `/api` route,
  - `500` unexpected error: generic message, never a stack trace or SQL in the response.
- Success codes: `201` + the created object for POST, `200` for GET/PATCH, `204` for DELETE.
- Express 5 forwards errors thrown in async handlers to the error middleware: don't wrap handlers in try/catch just to call `next(err)`.

### Validation

- One pure function per payload, returning `{ value }` (cleaned data) or `{ error }` (message).
- Strings are trimmed; a string that is empty after trimming counts as missing.
- Dates are `YYYY-MM-DD` strings and must be real calendar dates (`2026-02-30` is rejected).
- Enums (status, event type) are checked against an explicit list.
- URLs, when allowed, must start with `http://` or `https://` (blocks `javascript:` links).

### Database

- Prepared statements with `?` placeholders only. Never build SQL with string concatenation or template literals containing user input.
- Schema is created in `src/db/index.js` with `CREATE TABLE IF NOT EXISTS`; no migration tool in the MVP.

### Dates and "today"

- `createApp({ db, now })` receives `now`, a function returning the current time as a `Date` (`() => new Date()` in `src/server.js`).
- Routes never call `new Date()` to get the current time: they call the injected `now()` and derive today's `YYYY-MM-DD` from it.
- Tests freeze the clock with `TODAY = '2026-11-12'` from `tests/helpers.js`, so date-based tests never depend on the day they run.

### Frontend

- Render user data with `textContent` (or `createElement`), never `innerHTML` with user data (XSS).
- Show the API's error message to the user when a request fails.
- The page must stay usable on a phone.

### Tests and quality

- Every acceptance criterion has at least one test: normal case, edge cases, error cases.
- Before any commit: `npm run lint` and `npm test` are green (or `docker compose run --rm app npm run lint` / `npm test` outside the DevContainer).
- Never edit or delete a test just to make it pass.

### Style

- ES modules (`import`/`export`), `const` by default, small functions, named exports.
- File names in kebab-case; no TypeScript.
- Comments explain *why*, not *what*.

## Working rules

1. **Plan first.** Explain the plan and the files you will touch, then wait for approval before writing code. One mission at a time.
2. **Git workflow.**
   - `main` is production; `develop` is integration.
   - Each feature goes in a `feature/<name>` branch created from `develop` (other work uses the matching type: `fix/<name>`, `docs/<name>`, `chore/<name>`, `ci/<name>`, `test/<name>`).
   - A branch reaches `develop` only through a pull request with green CI. `develop` reaches `main` through a release pull request.
   - Never commit directly to `main` or `develop`. Never force-push.
3. **Commits** use [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`. Example: `feat(milestones): add POST /api/milestones`.
4. **Environments.** Development happens in the DevContainer; the app is deployed as a Docker image.
5. **No secrets in the code.** Settings come from environment variables read in `src/config.js`. `.env` is in `.gitignore`; `.env.example` is versioned and lists every variable with a safe default. CI and deployment secrets live in GitHub / Render secrets.
6. **Stay in scope.** Implement only the mission's acceptance criteria. Ideas go in the backlog, not in the code.
7. **Ask before** committing, pushing, merging, or adding a dependency.

## Agent team

The team lives in `.claude/agents/`. The `/mission <mission-file>` skill
(`.claude/skills/mission/SKILL.md`) is the orchestrator: the main Claude Code session
coordinates the agents and talks to the user, and it does not write application code itself.

| Agent | Model | Owns (may edit) | Job |
|---|---|---|---|
| `mission-planner` | inherit | nothing (read-only) | Turns a mission file into a plan, an exact API contract (paths, bodies, status codes, error messages), a file-ownership split, the parallelism and a test list. Runs first. |
| `backend-dev` | sonnet | `src/**` | Implements the Express routes, validation and SQLite queries against the contract, then runs lint and the whole suite. |
| `frontend-dev` | sonnet | `public/**` | Implements the page (HTML/CSS/JS, no framework) against the contract, using `textContent` only, then runs lint. |
| `test-writer` | sonnet | `tests/**` | Writes Vitest + Supertest tests from the acceptance criteria (one `describe` per user story, frozen `TODAY`), runs lint and the whole suite, reports failures without fixing them. |
| `code-reviewer` | inherit | nothing (read-only) | Reviews `git diff develop...HEAD` for bugs, security issues, CLAUDE.md compliance and test coverage. Returns Must fix / Should fix / Nice to have / What's good. |
| `docs-writer` | haiku | `README.md`, `docs/**` | Fills each mission's Result section, updates the missions index and the README. Writes only facts; leaves `[TODO: ...]` for the user's own experience. |
| `devops-engineer` | sonnet | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.devcontainer/**`, `.github/**`, `.env.example`, `package.json`, `package-lock.json`, `eslint.config.js`, `vitest.config.js`, `.gitignore` | Docker, DevContainer, CI/CD and project configuration, including dependencies. Used only for infrastructure missions (M02, M03, M07) and with the user's approval. |

### Orchestration rules

1. **Order:** plan (`mission-planner`) -> user approval -> build (`backend-dev`, `frontend-dev`, `devops-engineer` as needed) -> test (`test-writer`) -> review (`code-reviewer`) -> document (`docs-writer`) -> hand back to the user.
2. **The user approves the plan** before any agent writes code.
3. **Parallel when safe:** backend and frontend run at the same time once the API contract is fixed, because they never share files.
4. **Two agents never edit the same file.** An agent that needs a change outside its files says so in its report; the orchestrator sends it to the owner.
   A new dependency is requested from the orchestrator, approved by the user, and added by `devops-engineer` (owner of `package.json`).
5. **Subagents don't see the conversation.** Each delegation restates the mission goal, the acceptance criteria, the API contract, the files the agent owns, and "only touch your files and add nothing outside the criteria".
6. **Failures go to the owner:** a failing test is sent to the agent that owns the failing file, then the whole suite runs again. After 2 failed rounds, stop and report to the user.
7. **Every "must fix"** from the reviewer goes back to the owning agent before handing back.
8. **The user decides** on commits, pushes and merges. The orchestrator proposes Conventional Commits messages and waits for a yes.

### Other tools

- `/pre-push-review`: review of the pending changes before a push.
- `scripts/ai-review.sh [base]`: headless review of the branch with `code-reviewer`.
- `scripts/new-worktree.sh <branch> [port]`: a git worktree per mission, with its own `.env` and port, to run two missions side by side.
