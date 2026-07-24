#!/bin/bash
# version: 1.0.0
# Regenerates the template and hook inventories embedded in SKILL.md.
#
# SKILL.md used to hand-maintain four tables covering ~50 files (always-loaded rules,
# a per-file line budget, path-scoped rules, and the hook dispatch table). All four
# drifted from disk — wrong line counts, a path-scoped rule listed as always-loaded,
# two templates missing entirely, three hooks that no longer exist. Anything derivable
# from disk is generated here instead of typed.
#
# Usage:
#   gen-inventory.sh            # print the generated blocks to stdout
#   gen-inventory.sh --write    # rewrite the marked blocks in SKILL.md in place
#   gen-inventory.sh --check    # exit 1 if SKILL.md is out of date (for CI)
#
# Blocks in SKILL.md are delimited by:
#   <!-- generated:<name> --> ... <!-- /generated:<name> -->
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL_MD="$SKILL_DIR/SKILL.md"
SETTINGS="$SKILL_DIR/.claude/settings.json"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

MODE="${1:-print}"

# ─── Helper: extract the YAML frontmatter block of a markdown file ──
frontmatter() {
  awk 'NR==1 && /^---$/ {found=1; next} found && /^---$/ {exit} found {print}' "$1" 2>/dev/null || true
}

# ─── Helper: read a scalar frontmatter field ──
fm_field() {
  frontmatter "$1" | grep "^$2:" | head -1 | sed "s/^$2: *//" | sed 's/[[:space:]]*$//'
}

# ─── Helper: does the file declare a non-empty paths: list? ──
# A rule with paths: is path-scoped (loads only for matching files). Without it,
# Claude Code injects the file every turn — that is what the budget measures.
has_paths() {
  frontmatter "$1" | grep -q '^paths:'
}

# ─── Helper: render paths: as a comma-separated one-liner ──
paths_inline() {
  frontmatter "$1" | awk '
    /^paths:/ { inp=1; next }
    inp && /^[[:space:]]*-[[:space:]]/ {
      line=$0
      sub(/^[[:space:]]*-[[:space:]]*/, "", line)
      gsub(/^["'"'"']|["'"'"']$/, "", line)
      out = (out == "" ? line : out ", " line)
      next
    }
    inp && /^[a-zA-Z]/ { exit }
    END { print out }
  '
}

# ─── Helper: portable byte size ──
file_bytes() {
  if [ "$(uname)" = "Darwin" ]; then
    stat -f%z "$1" 2>/dev/null || echo 0
  else
    stat -c%s "$1" 2>/dev/null || echo 0
  fi
}

# ─── Block: always-loaded rules + budget ──
gen_budget() {
  local total_lines=0 total_bytes=0 f name lines bytes desc
  echo "| Rule | Lines | Bytes | Tags |"
  echo "|------|-------|-------|------|"
  for f in $(find "$SKILL_DIR/core" -name '*.md' | sort); do
    has_paths "$f" && continue
    name="${f#$SKILL_DIR/core/}"; name="${name%.md}"
    lines=$(wc -l < "$f" | tr -d ' ')
    bytes=$(file_bytes "$f")
    desc=$(fm_field "$f" tags | sed 's/^\[//; s/\]$//')
    total_lines=$((total_lines + lines))
    total_bytes=$((total_bytes + bytes))
    printf '| `%s` | %s | %s | %s |\n' "$name" "$lines" "$bytes" "$desc"
  done
  echo "| **Total** | **$total_lines** | **$total_bytes** (~$((total_bytes / 1024)) KB) | per-turn baseline |"
  echo
  echo "Budget in \`scripts/context-budget.sh\`: 850 lines / 20480 bytes."
  if [ "$total_bytes" -gt 20480 ]; then
    echo "**Currently over budget** by $((total_bytes - 20480)) bytes. Path-scope or trim before adding more."
  else
    echo "Currently within budget."
  fi
}

# ─── Block: path-scoped rules ──
gen_scoped() {
  local f name globs
  echo "| Rule | Loads when you touch |"
  echo "|------|----------------------|"
  for f in $(find "$SKILL_DIR/core" -name '*.md' | sort); do
    has_paths "$f" || continue
    name="${f#$SKILL_DIR/core/}"; name="${name%.md}"
    globs=$(paths_inline "$f")
    printf '| `%s` | `%s` |\n' "$name" "$globs"
  done
}

