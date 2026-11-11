# M05 — US-02: Milestone status and overall progress

| | |
|---|---|
| **Goal** | The student updates each milestone's status and sees their overall progress. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `feature/milestone-status-progress` |
| **Depends on** | M04 |
| **Status** | todo |

## Context

[US-02](../mvp-scope.md#2-user-stories): *As a PhD student, I want to update each milestone's
status (to do, in progress, done, blocked) and see my overall progress, so that my roadmap
shows where I really stand.* Agents: `backend-dev`, `frontend-dev` (in parallel), `test-writer`.

## Acceptance criteria

- [ ] `PATCH /api/milestones/:id/status` with `{ "status": "<value>" }`, value in `todo`, `doing`, `done`, `blocked`, returns `200` with the updated milestone.
- [ ] An unknown status returns `400` with a message listing the allowed values; an unknown or non-numeric id returns `404` `{ "error": "Milestone not found" }`; invalid JSON returns `400`.
- [ ] `GET /api/progress` returns `200` with `{ total, done, percent, byStatus: { todo, doing, done, blocked } }`; `percent` is `done / total * 100` rounded to the nearest integer, and `0` when there are no milestones.
- [ ] On the page, each milestone of the timeline has a status selector and a visible status badge (distinct colour per status, plus the status name in text).
- [ ] The page shows a progress bar with "X of Y milestones done (Z%)" and the count per status, updated right after a status change.
- [ ] A failed status update shows the API error message and keeps the previous status displayed.

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
- Tests added:
- Lint / tests / build:
- Pull request:

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
