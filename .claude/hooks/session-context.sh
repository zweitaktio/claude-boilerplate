#!/bin/bash
# version: 1.0.0
# SessionStart hook: inject branch, recent commits, and uncommitted changes.
#
# Provides Claude with git state awareness at session start to eliminate
# the cold-start problem of not knowing what state the repo is in.
#
# Compatible with Bash 3.2 (macOS default).

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<EOF
session-context.sh — Load git context at session start

Hook event: SessionStart

Injects current branch, recent commits, and uncommitted changes
so Claude starts each session with full state awareness.

Dependencies: git
EOF
  exit 0
fi

# Skip if not in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

BRANCH=$(git branch --show-current 2>/dev/null)
RECENT=$(git log --oneline -5 2>/dev/null)
STATUS=$(git status --short 2>/dev/null)

# Skip if nothing useful to report
if [ -z "$BRANCH" ] && [ -z "$RECENT" ] && [ -z "$STATUS" ]; then
  exit 0
fi

CONTEXT="## Session context"

if [ -n "$BRANCH" ]; then
  CONTEXT="${CONTEXT}\nBranch: ${BRANCH}"
fi

if [ -n "$RECENT" ]; then
  CONTEXT="${CONTEXT}\n\nRecent commits:\n${RECENT}"
fi

if [ -n "$STATUS" ]; then
  CONTEXT="${CONTEXT}\n\nUncommitted changes:\n${STATUS}"
fi

cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${CONTEXT}"
  }
}
EOJSON

exit 0
