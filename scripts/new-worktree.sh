#!/usr/bin/env bash
# Create a git worktree for one mission branch, next to this repo, based on origin/develop,
# with its own .env and port so two missions can run side by side.
#
# Usage:   ./scripts/new-worktree.sh <branch> [port]
# Example: ./scripts/new-worktree.sh feature/roadmap-milestones 3001
set -euo pipefail

branch="${1:?usage: ./scripts/new-worktree.sh <branch> [port]}"
port="${2:-3001}"
dir="../$(basename "$PWD")-$(echo "$branch" | tr '/' '-')"

git fetch origin develop
git worktree add "$dir" -b "$branch" origin/develop

cp .env.example "$dir/.env"
sed -i.bak "s/^PORT=.*/PORT=$port/" "$dir/.env" && rm "$dir/.env.bak"

echo "Worktree ready: $dir (branch $branch, app on http://localhost:$port)"
echo "Next: cd $dir && claude -n \"$branch\""
echo "When merged: git worktree remove $dir && git branch -d $branch"
