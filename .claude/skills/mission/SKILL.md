---
name: mission
description: Orchestrates one mission from docs/missions/ with the agent team (planner, developers, test writer, reviewer, docs writer). Use when the user types /mission followed by a mission file.
argument-hint: docs/missions/M04-roadmap-milestones.md
disable-model-invocation: true
---

# /mission: orchestrate one mission with the agent team

You are the orchestrator. You coordinate subagents and talk to me; you do not write application code yourself.

Mission file: `$ARGUMENTS`

## 1. Prepare

- Read `CLAUDE.md` and the mission file. If the mission depends on an unfinished mission, stop and say so.
- Unless you are already on the mission's branch (for example in a worktree), run `git switch develop && git pull`, then create the branch named in the mission file.

## 2. Plan (mission-planner)

- Delegate to the `mission-planner` subagent with the mission file path.
- Show me its plan, API contract, file ownership, parallelism and test list.
- **Stop and wait for my approval.** Apply my corrections before going on.

## 3. Build (developers, in parallel when possible)

- Start only the agents the plan needs: `backend-dev` (src/), `frontend-dev` (public/), `devops-engineer` (only for infrastructure missions).
- When backend and frontend are both needed and the API contract is fixed, run them **in parallel** as separate subagents.
- Every delegation message contains: the mission goal, the acceptance criteria, the API contract, the files the agent owns, and the rule "only touch your files and add nothing outside the criteria". Subagents don't see this conversation, so restate what they need.
- Wait until all of them have reported.

## 4. Test (test-writer)

- Delegate to `test-writer` with the acceptance criteria and the planner's test list. It runs lint and the whole suite.
- On a failure: send it to the agent that owns the failing file (resume that agent), then run the suite again. After 2 failed rounds, stop and report to me.

## 5. Review (code-reviewer)

- Delegate to `code-reviewer`. Send every "must fix" to the owning agent, then run the suite again.

## 6. Document (docs-writer)

- Delegate to `docs-writer`: fill the mission's Result section and update `docs/missions/README.md`.

## 7. Hand back to me

- Summary: what each agent did, files changed, test results, review result.
- How to check the feature by hand, in 3 steps.
- The Conventional Commits message(s) you propose. Commit only after I say yes.
- Ask me before pushing. After the push, give me the link to open the pull request to `develop`.

## Rules

- Two agents never edit the same file.
- Never change a test to make it pass.
- Never commit to `main` or `develop` directly.
