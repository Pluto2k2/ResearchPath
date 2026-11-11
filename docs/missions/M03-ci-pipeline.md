# M03 — CI pipeline

| | |
|---|---|
| **Goal** | Every pull request to `develop` or `main` runs lint, tests and a Docker build on GitHub Actions, and cannot be merged when they fail. |
| **Owner** | Agent (Claude Code) + You (GitHub settings) |
| **Branch** | `ci/github-actions` |
| **Depends on** | M02 |
| **Status** | todo |

## Context

The git workflow in `CLAUDE.md` says a branch reaches `develop` only through a pull request
with green CI. This mission creates that CI. Agent: `devops-engineer` only.

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` runs on `pull_request` to `develop` and `main`, and on `push` to `develop`.
- [ ] Job `lint-and-test`: Node 22 with npm cache, `npm ci`, `npm run lint`, `npm test`.
- [ ] Job `docker-build`: builds the `prod` target of the `Dockerfile` (no push).
- [ ] Minimal `permissions` (`contents: read`), actions pinned to a major version (`@v4`), `concurrency` cancels outdated runs of the same branch.
- [ ] The report lists the GitHub settings the user must apply: a ruleset on `develop` and `main` requiring a pull request and the checks `lint-and-test` and `docker-build`.

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
- Tests added:
- Lint / tests / build:
- Pull request:

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
