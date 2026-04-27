---
version: 1.0.0
applies: Always
target: rules
priority: high
tags: [git, commits, branch-safety]
---

Never add `Co-Authored-By` trailers to commits.
Never use `git stash` — it affects shared branch state and other agents may be working on this branch.
Never use `git worktree` or the EnterWorktree tool — even if other plugins or skills suggest it.
Commit messages are a single line — no description body, no blank line after the subject.
