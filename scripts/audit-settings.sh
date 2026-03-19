#!/bin/bash
# version: 1.0.0
# Checks .claude/settings.json and .claude/settings.local.json for issues.
# Outputs JSON with permission_wildcards, stale_hooks, and deny_entries.
#
# Usage:
#   audit-settings.sh <project-path>
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: audit-settings.sh <project-path>

Checks .claude/settings.json and .claude/settings.local.json for issues:

  a) MCP permission wildcarding — non-wildcarded mcp__ entries in
     permissions.allow, grouped by server prefix with suggestion.
  b) Stale hook entries — hook commands referencing files that don't exist.
  c) Stale deny entries — lists permissions.deny entries as INFO.

Output: JSON object with {permission_wildcards, stale_hooks, deny_entries}

Requires: jq
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

PROJECT="${1:?Usage: audit-settings.sh <project-path>}"

if [ ! -d "$PROJECT" ]; then
  echo "Error: $PROJECT is not a directory." >&2
  exit 1
fi

# Resolve to absolute path
PROJECT=$(cd "$PROJECT" && pwd)

PERMISSION_WILDCARDS="[]"
STALE_HOOKS="[]"
DENY_ENTRIES="[]"

# ─── Helper: process a settings file ──
process_settings() {
  local settings_file="$1"
  local filename
  filename=$(basename "$settings_file")

  if [ ! -f "$settings_file" ]; then
    return
  fi

  local content
  content=$(cat "$settings_file")

  # ─── a) MCP permission wildcarding ──
  # Get all mcp__ entries from permissions.allow that don't end with *
  local mcp_entries
  mcp_entries=$(echo "$content" | jq -r '
    .permissions.allow // [] | .[] |
    select(startswith("mcp__")) |
    select(endswith("*") | not)
  ' 2>/dev/null || true)

  if [ -n "$mcp_entries" ]; then
    # Track which prefixes we've already suggested
    local seen_prefixes=""

    while IFS= read -r entry; do
      [ -z "$entry" ] && continue

      # Extract prefix: mcp__servername__ (up to and including the second __)
      local prefix
      # Get everything up to the last segment after the final __
      prefix=$(echo "$entry" | sed 's/\(mcp__[^_]*__\).*/\1/' 2>/dev/null || true)

      # If prefix extraction failed or equals entry, try alternate pattern
      if [ "$prefix" = "$entry" ] || [ -z "$prefix" ]; then
        # Try: everything up to and including second double-underscore
        prefix=$(echo "$entry" | awk -F'__' '{print $1 "__" $2 "__"}' 2>/dev/null || true)
      fi

      local suggested="${prefix}*"

      PERMISSION_WILDCARDS=$(echo "$PERMISSION_WILDCARDS" | jq \
        --arg file "$filename" \
        --arg entry "$entry" \
        --arg suggested "$suggested" \
        '. + [{file: $file, entry: $entry, suggested: $suggested, action: "WILDCARD"}]')

    done <<EOF
$mcp_entries
EOF
  fi

  # ─── b) Stale hook entries ──
  local hooks_json
  hooks_json=$(echo "$content" | jq -c '.hooks // {}' 2>/dev/null || echo '{}')

  if [ "$hooks_json" != "{}" ] && [ "$hooks_json" != "null" ]; then
    # Iterate over each hook event
    local events
    events=$(echo "$hooks_json" | jq -r 'keys[]' 2>/dev/null || true)

    while IFS= read -r event; do
      [ -z "$event" ] && continue

      # Each event has an array of hook configs
      local hook_count
      hook_count=$(echo "$hooks_json" | jq --arg e "$event" '.[$e] | length' 2>/dev/null || echo 0)

      local i=0
      while [ "$i" -lt "$hook_count" ]; do
        local hook_command
        hook_command=$(echo "$hooks_json" | jq -r --arg e "$event" --argjson i "$i" '.[$e][$i].command' 2>/dev/null || true)

        local hook_matcher
        hook_matcher=$(echo "$hooks_json" | jq -r --arg e "$event" --argjson i "$i" '.[$e][$i].matcher // ""' 2>/dev/null || true)

        if [ -n "$hook_command" ] && [ "$hook_command" != "null" ]; then
          local stale=""
          local check_path=""

          # Pattern 1: $CLAUDE_PROJECT_DIR/.claude/hooks/run.sh <hook-name>
          # Check if .claude/hooks/<hook-name>.mjs exists
          local hook_name
          hook_name=$(echo "$hook_command" | sed -n 's|.*\.claude/hooks/run\.sh \([^ ]*\).*|\1|p' 2>/dev/null || true)

          if [ -n "$hook_name" ]; then
            check_path="$PROJECT/.claude/hooks/${hook_name}.mjs"
            if [ ! -f "$check_path" ]; then
              # Also check without .mjs extension (might be the run.sh itself)
              local run_sh="$PROJECT/.claude/hooks/run.sh"
              if [ ! -f "$run_sh" ]; then
                stale="true"
                check_path="run.sh + ${hook_name}.mjs"
              else
                check_path="$PROJECT/.claude/hooks/${hook_name}.mjs"
                if [ ! -f "$check_path" ]; then
                  stale="true"
                  check_path="${hook_name}.mjs"
                fi
              fi
            fi
          else
            # Pattern 2: direct .sh or .mjs path
            local direct_path
            direct_path=$(echo "$hook_command" | grep -oE '[^ ]*\.(sh|mjs)' | head -1 || true)

            if [ -n "$direct_path" ]; then
              # Expand $CLAUDE_PROJECT_DIR
              local expanded
              expanded=$(echo "$direct_path" | sed "s|\\\$CLAUDE_PROJECT_DIR|$PROJECT|g; s|\\\${CLAUDE_PROJECT_DIR}|$PROJECT|g" 2>/dev/null || true)

              if [ -n "$expanded" ] && [ ! -f "$expanded" ]; then
                stale="true"
                check_path="$direct_path"
              fi
            fi
          fi

          if [ -n "$stale" ]; then
            STALE_HOOKS=$(echo "$STALE_HOOKS" | jq \
              --arg event "$event" \
              --arg matcher "$hook_matcher" \
              --arg command "$check_path" \
              '. + [{event: $event, matcher: $matcher, command: $command, status: "MISSING"}]')
          fi
        fi

        i=$((i + 1))
      done

    done <<EOF
$events
EOF
  fi

  # ─── c) Stale deny entries ──
  local deny_entries
  deny_entries=$(echo "$content" | jq -r '.permissions.deny // [] | .[]' 2>/dev/null || true)

  if [ -n "$deny_entries" ]; then
    while IFS= read -r entry; do
      [ -z "$entry" ] && continue
      DENY_ENTRIES=$(echo "$DENY_ENTRIES" | jq \
        --arg file "$filename" \
        --arg entry "$entry" \
        '. + [{file: $file, entry: $entry, severity: "INFO"}]')
    done <<EOF
$deny_entries
EOF
  fi
}

# Process both settings files
process_settings "$PROJECT/.claude/settings.json"
process_settings "$PROJECT/.claude/settings.local.json"

# Output combined result
jq -n \
  --argjson pw "$PERMISSION_WILDCARDS" \
  --argjson sh "$STALE_HOOKS" \
  --argjson de "$DENY_ENTRIES" \
  '{permission_wildcards: $pw, stale_hooks: $sh, deny_entries: $de}'
