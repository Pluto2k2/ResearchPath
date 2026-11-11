# M06 — US-03: Events and the next 30 days

| | |
|---|---|
| **Goal** | The student adds conferences, seminars, deadlines and funding calls, and sees everything due in the next 30 days together with their milestones. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `feature/events-next-30-days` |
| **Depends on** | M05 |
| **Status** | done |

## Context

[US-03](../mvp-scope.md#2-user-stories): *As a PhD student, I want to add conferences,
seminars, submission deadlines and funding calls, and see everything due in the next 30 days
with my milestones, so that I never miss a date.* "Today" is derived from the injected `now()`
(see `CLAUDE.md`), so tests use the frozen `TODAY = '2026-11-12'`. Agents: `backend-dev`, `frontend-dev`
(in parallel), `test-writer`.

## Acceptance criteria

- [x] An `events` table is created at startup (columns from "Data" in `CLAUDE.md`).
- [x] `POST /api/events` with `title` (required, trimmed, max 120 chars), `type` (required: `conference`, `seminar`, `deadline`, `funding`), `date` (required, real `YYYY-MM-DD` date), optional `url` (must start with `http://` or `https://`, max 500 chars) and optional `notes` (max 2000 chars) returns `201` with the created event.
- [x] Invalid input returns `400` with a clear message naming the field; invalid JSON returns `400`.
- [x] `GET /api/events` returns all events, earliest date first.
- [x] `GET /api/upcoming` returns `200` with the items whose date is between today and today + 30 days (both included), earliest first: events, and milestones that are not `done`. Milestones not `done` whose date is before today are included first, with `overdue: true`. Each item is `{ kind: "milestone" | "event", id, title, date, daysLeft, overdue, type?, status?, url? }` (`overdue` is `false` for every other item; `daysLeft` is negative when overdue).
- [x] The page has a form to add an event, and a "Next 30 days" panel listing upcoming items with their date, days left (overdue items first and visibly flagged), and a label for the kind (milestone or event type). An event URL opens in a new tab (`rel="noopener"`).
- [x] Adding an event or changing a milestone's status refreshes the "Next 30 days" panel without reload.

## Out of scope

- Editing or deleting events, recurring events, reminders or notifications, importing calendars (ICS).

## Prompt

```
/mission docs/missions/M06-events-next-30-days.md
```

## How to verify (you)

1. Add a conference in 10 days, a funding call in 45 days and a seminar yesterday: only the conference appears in "Next 30 days".
2. A milestone due in 5 days appears in the panel; set it to "done": it disappears. A past milestone that is not done appears first as overdue.
3. Try an event with URL `javascript:alert(1)`: it is rejected with a message.

## Result (filled by the agent)

- Files changed:
  - `src/app.js`: mounts the events and upcoming routers.
  - `src/db/index.js`: `events` table in `CREATE TABLE IF NOT EXISTS`.
  - `src/db/events.js` (new): `createEvent`, `listEvents`, `listEventsBetween`.
  - `src/db/milestones.js`: `listOpenMilestonesUntil`.
  - `src/validation/dates.js` (new): shared date helpers (`DATE_FORMAT`, `isRealDate`).
  - `src/validation/events.js` (new): `validateEvent`, `EVENT_TYPES`.
  - `src/validation/milestones.js`: imports the shared date helpers.
  - `src/routes/events.js` (new): `POST /api/events`, `GET /api/events`.
  - `src/routes/upcoming.js` (new): `GET /api/upcoming`.
  - `public/index.html`: Upcoming nav link, "Next 30 days" card, "+ Event" popover form.
  - `public/app.js`: `loadUpcoming` (latest request wins), `onEventSubmit`; the panel is refreshed after an event POST, a milestone POST and a status change.
  - `public/upcoming.js` (new): rendering of upcoming items and the label helpers.
  - `public/styles.css`: upcoming items, overdue flag, event form.
  - Existing tests changed, with user approval: `tests/ui-design.test.js` (the header test now requires the Upcoming nav link, because a link is added once its section exists); `tests/status-progress.dom.test.js` (fetch mocks answer `[]` for `/api/upcoming`; no assertion changed).
- Tests added:
  - `tests/events.test.js`: 51 tests.
  - `tests/upcoming.test.js`: 21 tests.
  - `tests/upcoming.dom.test.js`: 21 tests.
- Lint / tests / build: `npm run lint` clean; `npm test`: 16 files, 300 tests passed. [TODO: CI result after push]
- Pull request: [#9](https://github.com/Pluto2k2/ResearchPath/pull/9); released in v0.1.0 ([#10](https://github.com/Pluto2k2/ResearchPath/pull/10))
- Decisions:
  - "Today" on the server is the UTC date of the injected `now()`.
  - The URL prefix check is case-sensitive on the server: `HTTPS://` is rejected.
  - The "+ Event" button lives in the "Next 30 days" card (user decision).
  - A literal `null` JSON body returns `400` `"Invalid JSON"` (the app-wide JSON parser is strict); an array body returns `400` `"Request body must be a JSON object"`.
- Review (`code-reviewer`):
  - Must fix: none.
  - Should fix, fixed: a failed event submit now uses `showError()`, so the error box at the top of the page scrolls into view.
  - Should fix, fixed and covered by tests: validation tests added for a non-string `type` and a non-string `date`.

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
