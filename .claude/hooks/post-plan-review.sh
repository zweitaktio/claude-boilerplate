#!/bin/bash
# version: 1.1.0
# TaskCompleted hook: quick code review on small changes (1-2 code files).
#
# For larger changes (3+ files), post-feature-review.sh handles
# the full review — this hook exits early to avoid double-reviewing.
#
# Compatible with Bash 3.2 (macOS default).

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<EOF
post-plan-review.sh — Quick review on small changes (1-2 code files)

Hook event: TaskCompleted

Triggers when 1-2 code files changed (vs HEAD). For 3+ files,
post-feature-review.sh handles the full review instead.

Dependencies: git
EOF
  exit 0
fi

INPUT=$(cat)

# Get changed files (staged + unstaged vs HEAD)
CHANGED=$(git diff --name-only HEAD 2>/dev/null)
if [ -z "$CHANGED" ]; then
  exit 0
fi

# Filter to code files only
CODE_FILES=$(echo "$CHANGED" | grep -E '\.(ts|tsx|js|jsx|py|go|rs)$' || true)
if [ -z "$CODE_FILES" ]; then
  exit 0
fi

FILE_COUNT=$(echo "$CODE_FILES" | wc -l | tr -d ' ')

# Skip if 3+ files — post-feature-review.sh handles those
if [ "$FILE_COUNT" -ge 3 ]; then
  exit 0
fi

FILE_LIST=$(echo "$CODE_FILES" | head -20)

cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "TaskCompleted",
    "additionalContext": "Task completed. ${FILE_COUNT} code file(s) changed:\n${FILE_LIST}\n\nQuick review checklist:\n- Error handling: missing try/catch at system boundaries, unhandled promise rejections\n- Type safety: any casts, missing null checks, unvalidated inputs\n- SSR/hydration: if React components changed, verify no server/client mismatches\n- Security: injection vectors, exposed secrets, auth bypasses\n- Pattern consistency: does this follow existing patterns in the codebase? Are there existing utilities that could replace any new code?\n\nReport findings inline — no separate document."
  }
}
EOJSON

exit 0
