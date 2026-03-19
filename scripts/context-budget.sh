#!/bin/bash
# version: 1.0.0
# Measures per-turn context cost of always-loaded content in a target project.
# Outputs JSON with always_loaded, path_scoped, claude_md, and totals.
#
# Usage:
#   context-budget.sh <project-path>
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: context-budget.sh <project-path>

Measures per-turn context cost of always-loaded content:

  a) Always-loaded rules — files in .claude/rules/core/ WITHOUT paths:
     in YAML frontmatter. These load every turn.
  b) Path-scoped rules — files in .claude/rules/core/ WITH paths: frontmatter.
     Flags overly broad patterns as INFO.
  c) CLAUDE.md size — flags if over 100 lines.
  d) Totals — compares always-loaded + CLAUDE.md against budget
     (850 lines / 20480 bytes). Flags WARN if exceeded.

Output: JSON object with {always_loaded, path_scoped, claude_md, totals}

Requires: jq
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

PROJECT="${1:?Usage: context-budget.sh <project-path>}"

if [ ! -d "$PROJECT" ]; then
  echo "Error: $PROJECT is not a directory." >&2
  exit 1
fi

# Resolve to absolute path
PROJECT=$(cd "$PROJECT" && pwd)

BUDGET_LINES=850
BUDGET_BYTES=20480
CLAUDE_MD_LINE_LIMIT=100

# Broad path patterns that are effectively always-loaded
BROAD_PATTERNS='**/*.ts **/*.tsx **/*.js **/*.jsx'

ALWAYS_LOADED="[]"
PATH_SCOPED="[]"

# ─── Helper: get file size in bytes (portable) ──
file_bytes() {
  local filepath="$1"
  if [ "$(uname)" = "Darwin" ]; then
    stat -f%z "$filepath" 2>/dev/null || echo 0
  else
    stat -c%s "$filepath" 2>/dev/null || echo 0
  fi
}

# ─── Helper: count lines in file ──
file_lines() {
  local filepath="$1"
  wc -l < "$filepath" 2>/dev/null | tr -d ' '
}

