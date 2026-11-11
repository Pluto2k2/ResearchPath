---
name: pre-push-review
description: Reviews code pending commit — bugs, security issues, and compliance with CLAUDE.md conventions — before pushing it.
---

# /pre-push-review

Reviews changes that haven't been pushed to the remote repository yet.

## When it's invoked

Before every `git push`, or when the user explicitly types `/pre-push-review`.

## What it does

1. Identifies the files modified since the last commit (`git status`, `git diff`, and `git diff develop...HEAD` for the whole branch).
2. Looks for potential bugs and security issues (injection, XSS, hardcoded secrets).
3. Checks that the code follows the conventions defined in `CLAUDE.md`.
4. Returns a prioritized list of findings — or explicitly confirms there are no issues.

## Expected output

A short summary: what's good, what needs fixing before committing, and why.
