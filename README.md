# ResearchPath

An interactive research roadmap for PhD students: your milestones, your progress, and
everything due in the next 30 days, in one place.

> **Status:** v0.2.0 released. Milestones, status and progress, the next 30 days (v0.1.0) and the research news tab (v0.2.0, M09) are live. See [Status and next steps](#status-and-next-steps).

## What it is

A PhD student juggles a multi-year plan (literature review, experiments, papers) and a stream of
outside dates (conference deadlines, seminars, funding calls). The plan lives in their head, a
spreadsheet and their inbox, so they lose sight of where they stand and miss deadlines.

ResearchPath is a small web app for PhD students in their first years. It shows:

- their **research roadmap**: milestones on a timeline, in date order;
- their **overall progress**: the status of each milestone and how much is done;
- **the next 30 days**: milestones plus the conferences, seminars, submission deadlines and funding calls they add.

So they see where they stand and never miss a date. It is built for one person on their own
laptop or phone; accounts come later.

## Features

| # | User story | Scope | Mission |
|---|---|---|---|
| US-01 | As a PhD student, I want to build my research roadmap with milestones (title, target date, notes), so that I see my whole path at a glance. | **MVP** | [M04](docs/missions/M04-roadmap-milestones.md) |
| US-02 | As a PhD student, I want to update each milestone's status (to do, in progress, done, blocked) and see my overall progress, so that my roadmap shows where I really stand. | **MVP** | [M05](docs/missions/M05-milestone-status-progress.md) |
| US-03 | As a PhD student, I want to add conferences, seminars, submission deadlines and funding calls, and see everything due in the next 30 days with my milestones, so that I never miss a date. | **MVP** | [M06](docs/missions/M06-events-next-30-days.md) |
| US-04 | As a PhD student, I want a daily digest of new papers on my topics (from arXiv / OpenAlex), so that I keep up with my field without searching every day. | **v0.2.0** | [M09](docs/missions/M09-research-news.md) |
| US-05 | As a PhD student, I want a board of events and opportunities (funding, positions, visibility) picked by my interests, so that I find chances I would otherwise miss. | Backlog (v0.2) | — |
| US-06 | As a PhD student, I want to share a paper draft with peers I invite and be notified when they leave feedback, so that I get feedback in days, not weeks. | Backlog (v0.3, needs accounts) | — |
| US-07 | As a PhD student, I want my own account, so that my roadmap is private and available on any device. | Backlog (v0.3) | — |

**Status and progress (US-02, M05):** each milestone has a status (`todo`, `doing`, `done`, `blocked`),
set from the milestone's detail popover on the roadmap. Each node shows its status shape and name,
and the Progress section shows "X of Y milestones done (Z%)" with the count per status.

- `PATCH /api/milestones/:id/status` with `{ "status": "<value>" }` returns the updated milestone. An unknown status returns `400`, an unknown or non-numeric id returns `404`.
- `GET /api/progress` returns `{ total, done, percent, byStatus }`; `percent` is `done / total * 100`, rounded, and `0` with no milestones.

**Events and next 30 days (US-03, M06):** the Upcoming section lists the milestones not `done` dated from today to today + 30 days, and the events dated from today to today + 30 days, earliest first. Milestones not `done` that are overdue come first and are flagged. Events are added from the "+ Event" form in that card: a type (`conference`, `seminar`, `deadline` or `funding`), a date, and optionally a link and notes.

- `POST /api/events` with `{ "title", "type", "date", "url"?, "notes"? }` returns `201` with the created event. Invalid input returns `400` with a message naming the field; a `url` must start with `http://` or `https://`.
- `GET /api/events` returns all events, earliest date first.
- `GET /api/upcoming` returns the milestones not `done` dated from today to today + 30 days, the overdue milestones not `done` (listed first, `overdue: true`), and the events dated from today to today + 30 days (both ends included). Each item has `kind`, `daysLeft` and `overdue`. "Today" is the UTC date of the server clock.

**Research news (US-04, M09, v0.2.0):** a second tab, "Research news" (`#/news`), where the student
picks arXiv categories (`cs.AI`, `cs.LG`, `cs.SE`, `cs.CL`, `cs.CV`) and up to 5 keywords. Interests
are saved in the browser (`localStorage`). The tab shows the latest arXiv papers and the hot topics
from OpenAlex for the last 365 days. It is on demand, not a daily digest.

- `GET /api/news/papers?categories=cs.AI,cs.LG&q=keyword` returns up to 20 papers from the arXiv API, newest first. Requests to arXiv are spaced at least 3 seconds apart.
- `GET /api/news/topics?categories=...&q=...` returns the top 10 OpenAlex topics with their counts.
- At least one of `categories` or `q` is required. Both endpoints are cached on the server for 30 minutes. When an upstream API fails or times out, the endpoint returns `502` with a message.

Full scope: [`docs/mvp-scope.md`](docs/mvp-scope.md).

## How to run it

**Stack:** Node.js 22, Express 5, SQLite (`node:sqlite`), plain HTML/CSS/JS, Vitest + Supertest, ESLint.

**In the DevContainer (recommended):** open the folder in VS Code and choose
"Reopen in Container", then:

```bash
cp .env.example .env   # local settings, never committed
npm run dev            # http://localhost:3000
npm test               # Vitest + Supertest
npm run lint           # ESLint
```

**With Docker only:**

```bash
docker compose up                              # development
docker compose run --rm app npm test           # tests
docker build --target prod -t researchpath .   # production image
docker run -p 3000:3000 researchpath
```

**Environment variables:** `PORT` (default `3000`), `DB_PATH` (default `./data/researchpath.db`),
`NODE_ENV`, and the optional `OPENALEX_MAILTO` (an e-mail sent to OpenAlex for its "polite pool"
when the news topics are requested). See `.env.example`.

### Deployment

The app runs as a Docker image on Render's free plan. A merge to `main` publishes the image to
GitHub Container Registry and triggers a Render deploy; a `v*` tag publishes a versioned image.
Set-up steps, production settings and the release steps are in [`docs/deployment.md`](docs/deployment.md).
The free plan has no persistent disk: the live app is a demo, and its data is lost on every redeploy.

## How it was built with AI

ResearchPath is built with [Claude Code](https://claude.com/claude-code) working as a small
team of specialised subagents, under human review at every step.

- **Rules:** [`CLAUDE.md`](CLAUDE.md) holds the stack, architecture, conventions and working rules every agent follows.
- **Missions:** the work is split into small missions in [`docs/missions/`](docs/missions/README.md), each with acceptance criteria, an out-of-scope list and a manual check.
- **Agent team** (`.claude/agents/`): `mission-planner` (plan and API contract), `backend-dev` (`src/`), `frontend-dev` (`public/`), `test-writer` (`tests/`), `code-reviewer` (read-only review), `docs-writer` (docs), `devops-engineer` (Docker, DevContainer, CI/CD).
- **Workflow:** the `/mission` skill runs plan -> human approval -> build (backend and frontend in parallel) -> tests -> review -> docs -> human commit and pull request.
- **Guardrails:** `.claude/settings.json` lets agents run tests and lint freely but asks before commits, pushes and merges, and blocks force-push and reading `.env`. `/pre-push-review` and `scripts/ai-review.sh` review changes before a push; `scripts/new-worktree.sh` runs two missions side by side.

[TODO: what worked well and what didn't when building with the agent team.]

## Status and next steps

| Mission | Status |
|---|---|
| M01 Project setup (this README, CLAUDE.md, missions) | done |
| M02 Bootstrap skeleton | done |
| M03 CI pipeline | done |
| M04 US-01 Roadmap with milestones | done |
| M05 US-02 Status and progress | done |
| M06 US-03 Events and next 30 days | done |
| M07 CD and release v0.1.0 | done |
| M08 Final README | todo |
| M09 US-04 Research news tab (release v0.2.0) | done |

**Known limits:** the app will be deployed on Render's free plan, which has no persistent disk:
the SQLite data is lost on every redeploy, restart or spin-down. The live app is a demo; keep
real data on a local or Docker install until a persistent disk or accounts (v0.3) arrive.

**Releases:** [v0.1.0](https://github.com/Pluto2k2/ResearchPath/releases/tag/v0.1.0) (M04 to M07) and [v0.2.0](https://github.com/Pluto2k2/ResearchPath/releases/tag/v0.2.0) (M09). Release steps: [`docs/deployment.md`](docs/deployment.md).

**Next:** M08, the final README.
Backlog: US-05 events and opportunities board (v0.2); US-06 and US-07 (v0.3).
