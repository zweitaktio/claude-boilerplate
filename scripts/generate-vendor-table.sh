#!/bin/bash
# version: 1.0.0
# Generates the CLAUDE.md Vendor Knowledge table from sync.sh CHECK_KG output.
# Groups entities by domain, outputs a markdown table ready to paste into CLAUDE.md.
#
# Usage:
#   sync.sh compare <project> --group vendor | generate-vendor-table.sh
#   generate-vendor-table.sh < sync-output.json
#   generate-vendor-table.sh --patch <project-path>   (update CLAUDE.md in place)
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: generate-vendor-table.sh [--patch <project-path>]

Reads sync.sh JSON output from stdin, filters to CHECK_KG entries,
groups entities by domain, and outputs a markdown table.

With --patch: replaces the Vendor Knowledge table in <project>/CLAUDE.md.
Without --patch: prints the markdown table to stdout.

Requires: jq
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

PATCH_PATH=""
if [ "${1:-}" = "--patch" ]; then
  PATCH_PATH="${2:?--patch requires a project path}"
  if [ ! -f "$PATCH_PATH/CLAUDE.md" ]; then
    echo "Error: $PATCH_PATH/CLAUDE.md not found." >&2
    exit 1
  fi
fi

# Read stdin (sync.sh JSON output)
INPUT=$(cat)

# Extract CHECK_KG entries with entity and domain
ENTRIES=$(echo "$INPUT" | jq -c '[.[] | select(.action == "CHECK_KG") | {entity, domain}]')

COUNT=$(echo "$ENTRIES" | jq 'length')
if [ "$COUNT" -eq 0 ]; then
  echo "No CHECK_KG entries found in input." >&2
  exit 0
fi

# Get unique domains sorted
DOMAINS=$(echo "$ENTRIES" | jq -r '[.[].domain] | unique | .[]')

# Build markdown table
TABLE="| Domain | Entities | Search query |
|--------|----------|-------------|"

while IFS= read -r domain; do
  [ -z "$domain" ] && continue
  # Get entities for this domain, backtick-wrapped, comma-separated
  entities=$(echo "$ENTRIES" | jq -r \
    --arg d "$domain" \
    '[.[] | select(.domain == $d) | .entity] | sort | map("`" + . + "`") | join(", ")')
  query='`search_nodes("domain: '"$domain"'")`'
  TABLE="$TABLE
| $domain | $entities | $query |"
done <<EOF
$DOMAINS
EOF

if [ -z "$PATCH_PATH" ]; then
  echo "$TABLE"
  exit 0
fi

# Patch CLAUDE.md: replace content between ## Vendor Knowledge and next ##
CLAUDE_MD="$PATCH_PATH/CLAUDE.md"
TMPFILE=$(mktemp)
TABLE_TMP=$(mktemp)
trap 'rm -f "$TMPFILE" "$TABLE_TMP"' EXIT

echo "$TABLE" > "$TABLE_TMP"

# Use awk with getline to read table from file (avoids -v quoting issues)
awk -v tfile="$TABLE_TMP" '
  /^## Vendor Knowledge/ {
    print
    print ""
    while ((getline line < tfile) > 0) print line
    close(tfile)
    print ""
    in_section = 1
    next
  }
  in_section && /^## / {
    in_section = 0
  }
  !in_section { print }
' "$CLAUDE_MD" > "$TMPFILE"

if diff -q "$CLAUDE_MD" "$TMPFILE" >/dev/null 2>&1; then
  echo "No changes needed — Vendor Knowledge table is up to date." >&2
else
  mv "$TMPFILE" "$CLAUDE_MD"
  echo "Updated Vendor Knowledge table in $CLAUDE_MD" >&2
fi
