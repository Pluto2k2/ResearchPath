# M03 — CI pipeline

| | |
|---|---|
| **Goal** | Every pull request to `develop` or `main` runs lint, tests and a Docker build on GitHub Actions, and cannot be merged when they fail. |
| **Owner** | Agent (Claude Code) + You (GitHub settings) |
| **Branch** | `ci/github-actions` |
| **Depends on** | M02 |
| **Status** | done |

## Context

The git workflow in `CLAUDE.md` says a branch reaches `develop` only through a pull request
with green CI. This mission creates that CI. Agent: `devops-engineer` only.

## Acceptance criteria

- [x] `.github/workflows/ci.yml` runs on `pull_request` to `develop` and `main`, and on `push` to `develop`.
- [x] Job `lint-and-test`: Node 22 with npm cache, `npm ci`, `npm run lint`, `npm test`.
- [x] Job `docker-build`: builds the `prod` target of the `Dockerfile` (no push).
- [x] Minimal `permissions` (`contents: read`), actions pinned to a major version (`@v4`), `concurrency` cancels outdated runs of the same branch.
- [x] The report lists the GitHub settings the user must apply: a ruleset on `develop` and `main` requiring a pull request and the checks `lint-and-test` and `docker-build`.

## Out of scope

- Deployment, image publishing or releases (M07).
- Any change to `src/`, `public/` or `tests/`.

## Prompt

```
/mission docs/missions/M03-ci-pipeline.md
```

## How to verify (you)

1. Open the pull request of this mission: both checks run and pass.
2. Apply the ruleset on GitHub (Settings > Rules > Rulesets) for `develop` and `main`.
3. On a test branch, break a test and open a draft pull request: the merge button is blocked. Close it.

## Result (filled by the agent)

- Files changed:
  - `.github/workflows/ci.yml` (new). Jobs:
    - `lint-and-test`: Node 22 with npm cache, `npm ci`, `npm run lint`, `npm test`.
    - `docker-build`: builds the `prod` target with no push (`docker build --target prod`), then a smoke test. The smoke test starts the container, calls `curl --max-time 2` on `/api/health` against a 20-second deadline, fails fast if the container exits before answering, and prints `docker logs`.
  - Workflow settings:
    - Triggers: `pull_request` to `develop` and `main`, and `push` to `develop`.
    - `permissions: contents: read`.
    - Actions pinned to `@v4` (`actions/checkout`, `actions/setup-node`).
    - `concurrency` cancels outdated runs of the same branch.
- Tests added: none (no change to `tests/`; out of scope).
- Lint / tests / build:
  - Locally: `npm ci`, `npm run lint` and `npm test` are green (5 files, 17 tests).
  - `docker build --target prod` succeeds.
  - The smoke test passed locally. Its fast-fail path was checked with a container that exits immediately.
  - The 20-second timeout path was not exercised.
  - The workflow has not run on GitHub yet.
- Pull request: [TODO: link to the PR once opened]

### GitHub settings to apply (you)

1. Go to Settings > Rules > Rulesets > New branch ruleset.
2. Set Enforcement to `Active` and leave bypass empty (no bypass).
3. Target the branches `develop` and `main`.
4. Enable these rules:
   - Restrict deletions.
   - Block force pushes.
   - Require a pull request before merging, with 0 approvals.
   - Require status checks to pass: `lint-and-test` and `docker-build` (source: GitHub Actions), with branches up to date before merging.

Notes:

- The checks only appear in the status check picker after they have run once. Apply the ruleset after the first run of this mission's PR.
- Merge this PR into `develop` before protecting `main`. Otherwise, develop-to-main PRs would wait for checks that never run.

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
