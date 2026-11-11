#!/usr/bin/env bash
# Headless AI review of the current branch with the code-reviewer agent
# (Claude Code non-interactive mode, read-only plan mode).
#
# Usage:   ./scripts/ai-review.sh [base-branch]
# Example: ./scripts/ai-review.sh develop
set -euo pipefail

base="${1:-develop}"

claude -p --agent code-reviewer --permission-mode plan \
  "Review the changes of this branch against ${base} (git diff ${base}...HEAD and uncommitted changes). Return only the prioritized list."