# ─── Helper: a hook's purpose, read from its own line 2 ──
# Convention: line 1 is `// version:`, line 2 is a one-sentence `//` comment saying
# what the hook does. Keeping it next to the implementation is why it stays true —
# the SKILL.md copy did not.
# The trailing `|| true` is load-bearing: under `set -euo pipefail`, grep exiting 1
# on a hook whose line 2 is an import (not a comment) makes the enclosing
# `p=$(hook_purpose ...)` assignment fail, which aborts the whole script. A hook
# without a description should render as "—", not kill the generator.
hook_purpose() {
  sed -n '2p' "$1" 2>/dev/null \
    | grep '^//' \
    | grep -v '^// version:' \
    | sed 's|^// *||; s/[[:space:]]*$//' \
    | sed 's/|/\\|/g' \
    || true
}

# ─── Block: hook dispatch table ──
# Source of truth is settings.json, not a hand-kept list: a hook that is not
# dispatched there does not run, whatever the docs say.
gen_hooks() {
  echo "| Hook | File | Event / Matcher | Purpose |"
  echo "|------|------|-----------------|---------|"
  jq -r '
    .hooks | to_entries[] as $ev
    | $ev.value[] as $m
    | $m.hooks[]
    | select(.command | test("run\\.sh"))
    | [ (.command | capture("run\\.sh +(?<n>[A-Za-z0-9._-]+)").n),
        $ev.key,
        ($m.matcher // "—") ]
    | @tsv
  ' "$SETTINGS" | sort -u | while IFS=$'\t' read -r name event matcher; do
    if [ -f "$SKILL_DIR/.claude/hooks/$name.ts" ]; then
      file="$name.ts"
    elif [ -f "$SKILL_DIR/.claude/hooks/$name.mjs" ]; then
      file="$name.mjs"
    else
      file="**MISSING**"
    fi
    purpose=$(hook_purpose "$SKILL_DIR/.claude/hooks/$file")
    [ -z "$purpose" ] && purpose="—"
    # Matchers like Edit|Write contain a pipe, which splits a markdown table cell
    # even inside backticks. Escape it.
    matcher=$(printf '%s' "$matcher" | sed 's/|/\\|/g')
    printf '| %s | `%s` | %s / `%s` | %s |\n' "$name" "$file" "$event" "$matcher" "$purpose"
  done
}

# ─── Assemble ──
render_block() {
  case "$1" in
    budget) gen_budget ;;
    scoped) gen_scoped ;;
    hooks)  gen_hooks ;;
  esac
}

BLOCKS="budget scoped hooks"

if [ "$MODE" = "print" ]; then
  for b in $BLOCKS; do
    echo "<!-- generated:$b -->"
    render_block "$b"
    echo "<!-- /generated:$b -->"
    echo
  done
  exit 0
fi

# --write / --check both need the rewritten file
TMP=$(mktemp)
trap 'rm -f "$TMP" "$TMP.block"' EXIT
cp "$SKILL_MD" "$TMP"

for b in $BLOCKS; do
  if ! grep -q "<!-- generated:$b -->" "$TMP"; then
    echo "Error: SKILL.md has no <!-- generated:$b --> marker." >&2
    exit 1
  fi
  render_block "$b" > "$TMP.block"
  # Replace everything between the markers, exclusive.
  awk -v blk="$b" -v bf="$TMP.block" '
    $0 ~ "<!-- generated:" blk " -->" { print; while ((getline line < bf) > 0) print line; skip=1; next }
    $0 ~ "<!-- /generated:" blk " -->" { skip=0 }
    !skip { print }
  ' "$TMP" > "$TMP.new"
  mv "$TMP.new" "$TMP"
done

if [ "$MODE" = "--check" ]; then
  if cmp -s "$TMP" "$SKILL_MD"; then
    echo "SKILL.md inventories are up to date."
    exit 0
  fi
  echo "SKILL.md inventories are STALE. Run: scripts/gen-inventory.sh --write" >&2
  diff -u "$SKILL_MD" "$TMP" | head -40 >&2 || true
  exit 1
fi

if [ "$MODE" = "--write" ]; then
  mv "$TMP" "$SKILL_MD"
  trap - EXIT
  rm -f "$TMP.block"
  echo "SKILL.md inventories regenerated."
  exit 0
fi

echo "Unknown mode: $MODE (expected --write, --check, or no argument)" >&2
exit 2