# ─── Helper: extract paths: field from YAML frontmatter ──
# Returns the paths array as space-separated values, or empty string if no paths:
extract_paths() {
  local filepath="$1"

  # Check if file starts with ---
  local first_line
  first_line=$(head -1 "$filepath" 2>/dev/null || true)
  if [ "$first_line" != "---" ]; then
    echo ""
    return
  fi

  # Extract frontmatter (between first --- and second ---)
  local frontmatter
  frontmatter=$(awk 'NR==1 && /^---$/ {found=1; next} found && /^---$/ {exit} found {print}' "$filepath" 2>/dev/null || true)

  # Check if paths: exists
  if ! echo "$frontmatter" | grep -q '^paths:'; then
    echo ""
    return
  fi

  # Extract paths values (lines starting with - after paths:)
  local paths_values
  paths_values=$(echo "$frontmatter" | awk '
    /^paths:/ { in_paths=1; next }
    in_paths && /^[[:space:]]*-[[:space:]]/ {
      sub(/^[[:space:]]*-[[:space:]]*/, "")
      # Remove surrounding quotes
      gsub(/^["'\''"]|["'\''"]$/, "")
      printf "%s ", $0
      next
    }
    in_paths && /^[a-zA-Z]/ { exit }
  ' 2>/dev/null || true)

  echo "$paths_values"
}

# ─── Helper: check if any path pattern is overly broad ──
is_broad() {
  local paths="$1"
  for broad in $BROAD_PATTERNS; do
    for p in $paths; do
      if [ "$p" = "$broad" ]; then
        echo "true"
        return
      fi
    done
  done
  echo "false"
}

# ─── Scan .claude/rules/core/ ──
CORE_DIR="$PROJECT/.claude/rules/core"
if [ -d "$CORE_DIR" ]; then
  while IFS= read -r filepath; do
    [ -z "$filepath" ] && continue
    [ ! -f "$filepath" ] && continue

    local_name=$(basename "$filepath")
    lines=$(file_lines "$filepath")
    bytes=$(file_bytes "$filepath")
    paths=$(extract_paths "$filepath")

    if [ -z "$paths" ]; then
      # Always-loaded (no paths: field)
      ALWAYS_LOADED=$(echo "$ALWAYS_LOADED" | jq \
        --arg file "$local_name" \
        --argjson lines "$lines" \
        --argjson bytes "$bytes" \
        '. + [{file: $file, lines: $lines, bytes: $bytes}]')
    else
      # Path-scoped
      broad=$(is_broad "$paths")

      # Convert paths to JSON array
      paths_json="[]"
      for p in $paths; do
        paths_json=$(echo "$paths_json" | jq --arg p "$p" '. + [$p]')
      done

      PATH_SCOPED=$(echo "$PATH_SCOPED" | jq \
        --arg file "$local_name" \
        --argjson lines "$lines" \
        --argjson bytes "$bytes" \
        --argjson paths "$paths_json" \
        --argjson broad "$([ "$broad" = "true" ] && echo 'true' || echo 'false')" \
        '. + [{file: $file, lines: $lines, bytes: $bytes, paths: $paths, broad: $broad}]')
    fi

  done <<EOF
$(find "$CORE_DIR" -name '*.md' -type f 2>/dev/null || true)
EOF
fi

# ─── CLAUDE.md ──
CLAUDE_MD="$PROJECT/CLAUDE.md"
CLAUDE_MD_JSON='{"lines": 0, "bytes": 0, "status": "MISSING"}'

if [ -f "$CLAUDE_MD" ]; then
  cm_lines=$(file_lines "$CLAUDE_MD")
  cm_bytes=$(file_bytes "$CLAUDE_MD")
  cm_status="PASS"
  if [ "$cm_lines" -gt "$CLAUDE_MD_LINE_LIMIT" ]; then
    cm_status="WARN"
  fi
  CLAUDE_MD_JSON=$(jq -n \
    --argjson lines "$cm_lines" \
    --argjson bytes "$cm_bytes" \
    --arg status "$cm_status" \
    '{lines: $lines, bytes: $bytes, status: $status}')
fi

# ─── Totals ──
al_lines=$(echo "$ALWAYS_LOADED" | jq '[.[].lines] | add // 0')
al_bytes=$(echo "$ALWAYS_LOADED" | jq '[.[].bytes] | add // 0')
cm_lines=$(echo "$CLAUDE_MD_JSON" | jq '.lines')
cm_bytes=$(echo "$CLAUDE_MD_JSON" | jq '.bytes')

total_lines=$((al_lines + cm_lines))
total_bytes=$((al_bytes + cm_bytes))

total_status="PASS"
if [ "$total_lines" -gt "$BUDGET_LINES" ] || [ "$total_bytes" -gt "$BUDGET_BYTES" ]; then
  total_status="WARN"
fi

TOTALS=$(jq -n \
  --argjson al_lines "$al_lines" \
  --argjson al_bytes "$al_bytes" \
  --argjson cm_lines "$cm_lines" \
  --argjson total_lines "$total_lines" \
  --argjson total_bytes "$total_bytes" \
  --argjson budget_lines "$BUDGET_LINES" \
  --argjson budget_bytes "$BUDGET_BYTES" \
  --arg status "$total_status" \
  '{
    always_loaded_lines: $al_lines,
    always_loaded_bytes: $al_bytes,
    claude_md_lines: $cm_lines,
    total_lines: $total_lines,
    total_bytes: $total_bytes,
    budget_lines: $budget_lines,
    budget_bytes: $budget_bytes,
    status: $status
  }')

# ─── Output ──
jq -n \
  --argjson al "$ALWAYS_LOADED" \
  --argjson ps "$PATH_SCOPED" \
  --argjson cm "$CLAUDE_MD_JSON" \
  --argjson totals "$TOTALS" \
  '{always_loaded: $al, path_scoped: $ps, claude_md: $cm, totals: $totals}'
