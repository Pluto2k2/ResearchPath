# CLAUDE.md

Guidance for Claude Code (and every subagent) working in this repository.

## Project

**ResearchPath** is a web app for PhD students in their first years. It shows an interactive
roadmap of their research milestones, their overall progress, and everything due in the next
30 days: milestones plus the conferences, seminars, submission deadlines and funding calls they
add. The goal: they see where they stand and never miss a date. A second tab, "Research news"
(v0.2.0, US-04), shows the latest arXiv papers and the hot OpenAlex topics for the interests
they pick.

- One user, no accounts yet (accounts are backlog, US-07). News interests live in `localStorage`.
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

## Architecture

```
src/
  server.js            # entry point: reads config, opens the db, calls createApp, listen()
  app.js               # createApp({ db, now, fetch, wait, openAlexMailto }) -> Express app (no listen, used by tests)
  config.js            # the ONLY file that reads process.env
  db/
    index.js           # openDatabase(path): opens SQLite, creates tables (CREATE TABLE IF NOT EXISTS)
    milestones.js      # queries for one resource, maps snake_case rows to camelCase objects
    events.js
  validation/
    milestones.js      # pure functions: validateX(body) -> { value } or { error }
    events.js
  routes/
    health.js          # GET /api/health: { status, version, commit }
    milestones.js      # Express routers: routes -> validation -> db
    events.js
    news.js            # GET /api/news/papers, GET /api/news/topics: route -> validation -> news service
  news/
    service.js         # createNewsService: per-app 30 min cache + 3 s arXiv spacing
    arxiv.js           # arXiv API URL + Atom parsing (fast-xml-parser)
    openalex.js        # OpenAlex works API URL + group_by parsing
    cache.js, rate-limit.js, http.js, errors.js
public/
  index.html           # single page, served statically by Express
  app.js               # ES module: fetch wrapper, rendering, forms
  router.js            # hash tabs: #/roadmap (default), #/news
  interests.js         # news interests in localStorage
  news.js              # Research news tab
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
| `OPENALEX_MAILTO` | (empty) | Optional e-mail sent as `mailto` to OpenAlex (polite pool); omitted when empty |
| `TRUST_PROXY_HOPS` | `1` in production, `0` otherwise | Proxy hops in front of the app, so `req.ip` is the client IP for the news rate limit |
| `RENDER_GIT_COMMIT` | (set by Render) | Commit reported by `/api/health`; never set by hand |

`npm run dev`, `npm start` and `docker compose` load `.env` when it exists; variables already set in the environment win.

## Conventions

### API

- All endpoints live under `/api`. JSON in, JSON out.
- JSON keys are camelCase (`targetDate`); database columns are snake_case (`target_date`). The mapping happens in `src/db/`.
- Errors always have the shape `{ "error": "<clear message for the user>" }`:
  - `400` invalid input or invalid JSON (`"Invalid JSON"`),
  - `404` unknown id or unknown `/api` route,
  - `413` request body too large, `415` unsupported charset or encoding; other client errors keep their 4xx status with a fixed message (never the raw error text),
  - `429` too many requests to `/api/news/*` (30 per minute per IP), with a `Retry-After` header,
  - `500` unexpected error: generic message, never a stack trace or SQL in the response,
  - `502` an external API (arXiv, OpenAlex) failed or timed out: clear message, never the upstream URL or body.
- External APIs are called only through official APIs (no HTML scraping), with the `fetch` injected into `createApp`; tests mock it and never use the network.
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

- `createApp({ db, now, ... })` receives `now`, a function returning the current time as a `Date` (`() => new Date()` in `src/server.js`).
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

## UI design rules

These rules apply to every UI mission. M05 and M06 follow them.

### Colours and fonts

- Palette only: navy `#102542` (text, lines, borders, shadows, hero band), grey-blue `#cdd7d6` (page background), coral `#f87060` (accent).
- Cards use one lighter tint of grey-blue: `#e6ebea`.
- Coral marks: buttons, progress bar, done part of the path, TODAY marker, in-progress, blocked and overdue markers.
- Other tints are allowed only as transparency (`rgba`) of these three colours. No white, never purple or any other hue.
- Never use coral for small text on a light background (about 1.9:1). Use coral as a fill with navy text on it (about 5.5:1), or as text on navy.
- Overdue dates: bold navy text with a coral halo or marker. Error messages: navy text with a coral marker.
- Focus rings: navy on light backgrounds, `#cdd7d6` on navy.
- Pixelify Sans is used for the brand, headings, dates, numbers and buttons. The exception is the hero headline, which uses `system-ui`, bold, for readability. Pixelify Sans is self-hosted in `public/fonts/` with its OFL licence, weights 400, 600 and 700, woff2 format. No external font or font URL.
- Body text uses `system-ui`.

### Style

- Cards (popovers, Progress and Upcoming sections; not the roadmap band) have a 2px navy border, a 10px radius, a hard 4px navy offset shadow (`box-shadow: 4px 4px 0 #102542`) and a `#e6ebea` background.
- Nav bar: sticky, full width, light background (`#cdd7d6`), navy text, 2px navy bottom border.
- Left: "ResearchPath" in Pixelify Sans, left-aligned, no logo.
- Right: section links that smooth-scroll to their section (smooth scrolling off under `prefers-reduced-motion`), then a coral "+ Milestone" button with navy text that opens the add popover.
- Links are "Roadmap", "Progress", "Upcoming". A link is added only when its section exists.
- Tabs "Roadmap" and "Research news" (hash routing, `aria-current="page"` on the active one) sit after the brand. On the news tab the section links and "+ Milestone" are hidden.
- On phones the links scroll horizontally.
- Status shapes (used from M05):
  - `todo`: hollow navy square.
  - `doing` (in progress): square half-filled coral.
  - `done`: navy square with a check.
  - `blocked`: coral square with a navy "!".

### Layout

- Hero first on the page: a full-width navy band (`#102542`), centred, with generous space.
- Headline in `system-ui`, bold, `font-size: clamp(2.2rem, 6vw, 4.5rem)`: "Your PhD roadmap," in `#cdd7d6`, then "and every deadline on the way." in coral.
- Subtitle under the headline, in `system-ui`, `#cdd7d6` at 80% opacity: "Plan your milestones, track your progress, never miss a conference or funding date."
- Roadmap is a full-bleed band across the whole page width, with 2px navy borders top and bottom. It is not a card; the wavy path uses the full width.
- Progress and Upcoming go below the roadmap, in a centred container of max 1280px.

### Roadmap

- A wavy SVG path. Milestones sit on its crests and troughs, in date order.
- Labels alternate above and below the path. Each shows a short date (like "12 Nov"), the title, and "in N days", "today" or "N days overdue".
- A TODAY marker sits between past and future milestones.
- Overdue milestones get a coral halo. Their date and relative label are bold navy text with a coral underline.
- Spacing fits the band. The path scrolls horizontally when needed, starting with TODAY in view.
- Empty state: "Start your path".

### Interactions

- A "+" node at the end of the path opens a popover form to add a milestone.
- Clicking a milestone opens a popover with its details.
- Esc, an outside click or the × control closes a popover. Focus returns to the element that opened it.
- API errors are shown at the top of the page.

### Motion and accessibility

- Small pop and hover animations, disabled under `prefers-reduced-motion`.
- Visible keyboard focus with `:focus-visible`.
- Interactive nodes are real `button` elements with an `aria-label`.
- User data is rendered with `textContent` or `createElement` only.

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
- `scripts/new-worktree.sh <branch> [port]`: a git worktree per mission, with its own `.env` (`PORT=<port>`), to run two missions side by side.
