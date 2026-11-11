# M08 — Final README

| | |
|---|---|
| **Goal** | The README describes the released MVP accurately: features, how to run and deploy it, how it was built with AI, and what comes next. |
| **Owner** | Agent (Claude Code) + You (your own experience) |
| **Branch** | `docs/final-readme` |
| **Depends on** | M07 |
| **Status** | todo |

## Context

The README written in M01 describes a plan. Once the MVP is released, it must describe what
really exists. Agent: `docs-writer` only.

## Acceptance criteria

- [ ] The README keeps its 5 sections: What it is / Features / How to run it / How it was built with AI / Status and next steps.
- [ ] Features: US-01 to US-03 marked as delivered, with the mission and pull request of each; backlog stories listed as next.
- [ ] How to run it: DevContainer, `npm` scripts, Docker, environment variables and the live URL, all checked against the files in the repo.
- [ ] How it was built with AI: the agent team, the `/mission` workflow, the skills and scripts, with facts taken from the mission Result sections (no invented numbers).
- [ ] Status and next steps: version `v0.1.0`, known limits, next backlog items.
- [ ] Places that need the user's own words are left as `[TODO: ...]`; every mission in `docs/missions/README.md` has its final status.

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

- Files changed:
- Tests added:
- Lint / tests / build:
- Pull request:

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
