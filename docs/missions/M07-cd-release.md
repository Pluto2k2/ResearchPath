# M07 — Continuous deployment and release v0.1.0

| | |
|---|---|
| **Goal** | Merging to `main` publishes a Docker image and deploys it; the MVP is released as `v0.1.0`. |
| **Owner** | Agent (Claude Code) + You (GitHub, Render, release pull request) |
| **Branch** | `ci/cd-release` |
| **Depends on** | M06 |
| **Status** | done |

## Context

`main` is production (`CLAUDE.md`). This mission turns a merge to `main` into a deployment of
the Docker image, then releases the MVP. Agent: `devops-engineer` only. Hosting: Render
(Docker web service, **free plan**), triggered by a deploy hook stored as a GitHub secret.

**Known limit:** the Render free plan has no persistent disk. The SQLite file is lost on every
redeploy, restart or spin-down after inactivity, so the deployed app is a demo, not a place to
keep real data. A paid persistent disk (or accounts plus a hosted database, v0.3) fixes it.

## Acceptance criteria

- [x] `.github/workflows/cd.yml` runs on `push` to `main` and on tags `v*`: builds the `prod` target, pushes it to GitHub Container Registry (`ghcr.io/<owner>/researchpath`) tagged with the commit SHA, `latest` (on `main`) and the version (on a tag).
- [x] After the image is pushed, the workflow calls the Render deploy hook from the secret `RENDER_DEPLOY_HOOK_URL`, then waits for `GET /api/health` on the URL in the variable `APP_URL` to return `200` (with a timeout).
- [x] Minimal `permissions` (`contents: read`, `packages: write`); no secret or URL with a token in any file.
- [x] `.env.example` and the report document the production settings (`NODE_ENV=production`, `PORT`, `DB_PATH`) and state that data on the free plan is not persistent.
- [x] The report lists the steps for the user: create the Render service, add the secret and variable on GitHub, open the release pull request `develop` -> `main`, tag `v0.1.0` and create the GitHub release.

The criteria are met in the files. The real run (GHCR push, Render deploy, health check) is
still to be seen: see "Real CD runs" in the Result below.

## Out of scope

- Accounts, custom domain, database backups, monitoring.
- Any change to `src/`, `public/` or `tests/`.

## Prompt

```
/mission docs/missions/M07-cd-release.md
```

## How to verify (you)

1. Merge the release pull request into `main`: the CD workflow is green and the image is in GitHub Packages.
2. Open the Render URL: the app works; `/api/health` returns `{"status":"ok"}`.
3. Add a milestone, redeploy: it is gone (expected on the free plan, documented). Then check the `v0.1.0` release on GitHub.

Steps for these checks: [`docs/deployment.md`](../deployment.md).

## Result (filled by the agent)

- Files changed:
  - `.github/workflows/cd.yml` (new): workflow `CD` with the jobs `publish` (image to GHCR) and `deploy` (Render hook and health check).
  - `Dockerfile`: `HEALTHCHECK` reads `PORT` (default `3000`); the `prod` `CMD` runs with `--disable-warning=ExperimentalWarning`.
  - `package.json`: `start` and `dev` scripts run with `--disable-warning=ExperimentalWarning`.
  - `vitest.config.js` (new): `test.execArgv` hides the same warning in the test workers.
  - `.env.example`: comments on the production settings (`NODE_ENV`, `PORT` on Render, `DB_PATH`) and on the free-plan data loss.
  - `docs/deployment.md` (new): production settings, free-plan warning, how CD works, set-up and release steps, known limitations.
  - `docs/missions/M07-cd-release.md`: this report.
  - `docs/missions/M02-bootstrap-skeleton.md`: the HEALTHCHECK follow-up marked as fixed.
  - `docs/missions/README.md`: M07 status and backlog items.
  - `README.md`: Deployment section and status.
  - Not changed: `src/`, `public/`, `tests/`, `package-lock.json`.
- Tests added: none (infrastructure mission).
- Lint / tests / build:
  - `npm run lint`: clean.
  - `npm test`: 16 files, 300 tests passed; no ExperimentalWarning in the output.
  - `npm start`: `/api/health` returns `200` without the warning.
  - `docker build --target prod` and a plain `docker build` (last stage, as Render builds it): OK.
  - The containers reach `healthy` with `PORT=10000` and with the default port.
  - `actionlint` on `cd.yml`: no findings.
  - Grep for secrets and token URLs in the repository: nothing found.
- Pull request: [#11](https://github.com/Pluto2k2/ResearchPath/pull/11); release [#12](https://github.com/Pluto2k2/ResearchPath/pull/12), tag v0.1.0
- Real CD runs:
  - First CD run on `main` (green): https://github.com/Pluto2k2/ResearchPath/actions/runs/43052462230; image `ghcr.io/pluto2k2/researchpath`
  - CD run for tag `v0.1.0` (green): https://github.com/Pluto2k2/ResearchPath/actions/runs/43053079318
  - Live URL: https://researchpath.onrender.com; `/api/health` answers `{"status":"ok"}`.
- Decisions (from the user):
  - Deploy only from `main`, never from a version tag.
  - A missing `RENDER_DEPLOY_HOOK_URL` or `APP_URL` gives a workflow warning; the job stays green.
  - Version tag `0.1.0` only; the image has no `v`-prefixed tag.
  - Render builds the repository itself (branch `main`, Docker). The deploy hook only starts that build. The GHCR image is a versioned artifact.
  - Health check deadline 15 minutes (planned 10), because Render builds from source.
  - `--disable-warning=ExperimentalWarning` hides all experimental warnings, not only the `node:sqlite` one (Node gives it no code). Deprecation and other warnings are still shown.
- Review (`code-reviewer`):
  - Must fix: none.
  - Known limitations (recorded in `docs/deployment.md` and the backlog):
    1. The health wait can pass against the old Render instance (zero-downtime deploys keep it serving), so it does not prove the new release is live. Real fix: `/api/health` returns the commit SHA and CD compares it with `GITHUB_SHA`, or Render's API is polled.
    2. CD does not run lint or tests. Rule: only tag commits already on `main` (merged through the release pull request with green CI).
  - Nice to have (backlog): GitHub Actions build cache in `docker/build-push-action`; a comment next to the Dockerfile `CMD` flag.
- Reviewer follow-up resolved: "HEALTHCHECK hardcodes port 3000" (from M02) is fixed in M07.

## Review notes (filled by you)

- What I checked: The CD run (publish, then deploy), the image in GitHub Container Registry, the Render deploy and the live `/api/health`.
- What I asked the agent to change: Deploy only from `main`, warn instead of failing when the deploy hook is missing, and wait up to 15 minutes for the health check.
- What was hard / what I learned: I first stored the deploy hook as an environment secret instead of a repository secret, and release PR #10 reached `main` before M07 was merged, so CD was missing until PR #12. Release order matters.
