#!/bin/bash
# version: 2.0.0
# Runs CLAUDE.md drift checks (S-series structural + C-series content) against a target project.
# Outputs JSON array of check results.
#
# Usage:
#   drift-check.sh <project-path>
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: drift-check.sh <project-path>

Checks:
  S1  Required headings exist (## Commands, ## Architecture, ## Rules,
      ## Vendor Knowledge or alias, ### Knowledge accumulation)
  S2  No legacy section names (## Vendor Memory Loading, ## MCP Tools:)
  C1  Rules intro references .claude/rules/core/
  C2  Vendor Knowledge has a domain table
  C4  Knowledge accumulation references the project wiki (wiki.sh / pitfall)
  C5  No inlined MCP tool instructions (no ## MCP Tools section)

Output: JSON array of {id, status, severity, detail}

Requires: jq
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

PROJECT="${1:?Usage: drift-check.sh <project-path>}"
shift

CLAUDE_MD="$PROJECT/CLAUDE.md"
if [ ! -f "$CLAUDE_MD" ]; then
  echo '[{"id":"S0","status":"FAIL","severity":"MISSING","detail":"CLAUDE.md not found"}]'
  exit 0
fi

CONTENT=$(cat "$CLAUDE_MD")

# ─── Helper: extract section content between heading and next same/higher-level heading ──
section_content() {
  local heading_pattern="$1"
  local level="$2"
  echo "$CONTENT" | awk -v pat="$heading_pattern" -v lvl="$level" '
    $0 ~ pat { found=1; next }
    found && /^#{1,}[[:space:]]/ {
      # Count heading level
      match($0, /^#+/)
      hl = RLENGTH
      if (hl <= lvl) exit
    }
    found { print }
  '
}

# ─── Vendor Knowledge heading aliases ──
VK_ALIASES='## Vendor Knowledge|## Vendor Docs'

# Start results array
RESULTS="[]"

add_result() {
  local id="$1" status="$2" severity="$3" detail="$4"
  RESULTS=$(echo "$RESULTS" | jq \
    --arg id "$id" \
    --arg status "$status" \
    --arg severity "$severity" \
    --arg detail "$detail" \
    '. + [{id: $id, status: $status, severity: $severity, detail: $detail}]')
}

# ─── S1: Required headings ──
REQUIRED_H2="## Commands|## Architecture|## Rules"
REQUIRED_H3="### Knowledge accumulation"

missing_h2=""
for heading in "## Commands" "## Architecture" "## Rules"; do
  if ! echo "$CONTENT" | grep -q "^${heading}$"; then
    missing_h2="${missing_h2:+$missing_h2, }${heading}"
  fi
done

# Check Vendor Knowledge (with aliases)
vk_found=""
vk_alias=""
for alias in "## Vendor Knowledge" "## Vendor Docs"; do
  if echo "$CONTENT" | grep -q "^${alias}"; then
    vk_found="true"
    if [ "$alias" != "## Vendor Knowledge" ]; then
      vk_alias="$alias"
    fi
    break
  fi
done
if [ -z "$vk_found" ]; then
  missing_h2="${missing_h2:+$missing_h2, }## Vendor Knowledge"
fi

# Check ### Knowledge accumulation
missing_h3=""
if ! echo "$CONTENT" | grep -q "^### Knowledge accumulation"; then
  missing_h3="### Knowledge accumulation"
fi

if [ -z "$missing_h2" ] && [ -z "$missing_h3" ]; then
  detail="All required headings present"
  if [ -n "$vk_alias" ]; then
    detail="$detail (Vendor Knowledge uses alias: $vk_alias)"
  fi
  add_result "S1" "PASS" "OK" "$detail"
else
  missing="${missing_h2}${missing_h2:+${missing_h3:+, }}${missing_h3}"
  add_result "S1" "FAIL" "MISSING" "Missing: $missing"
fi

# ─── S2: Legacy section names ──
legacy_found=""
for legacy in "## Vendor Memory Loading" "## MCP Tools:"; do
  if echo "$CONTENT" | grep -q "^${legacy}"; then
    legacy_found="${legacy_found:+$legacy_found, }${legacy}"
  fi
done
if [ -z "$legacy_found" ]; then
  add_result "S2" "PASS" "OK" "No legacy section names found"
else
  add_result "S2" "FAIL" "WARN" "Legacy sections: $legacy_found"
fi

# ─── C1: Rules intro references core rules ──
rules_section=$(section_content "^## Rules" 2)
if echo "$rules_section" | grep -q '\.claude/rules/core/'; then
  add_result "C1" "PASS" "OK" "Rules section references .claude/rules/core/"
else
  add_result "C1" "FAIL" "WARN" "Rules section does not reference .claude/rules/core/"
fi

# ─── C2: Vendor Knowledge has domain table ──
vk_section=""
if [ -n "$vk_found" ]; then
  for alias in "## Vendor Knowledge" "## Vendor Docs"; do
    if echo "$CONTENT" | grep -q "^${alias}"; then
      vk_section=$(section_content "^${alias}" 2)
      break
    fi
  done
fi

# The Vendor Knowledge section should contain a domain table (a markdown table row).
if [ -n "$vk_section" ] && echo "$vk_section" | grep -qE '^\|.*\|'; then
  add_result "C2" "PASS" "OK" "Vendor Knowledge section has a domain table"
else
  add_result "C2" "FAIL" "WARN" "Vendor Knowledge section missing its domain table"
fi

# ─── C4: Knowledge accumulation references the project wiki ──
ka_section=$(section_content "^### Knowledge accumulation" 3)
if echo "$ka_section" | grep -qE 'wiki\.sh|rules/project|pitfall'; then
  add_result "C4" "PASS" "OK" "Knowledge accumulation references the project wiki"
else
  add_result "C4" "FAIL" "WARN" "Knowledge accumulation section should reference the wiki (wiki.sh / .claude/rules/project / pitfall)"
fi

# ─── C5: No inlined MCP tool instructions ──
if echo "$CONTENT" | grep -q "^## MCP Tools"; then
  add_result "C5" "FAIL" "INFO" "Found ## MCP Tools section — should be in .claude/rules/core/mcp-tools.md instead"
else
  add_result "C5" "PASS" "OK" "No inlined MCP tool instructions"
fi

echo "$RESULTS" | jq .
