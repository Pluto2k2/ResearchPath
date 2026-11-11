# Missions

The work is split into small missions, run one at a time, in order. Each mission has its own
branch and reaches `develop` through a pull request with green CI. Run one with:

```
/mission docs/missions/<file>.md
```

New missions follow [`_template.md`](_template.md).

| # | Mission | User story | Branch | Depends on | Agents | Status |
|---|---|---|---|---|---|---|
| M01 | [Project setup: README, CLAUDE.md, missions](M01-project-setup.md) | — | `docs/project-setup` | none | orchestrator | done |
| M02 | [Bootstrap the project skeleton](M02-bootstrap-skeleton.md) | — | `chore/bootstrap-skeleton` | M01 | devops, backend, frontend, test | done |
| M03 | [CI pipeline](M03-ci-pipeline.md) | — | `ci/github-actions` | M02 | devops | done |
| M04 | [Research roadmap with milestones](M04-roadmap-milestones.md) | US-01 | `feature/roadmap-milestones` | M03 | backend, frontend, test | done |
| M04b | [Wavy roadmap UI, pixel font and palette](M04b-ui-polish.md) | US-01 | `feature/ui-polish` | M04 | frontend, test, docs, devops | done |
| M05 | [Milestone status and overall progress](M05-milestone-status-progress.md) | US-02 | `feature/milestone-status-progress` | M04 | backend, frontend, test | done |
| M06 | [Events and the next 30 days](M06-events-next-30-days.md) | US-03 | `feature/events-next-30-days` | M05 | backend, frontend, test | in review |
| M07 | [Continuous deployment and release v0.1.0](M07-cd-release.md) | — | `ci/cd-release` | M06 | devops | todo |
| M08 | [Final README](M08-final-readme.md) | — | `docs/final-readme` | M07 | docs | todo |

Every mission also goes through `mission-planner`, `code-reviewer` and `docs-writer`
(see "Agent team" in [`CLAUDE.md`](../../CLAUDE.md)).

## Backlog (not planned as missions yet)

US-04 daily paper digest, US-05 events and opportunities board (v0.2); US-06 draft sharing
with peers, US-07 accounts (v0.3). See [`docs/mvp-scope.md`](../mvp-scope.md).

Body-parser `entity.too.large` returns 500 instead of 413 (found in M04 review).

npm audit: 4 moderate warnings from minimatch inside ESLint 10 (dev only); the forced fix downgrades ESLint to 9 (found in M04b).

Deferred from the M04b review: stricter palette test (8-digit hex, hsl(), named colours in any property), real checks for font usage and reduced motion, capped pop-in delay, year in the detail popover date, retry when the first load fails, stale "today" after midnight.

A done milestone whose date has passed still shows the coral overdue halo (found in M05).

Deferred from the M05 review: ids with leading zeros (e.g. 007) are accepted; aria-valuetext on the progress bar; no-op .map in countMilestonesByStatus; focus falls to body if Esc is pressed while a status change is pending.

Deferred from the M06 review: `rel="noopener noreferrer"` on event links; a comment explaining why the client `isSafeUrl` is case-insensitive while the server check is case-sensitive; move the 30-day date arithmetic from `src/routes/upcoming.js` into a shared, tested helper; pass `'done'` as a `?` parameter in `listOpenMilestonesUntil`; `loadUpcoming` keeps a stale error message after a successful refresh; align the server's UTC "today" with the browser's local date; editing and deleting events (out of M06 scope).
