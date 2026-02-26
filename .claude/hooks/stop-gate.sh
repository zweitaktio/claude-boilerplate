#!/bin/bash
# version: 1.0.0
# Stop hook: verify yarn check passes in all affected workspaces before Claude stops.
#
# Uses git diff to find changed files, derives workspaces, runs yarn check in each.
# Catches cross-workspace breakage (e.g., backend type changes that break frontend)
# and anything the per-edit auto-check hook missed.
#
# Compatible with Bash 3.2 (macOS default) — no associative arrays.

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<EOF
stop-gate.sh — Verify yarn check passes before Claude stops

Hook event: Stop

Uses git diff to find changed files, derives workspaces, and runs
yarn check in each. Catches cross-workspace breakage and anything the
per-edit auto-check hook missed.

Dependencies: jq, git, yarn
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

INPUT=$(cat)

# Prevent infinite loops: if the stop hook already fired and Claude is trying
# to stop again after fixing issues, let it through.
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

# Find files changed in the working tree (staged + unstaged)
CHANGED=$(git diff --name-only HEAD 2>/dev/null)
if [ -z "$CHANGED" ]; then
  # No changes — nothing to check
  exit 0
fi

# Collect unique workspaces from changed files (newline-separated list, no assoc arrays)
WORKSPACES=""
while IFS= read -r FILE; do
  DIR=$(dirname "$FILE")
  FOUND=""
  # Walk up to find nearest package.json with a "check" script
  while [ "$DIR" != "." ] && [ "$DIR" != "/" ]; do
    if [ -f "$DIR/package.json" ]; then
      HAS_CHECK=$(jq -r '.scripts.check // empty' "$DIR/package.json" 2>/dev/null)
      if [ -n "$HAS_CHECK" ]; then
        FOUND="$DIR"
        break
      fi
    fi
    DIR=$(dirname "$DIR")
  done
  # Also check project root
  if [ -z "$FOUND" ] && [ "$DIR" = "." ] && [ -f "package.json" ]; then
    HAS_CHECK=$(jq -r '.scripts.check // empty' "package.json" 2>/dev/null)
    if [ -n "$HAS_CHECK" ]; then
      FOUND="."
    fi
  fi
  # Append if not already in list
  if [ -n "$FOUND" ]; then
    case "$WORKSPACES" in
      *"$FOUND"*) ;;  # already present
      "") WORKSPACES="$FOUND" ;;
      *)  WORKSPACES="$WORKSPACES
$FOUND" ;;
    esac
  fi
done <<< "$CHANGED"

if [ -z "$WORKSPACES" ]; then
  exit 0
fi

# Run yarn check in each affected workspace, collect failures
FAILURES=""
while IFS= read -r WS; do
  OUTPUT=$(cd "$WS" && yarn check 2>&1)
  RC=$?
  if [ $RC -ne 0 ]; then
    WS_NAME=$(basename "$WS")
    [ "$WS" = "." ] && WS_NAME="root"
    FAILURES="${FAILURES}\n--- ${WS_NAME}/ ---\n${OUTPUT}\n"
  fi
done <<< "$WORKSPACES"

if [ -n "$FAILURES" ]; then
  echo -e "yarn check failed in affected workspaces. Fix before finishing:\n${FAILURES}" >&2
  exit 2
fi

exit 0
