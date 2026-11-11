# M04 — US-01: Research roadmap with milestones

| | |
|---|---|
| **Goal** | The student adds milestones and sees their research laid out as a roadmap, in date order. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `feature/roadmap-milestones` |
| **Depends on** | M03 |
| **Status** | done |

## Context

[US-01](../mvp-scope.md#2-user-stories): *As a PhD student, I want to build my research
roadmap with milestones (title, target date, notes), so that I see my whole path at a glance.*
This is the minimum moment of value of the MVP. Agents: `backend-dev`, `frontend-dev`
(in parallel once the contract is fixed), `test-writer`.

## Acceptance criteria

- [x] A `milestones` table is created at startup (columns from "Data" in `CLAUDE.md`).
- [x] `POST /api/milestones` with `title` (required, trimmed, max 120 chars), `targetDate` (required, real `YYYY-MM-DD` date) and optional `notes` (trimmed, max 2000 chars) returns `201` with the created milestone `{ id, title, targetDate, notes, status: "todo", createdAt }`.
- [x] Missing or invalid fields return `400` with a clear message naming the field; invalid JSON returns `400` `{ "error": "Invalid JSON" }`.
- [x] `GET /api/milestones` returns `200` with the list, earliest `targetDate` first (ties: oldest created first); an empty roadmap returns `[]`.
- [x] The page shows the roadmap as a vertical timeline: title, date, "N days left" / "today" / "N days overdue" (computed from the browser's date), and notes.
- [x] The page has a form (title, target date, notes) that adds a milestone without reloading, and shows the API error message when the input is rejected.
- [x] HTML in a title or notes is displayed as text, not interpreted.

## Out of scope

- Editing or deleting milestones, statuses and progress (M05), events and the 30-day view (M06).

## Prompt

```
/mission docs/missions/M04-roadmap-milestones.md
```

## How to verify (you)

1. Run the app, add three milestones with dates out of order: the timeline shows them by date with the right "days left" / "overdue" label.
2. Submit the form with an empty title, then with a date like 2026-02-30: an error message shows and nothing is added.
3. Add a milestone titled `<b>test</b>`: the tags are shown as text. Reload the page: the milestones are still there.

## Result (filled by the agent)

- Files changed:
  - `src/db/index.js` (modified): `milestones` table, created with `CREATE TABLE IF NOT EXISTS`.
  - `src/db/milestones.js` (new): `createMilestone`, `listMilestones`.
  - `src/validation/milestones.js` (new): `validateMilestone`.
  - `src/routes/milestones.js` (new): `GET /api/milestones` and `POST /api/milestones`.
  - `src/app.js` (modified): mounts the milestones router.
  - `public/dates.js` (new): `localToday`, `daysLabel`.
  - `public/index.html` (modified): form and timeline.
  - `public/app.js` (modified): fetch, rendering with `textContent`, form submit, error display, submit button disabled while the request runs.
  - `public/styles.css` (modified): vertical timeline, phone first.
- Tests added: `tests/milestones.test.js` and `tests/milestones-page.test.js`, 51 new tests, one `describe` per acceptance criterion (AC1 to AC7).
  - Known gap: there are no DOM tests (jsdom was not added, by decision). Timeline rendering, add-without-reload and error display are covered by static checks (HTML ids, no `innerHTML`) and by the manual steps in "How to verify (you)".
- Lint / tests / build:
  - Locally: `npm run lint` is clean. `npm test` runs 7 files, 65 of 65 tests passing.
  - Docker build: not run locally. CI runs it (`docker-build` job).
- Pull request: [#5](https://github.com/Pluto2k2/ResearchPath/pull/5)

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
