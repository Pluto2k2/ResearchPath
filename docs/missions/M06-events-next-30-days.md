# M06 — US-03: Events and the next 30 days

| | |
|---|---|
| **Goal** | The student adds conferences, seminars, deadlines and funding calls, and sees everything due in the next 30 days together with their milestones. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `feature/events-next-30-days` |
| **Depends on** | M05 |
| **Status** | todo |

## Context

[US-03](../mvp-scope.md#2-user-stories): *As a PhD student, I want to add conferences,
seminars, submission deadlines and funding calls, and see everything due in the next 30 days
with my milestones, so that I never miss a date.* "Today" is derived from the injected `now()`
(see `CLAUDE.md`), so tests use the frozen `TODAY = '2026-11-12'`. Agents: `backend-dev`, `frontend-dev`
(in parallel), `test-writer`.

## Acceptance criteria

- [ ] An `events` table is created at startup (columns from "Data" in `CLAUDE.md`).
- [ ] `POST /api/events` with `title` (required, trimmed, max 120 chars), `type` (required: `conference`, `seminar`, `deadline`, `funding`), `date` (required, real `YYYY-MM-DD` date), optional `url` (must start with `http://` or `https://`, max 500 chars) and optional `notes` (max 2000 chars) returns `201` with the created event.
- [ ] Invalid input returns `400` with a clear message naming the field; invalid JSON returns `400`.
- [ ] `GET /api/events` returns all events, earliest date first.
- [ ] `GET /api/upcoming` returns `200` with the items whose date is between today and today + 30 days (both included), earliest first: events, and milestones that are not `done`. Milestones not `done` whose date is before today are included first, with `overdue: true`. Each item is `{ kind: "milestone" | "event", id, title, date, daysLeft, overdue, type?, status?, url? }` (`overdue` is `false` for every other item; `daysLeft` is negative when overdue).
- [ ] The page has a form to add an event, and a "Next 30 days" panel listing upcoming items with their date, days left (overdue items first and visibly flagged), and a label for the kind (milestone or event type). An event URL opens in a new tab (`rel="noopener"`).
- [ ] Adding an event or changing a milestone's status refreshes the "Next 30 days" panel without reload.

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
- Tests added:
- Lint / tests / build:
- Pull request:

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
