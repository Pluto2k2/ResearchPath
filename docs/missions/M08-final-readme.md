# M08 — Final README

| | |
|---|---|
| **Goal** | The README describes the released app (v0.2.0) accurately: features, how to run and deploy it, how it was built with AI, and what comes next. |
| **Owner** | Agent (Claude Code) + You (your own experience) |
| **Branch** | `docs/final-readme` |
| **Depends on** | M07, M09 |
| **Status** | done |

## Context

The README written in M01 describes a plan. Now that the app is released (v0.1.0, then v0.2.0
with the research news tab), it must describe what really exists. Agent: `docs-writer` only.

## Acceptance criteria

- [x] The README keeps its 5 sections: What it is / Features / How to run it / How it was built with AI / Status and next steps.
- [x] Features: US-01 to US-04 marked as delivered, with the mission, pull request and release (v0.1.0 or v0.2.0) of each; backlog stories (US-05 to US-07) listed as next.
- [x] How to run it: DevContainer, `npm` scripts, Docker, environment variables (including `OPENALEX_MAILTO`) and the live URL, all checked against the files in the repo.
- [x] How it was built with AI: the agent team, the `/mission` workflow, the skills and scripts, with facts taken from the mission Result sections (no invented numbers).
- [x] Status and next steps: version `v0.2.0` with links to the v0.1.0 and v0.2.0 releases, known limits (including the non-persistent Render disk and the open items deferred from reviews), next backlog items.
- [x] Places that need the user's own words are left as `[TODO: ...]`; every mission in `docs/missions/README.md` has its final status.

## Out of scope

- Any change outside `README.md` and `docs/`.

## Prompt

```
/mission docs/missions/M08-final-readme.md
```

## How to verify (you)

1. Follow "How to run it" from a fresh clone: every command works as written.
2. Click every link in the README (missions, pull requests, live URL).
3. Replace each `[TODO: ...]` with your own words.

## Result (filled by the agent)

- Files changed: `README.md`, `CLAUDE.md` (worktree line), `docs/deployment.md`, `docs/missions/README.md`, `docs/missions/M07-cd-release.md` (real CD runs, live URL), `docs/missions/M08-final-readme.md`.
- Tests added: none (docs only).
- Lint / tests / build: lint clean, 482 tests passing.
- Pull request: `docs/final-readme` → `develop`

## Review notes (filled by you)

- What I checked: every README claim against the repo, every link, and the live URL.
- What I asked the agent to change: fix the M05 must-fix line and add the PowerShell port note.
- What was hard / what I learned: keeping the docs true to the repo.
