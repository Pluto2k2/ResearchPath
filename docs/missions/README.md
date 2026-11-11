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
| M06 | [Events and the next 30 days](M06-events-next-30-days.md) | US-03 | `feature/events-next-30-days` | M05 | backend, frontend, test | done |
| M07 | [Continuous deployment and release v0.1.0](M07-cd-release.md) | — | `ci/cd-release` | M06 | devops | done |
| M08 | [Final README](M08-final-readme.md) | — | `docs/final-readme` | M07, M09 | docs | done |
| M09 | [Research news tab](M09-research-news.md) | US-04 | `feature/research-news` | M07 | devops, backend, frontend, test | done |
| M10 | [Hardening for the public site (release v0.2.1)](M10-hardening.md) | — | `fix/hardening` | M08, M09 | devops, backend, frontend, test | done |
| M11 | [Ramy, your research guide buddy! (release v0.3.0)](M11-ramy-mascot.md) | — | `feature/ramy-mascot` | M10 | frontend, test, devops, docs | in review |

Every mission also goes through `mission-planner`, `code-reviewer` and `docs-writer`
(see "Agent team" in [`CLAUDE.md`](../../CLAUDE.md)).

## Backlog (not planned as missions yet)

US-05 events and opportunities board (v0.2); US-06 draft sharing with peers (later, needs accounts), US-07 accounts (later);
US-08 email reminders from Ramy (needs US-07 accounts, design note only in M11). US-04 left the backlog with M09 (research news tab, on-demand, not a daily digest). See
[`docs/mvp-scope.md`](../mvp-scope.md).

npm audit: 4 moderate warnings from minimatch inside ESLint 10 (dev only); the forced fix downgrades ESLint to 9 (found in M04b).

Deferred from the M04b review: stricter palette test (8-digit hex, hsl(), named colours in any property), real checks for font usage and reduced motion, capped pop-in delay, year in the detail popover date, retry when the first load fails, stale "today" after midnight.

Deferred from the M05 review: ids with leading zeros (e.g. 007) are accepted; aria-valuetext on the progress bar; no-op .map in countMilestonesByStatus; focus falls to body if Esc is pressed while a status change is pending.

Deferred from the M06 review: a comment explaining why the client `isSafeUrl` is case-insensitive while the server check is case-sensitive; move the 30-day date arithmetic from `src/routes/upcoming.js` into a shared, tested helper; pass `'done'` as a `?` parameter in `listOpenMilestonesUntil`; `loadUpcoming` keeps a stale error message after a successful refresh; align the server's UTC "today" with the browser's local date; editing and deleting events (out of M06 scope).

Deferred from the M09 review: the arXiv spacer queue is uncapped (many distinct parallel queries wait 3 s each; capping it conflicts with "queued, not dropped"); popovers are closed via a synthetic outside pointerdown because roadmap.js exposes no close API; an arXiv `<title>` with attributes would be skipped by the parser; the debounce is not asserted at 399 ms in the DOM tests; no automated test of the browser back button (only `hashchange`) or of the real 10 s timeout.

Deferred from the M07 review: CD does not run lint or tests (rule for now: tag only commits already on `main`); GitHub Actions build cache in `docker/build-push-action`; a comment next to the Dockerfile `CMD` explaining `--disable-warning=ExperimentalWarning`.

Deferred from the M10 review: verify Render's proxy hop count after deploy (check `req.ips`; raise `TRUST_PROXY_HOPS` if all users share one bucket); per-IPv6-address limiting lets a client rotate within its /64; a second Ctrl+C is ignored during shutdown; an older CD run can time out after two quick merges to `main` (Render deploys the latest `main`).

Deferred from the M11 review: two announcements while news loads (`#news-loading` and the news bubble); the pose swap downloads a second PNG on first view, and `celebrate` may flash on first use (no preload); `shortTitle` can cut a ZWJ emoji sequence or flag (`Intl.Segmenter` would fix it); Ramy keeps the last good progress and upcoming data after a failed refresh.
