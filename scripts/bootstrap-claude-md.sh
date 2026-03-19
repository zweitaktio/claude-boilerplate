#!/bin/bash
# version: 1.0.0
# Bootstraps CLAUDE.md in target projects from the template.
# Creates if missing, appends missing sections if exists.
#
# Usage:
#   bootstrap-claude-md.sh <project-path>
#   bootstrap-claude-md.sh <project-path> --dry-run
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$SKILL_DIR/references/bootstrap-template.md"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: bootstrap-claude-md.sh <project-path> [--dry-run]

Creates or updates CLAUDE.md in the target project:
- If missing: creates from bootstrap template
- If exists: checks for required sections and appends missing ones

Required sections:
  ## Commands, ## Architecture, ## Rules, ## Vendor Knowledge,
  ### Knowledge accumulation

Output: JSON object with {action, sections_added, sections_existing}

--dry-run: report what would be done without modifying files
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

PROJECT="${1:?Usage: bootstrap-claude-md.sh <project-path>}"
shift

DRY_RUN="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN="true"; shift ;;
    *) shift ;;
  esac
done

CLAUDE_MD="$PROJECT/CLAUDE.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "Error: Bootstrap template not found at $TEMPLATE" >&2
  exit 1
fi

# Extract template content (between ```markdown and ```)
TEMPLATE_CONTENT=$(awk '/^```markdown$/{ found=1; next } /^```$/{ if(found) exit } found{ print }' "$TEMPLATE")

if [ -z "$TEMPLATE_CONTENT" ]; then
  echo "Error: Could not extract template content from $TEMPLATE" >&2
  exit 1
fi

# ─── Section definitions (heading + content from template) ──
# Each section is identified by its heading and extracted from the template
extract_section() {
  local heading="$1"
  local level="$2"
  local content="$TEMPLATE_CONTENT"
  local hashes
  hashes=$(printf '#%.0s' $(seq 1 "$level"))

  echo "$content" | awk -v pat="^${hashes} ${heading}$" -v lvl="$level" '
    BEGIN { found = 0 }
    $0 ~ pat { found = 1; print; next }
    found {
      if (match($0, /^#+/)) {
        hl = RLENGTH
        if (hl <= lvl) exit
      }
      print
    }
  '
}

# ─── Create from scratch ──
if [ ! -f "$CLAUDE_MD" ]; then
  if [ "$DRY_RUN" = "true" ]; then
    echo '{"action":"CREATE","sections_added":["## Commands","## Architecture","## Rules","## Vendor Knowledge","### Knowledge accumulation"],"sections_existing":[]}'
  else
    echo "$TEMPLATE_CONTENT" > "$CLAUDE_MD"
    echo '{"action":"CREATE","sections_added":["## Commands","## Architecture","## Rules","## Vendor Knowledge","### Knowledge accumulation"],"sections_existing":[]}'
  fi
  exit 0
fi

# ─── Check existing CLAUDE.md for missing sections ──
EXISTING=$(cat "$CLAUDE_MD")

# Vendor Knowledge aliases
vk_found="false"
for alias in "## Vendor Knowledge" "## Knowledge Graph" "## KG Entities" "## Vendor Docs"; do
  if echo "$EXISTING" | grep -q "^${alias}"; then
    vk_found="true"
    break
  fi
done

# Check each required section
SECTIONS_ADDED="[]"
SECTIONS_EXISTING="[]"
APPEND_CONTENT=""

check_and_queue() {
  local heading="$1"
  local level="$2"
  local check_name="$3"
  local hashes
  hashes=$(printf '#%.0s' $(seq 1 "$level"))

  # Special handling for Vendor Knowledge aliases
  if [ "$check_name" = "## Vendor Knowledge" ] && [ "$vk_found" = "true" ]; then
    SECTIONS_EXISTING=$(echo "$SECTIONS_EXISTING" | jq --arg v "$check_name" '. + [$v]')
    return
  fi

  if echo "$EXISTING" | grep -q "^${hashes} ${heading}"; then
    SECTIONS_EXISTING=$(echo "$SECTIONS_EXISTING" | jq --arg v "$check_name" '. + [$v]')
  else
    SECTIONS_ADDED=$(echo "$SECTIONS_ADDED" | jq --arg v "$check_name" '. + [$v]')
    local section_content
    section_content=$(extract_section "$heading" "$level")
    APPEND_CONTENT="${APPEND_CONTENT}

${section_content}"
  fi
}

check_and_queue "Commands" 2 "## Commands"
check_and_queue "Architecture" 2 "## Architecture"
check_and_queue "Rules" 2 "## Rules"
check_and_queue "Vendor Knowledge" 2 "## Vendor Knowledge"

# Knowledge accumulation is a child of Vendor Knowledge — only check separately
# if Vendor Knowledge already exists (otherwise it's included in the VK section)
VK_WAS_ADDED=$(echo "$SECTIONS_ADDED" | jq -r 'if index("## Vendor Knowledge") then "true" else "false" end')
if [ "$VK_WAS_ADDED" = "true" ]; then
  # Already included as part of Vendor Knowledge section
  SECTIONS_ADDED=$(echo "$SECTIONS_ADDED" | jq '. + ["### Knowledge accumulation"]')
else
  check_and_queue "Knowledge accumulation" 3 "### Knowledge accumulation"
fi

ADDED_COUNT=$(echo "$SECTIONS_ADDED" | jq 'length')

if [ "$ADDED_COUNT" = "0" ]; then
  echo "{\"action\":\"NONE\",\"sections_added\":$SECTIONS_ADDED,\"sections_existing\":$SECTIONS_EXISTING}"
  exit 0
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "{\"action\":\"APPEND\",\"sections_added\":$SECTIONS_ADDED,\"sections_existing\":$SECTIONS_EXISTING}"
else
  echo "$APPEND_CONTENT" >> "$CLAUDE_MD"
  echo "{\"action\":\"APPEND\",\"sections_added\":$SECTIONS_ADDED,\"sections_existing\":$SECTIONS_EXISTING}"
fi
