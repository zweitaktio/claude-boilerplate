#!/bin/bash
# version: 1.0.0
# TaskCompleted hook: trigger a code quality review on files changed during the task.
#
# Uses git diff to identify the scope of changes, then returns context
# prompting Claude to run a focused review on the affected files.
#
# Compatible with Bash 3.2 (macOS default).

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<EOF
post-plan-review.sh — Trigger code review on changed files after task completion

Hook event: TaskCompleted

Uses git diff to identify changed code files, then returns context
prompting Claude to run a focused review on the affected files.

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
FILE_LIST=$(echo "$CODE_FILES" | head -20)

cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "TaskCompleted",
    "additionalContext": "Task completed. ${FILE_COUNT} code files changed:\n${FILE_LIST}\n\nRun a quick review on these changes: check for missed error handling, type safety gaps, SSR hydration issues, and security concerns. Report any findings inline — don't create a separate review document."
  }
}
EOJSON

exit 0
