# M05 — US-02: Milestone status and overall progress

| | |
|---|---|
| **Goal** | The student updates each milestone's status and sees their overall progress. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `feature/milestone-status-progress` |
| **Depends on** | M04 |
| **Status** | done |

## Context

[US-02](../mvp-scope.md#2-user-stories): *As a PhD student, I want to update each milestone's
status (to do, in progress, done, blocked) and see my overall progress, so that my roadmap
shows where I really stand.* Agents: `backend-dev`, `frontend-dev` (in parallel), `test-writer`.

## Acceptance criteria

- [x] `PATCH /api/milestones/:id/status` with `{ "status": "<value>" }`, value in `todo`, `doing`, `done`, `blocked`, returns `200` with the updated milestone.
- [x] An unknown status returns `400` with a message listing the allowed values; an unknown or non-numeric id returns `404` `{ "error": "Milestone not found" }`; invalid JSON returns `400`.
- [x] `GET /api/progress` returns `200` with `{ total, done, percent, byStatus: { todo, doing, done, blocked } }`; `percent` is `done / total * 100` rounded to the nearest integer, and `0` when there are no milestones.
- [x] On the page, each milestone of the timeline has a status selector and a visible status badge (distinct colour per status, plus the status name in text).
- [x] The page shows a progress bar with "X of Y milestones done (Z%)" and the count per status, updated right after a status change.
- [x] A failed status update shows the API error message and keeps the previous status displayed.

## Out of scope

- Editing title, date or notes, deleting milestones, history of status changes.

## Prompt

```
/mission docs/missions/M05-milestone-status-progress.md
```

## How to verify (you)

1. With 4 milestones, set one to "done": the bar shows "1 of 4 milestones done (25%)".
2. Set another to "blocked" and one to "doing": badges and counts per status update without reload.
3. Reload the page: statuses and progress are unchanged.

## Result (filled by the agent)

- Files changed:
  - `src/validation/milestones.js`: `validateStatus`, `STATUSES`.
  - `src/db/milestones.js`: `updateMilestoneStatus`, `countMilestonesByStatus`.
  - `src/routes/milestones.js`: `PATCH /api/milestones/:id/status`.
  - `src/routes/progress.js` (new): `GET /api/progress`.
  - `src/app.js`: mounts the progress router.
  - `public/status.js` (new): status labels.
  - `public/roadmap.js`: status shape class and status name on each node; status select in the detail popover; popover stays open across redraw.
  - `public/app.js`: PATCH and progress fetch; error shown and scrolled into view; stale progress responses ignored.
  - `public/index.html`: Progress card and "Progress" nav link.
  - `public/styles.css`: status shapes, progress bar, select.
  - Existing tests changed, with user approval, because the requirement changed: `tests/ui-design.test.js` (Progress nav link now expected, no Upcoming link; check-mark glyph test) and `tests/roadmap.dom.test.js` (fetch mock answers per URL).
- Tests added:
  - `tests/milestone-status.test.js`: 25 tests.
  - `tests/progress.test.js`: 7 tests.
  - `tests/status-progress.dom.test.js`: 15 tests.
- Lint / tests / build: `npm run lint` clean; `npm test`: 13 files, 212 tests passed. Docker build not run locally. Not yet checked in a browser.
- Pull request: [#8](https://github.com/Pluto2k2/ResearchPath/pull/8)
- Decisions:
  - The status selector lives in the node detail popover (user decision).
  - The status name is folded into the node's relative line ("in 19 days · Done") to avoid label clipping.
- Review (`code-reviewer`):
  - Must fix, fixed and covered by tests: corrupted check-mark glyph in `public/styles.css`.
  - Should fix, fixed and covered by tests: the error was not visible when scrolled; stale progress responses could overwrite newer ones.

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
