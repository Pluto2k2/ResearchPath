# M01 — Project setup: README, CLAUDE.md and missions

| | |
|---|---|
| **Goal** | The repository explains the project, its rules and its agent team, and the work is split into missions. |
| **Owner** | Agent (Claude Code) |
| **Branch** | `docs/project-setup` |
| **Depends on** | none |
| **Status** | in progress |

## Context

Before any code, Claude Code and its subagents need written rules (`CLAUDE.md`), a public
description of the project (`README.md`) and a plan split into small missions, so that each
mission can be run with `/mission` and reviewed on its own.

## Acceptance criteria

- [ ] `README.md` has 5 sections: What it is / Features (user stories, MVP vs backlog) / How to run it / How it was built with AI / Status and next steps.
- [ ] `CLAUDE.md` has the description, the stack, the planned architecture, the conventions and the working rules (git workflow, Conventional Commits, DevContainer + Docker, no secrets, plan before code).
- [ ] `CLAUDE.md` has an "Agent team" section: each agent's files and job, and the orchestration rules.
- [ ] `docs/missions/` has one file per mission following `_template.md`, and an index `docs/missions/README.md`.

## Out of scope

- Any application code, `package.json`, Docker or CI file.

## Prompt

```
We are starting a new project in this folder. [...] Read docs/mvp-scope.md,
docs/missions/_template.md, .claude/agents/, .claude/skills/ and .claude/settings.json.
Then create: a README.md with 5 sections, a CLAUDE.md (description, stack, planned
architecture, conventions, working rules), one mission file per mission in docs/missions/
plus an index, and an "Agent team" section in CLAUDE.md.
Don't write any application code yet. Show me the files before committing.
```

## How to verify (you)

1. Read `CLAUDE.md`: are the rules the ones you want the agents to follow?
2. Open `docs/missions/README.md` and check the order and dependencies of the missions.
3. Open `M04-roadmap-milestones.md`: could you run it with `/mission` as it is?

## Result (filled by the agent)

- Files changed: `README.md`, `CLAUDE.md`, `docs/missions/README.md`, `docs/missions/M01` to `M08`, `.claude/agents/mission-planner.md` (ownership list aligned with `CLAUDE.md`).
- Tests added: none (documentation only).
- Lint / tests / build: not applicable yet.
- Pull request: [TODO: link]

## Review notes (filled by you)

- What I checked:
- What I asked the agent to change:
- What was hard / what I learned:
