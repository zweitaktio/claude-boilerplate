#!/bin/bash
# version: 1.0.0
# PostToolUse hook: run `yarn check` after file edits in a workspace.
#
# Walks up from the edited file to find the nearest package.json with a "check"
# script, then runs `yarn check` there. Works for monorepos (frontend/, backend/,
# services/*/) and single-package projects alike.
#
# Skips: non-code files, files outside any workspace, missing check script.
#
# Compatible with Bash 3.2 (macOS default).

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<EOF
auto-check.sh — Run yarn check after file edits

Hook event: PostToolUse (matcher: Edit|Write)

Walks up from the edited file to find the nearest package.json with a
"check" script, then runs yarn check there. Skips non-code files,
files outside any workspace, and missing check scripts.

Dependencies: jq, yarn
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

# Only act on Edit and Write
if [ "$TOOL" != "Edit" ] && [ "$TOOL" != "Write" ]; then
  exit 0
fi

FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Skip non-code files
case "$FILE" in
  *.md|*.json|*.yml|*.yaml|*.toml|*.txt|*.env*|*.lock|*.css|*.scss) exit 0 ;;
esac

# Walk up to find nearest package.json with a "check" script
DIR=$(dirname "$FILE")
while [ "$DIR" != "/" ] && [ "$DIR" != "." ]; do
  if [ -f "$DIR/package.json" ]; then
    HAS_CHECK=$(jq -r '.scripts.check // empty' "$DIR/package.json" 2>/dev/null)
    if [ -n "$HAS_CHECK" ]; then
      WORKSPACE="$DIR"
      break
    fi
  fi
  DIR=$(dirname "$DIR")
done

if [ -z "$WORKSPACE" ]; then
  exit 0
fi

# Run yarn check in the workspace
OUTPUT=$(cd "$WORKSPACE" && yarn check 2>&1)
RC=$?

if [ $RC -ne 0 ]; then
  # Return failures as context so Claude sees and fixes them
  cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "yarn check failed in $(basename "$WORKSPACE")/:\n\n$OUTPUT"
  }
}
EOJSON
  exit 0
fi

exit 0
