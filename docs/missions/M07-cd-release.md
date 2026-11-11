# M07 — Continuous deployment and release v0.1.0

| | |
|---|---|
| **Goal** | Merging to `main` publishes a Docker image and deploys it; the MVP is released as `v0.1.0`. |
| **Owner** | Agent (Claude Code) + You (GitHub, Render, release pull request) |
| **Branch** | `ci/cd-release` |
| **Depends on** | M06 |
| **Status** | todo |

## Context

`main` is production (`CLAUDE.md`). This mission turns a merge to `main` into a deployment of
the Docker image, then releases the MVP. Agent: `devops-engineer` only. Hosting: Render
(Docker web service, **free plan**), triggered by a deploy hook stored as a GitHub secret.

**Known limit:** the Render free plan has no persistent disk. The SQLite file is lost on every
redeploy, restart or spin-down after inactivity, so the deployed app is a demo, not a place to
keep real data. A paid persistent disk (or accounts plus a hosted database, v0.3) fixes it.

## Acceptance criteria

- [ ] `.github/workflows/cd.yml` runs on `push` to `main` and on tags `v*`: builds the `prod` target, pushes it to GitHub Container Registry (`ghcr.io/<owner>/researchpath`) tagged with the commit SHA, `latest` (on `main`) and the version (on a tag).
- [ ] After the image is pushed, the workflow calls the Render deploy hook from the secret `RENDER_DEPLOY_HOOK_URL`, then waits for `GET /api/health` on the URL in the variable `APP_URL` to return `200` (with a timeout).
- [ ] Minimal `permissions` (`contents: read`, `packages: write`); no secret or URL with a token in any file.
- [ ] `.env.example` and the report document the production settings (`NODE_ENV=production`, `PORT`, `DB_PATH`) and state that data on the free plan is not persistent.
- [ ] The report lists the steps for the user: create the Render service, add the secret and variable on GitHub, open the release pull request `develop` -> `main`, tag `v0.1.0` and create the GitHub release.

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

## Result (filled by the agent)

- Files changed:
- Tests added:
- Lint / tests / build:
- Pull request:

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
