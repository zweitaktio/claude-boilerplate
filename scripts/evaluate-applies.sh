#!/bin/bash
# version: 1.2.0
# Evaluate which templates apply to a target project based on its package.json.
# Outputs JSON array of {template, target, applies, matches, reason}.
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Help ---
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: $(basename "$0") <project-path>"
  echo ""
  echo "Evaluate which webstack templates apply to a target project."
  echo "Reads package.json from the project root and/or workspace"
  echo "subdirectories (1 level deep) and checks each template's"
  echo "'applies' frontmatter condition against installed packages."
  echo ""
  echo "Arguments:"
  echo "  project-path    Path to the target project root (or monorepo root)"
  echo ""
  echo "Output:"
  echo "  JSON array to stdout with fields: template, target, applies, matches, reason"
  echo ""
  echo "Requires: jq"
  exit 0
fi

# --- Validate args ---
PROJECT_PATH="${1:-}"
if [ -z "$PROJECT_PATH" ]; then
  echo "Error: project path required. Run with --help for usage." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not found. Install with: brew install jq" >&2
  exit 1
fi

# --- Discover package.json files (root + 1 level deep for monorepos) ---
PKG_FILES=""
if [ -f "$PROJECT_PATH/package.json" ]; then
  PKG_FILES="$PROJECT_PATH/package.json"
fi

for f in "$PROJECT_PATH"/*/package.json; do
  [ -f "$f" ] || continue
  PKG_FILES="${PKG_FILES}${PKG_FILES:+ }$f"
done

if [ -z "$PKG_FILES" ]; then
  echo "Error: No package.json found in $PROJECT_PATH or its subdirectories." >&2
  exit 1
fi

# --- Collect enabled plugins from .claude/settings*.json ---
PLUGINS_JSON="{}"
for sf in "$PROJECT_PATH/.claude/settings.json" "$PROJECT_PATH/.claude/settings.local.json"; do
  [ -f "$sf" ] || continue
  merged=$(jq -s '.[0] * (.[1] | .enabledPlugins // {})' \
    <(echo "$PLUGINS_JSON") <(cat "$sf") 2>/dev/null) && PLUGINS_JSON="$merged"
done

# --- Helper: check if a plugin is enabled ---
plugin_exists() {
  local name="$1"
  # Match any enabledPlugins key starting with "name@" that is true
  echo "$PLUGINS_JSON" | jq -e --arg n "$name" 'to_entries | any(.key | startswith($n + "@")) and any(select(.key | startswith($n + "@")).value)' >/dev/null 2>&1
}

# --- Merge deps from all package.json files, strip version prefixes ---
DEPS_JSON=$(echo "$PKG_FILES" | tr ' ' '\n' | while read -r pf; do
  jq -r '((.dependencies // {}) + (.devDependencies // {}))' "$pf"
done | jq -s 'add | to_entries | map({key: .key, value: (.value | gsub("^[~^>=]*"; ""))}) | from_entries')

# --- Helper: check if a package exists in deps ---
pkg_exists() {
  local pkg="$1"
  # Handle quoted package names (e.g., "@playwright/test")
  pkg=$(echo "$pkg" | sed 's/^"//;s/"$//')
  echo "$DEPS_JSON" | jq -e --arg p "$pkg" 'has($p)' >/dev/null 2>&1
}

# --- Helper: get package version from deps ---
pkg_version() {
  local pkg="$1"
  pkg=$(echo "$pkg" | sed 's/^"//;s/"$//')
  echo "$DEPS_JSON" | jq -r --arg p "$pkg" '.[$p] // ""'
}

# --- Helper: compare semver a >= b (numeric, same major only) ---
semver_gte() {
  local ver="$1"  # installed version
  local min="$2"  # minimum version

  local ver_major ver_minor ver_patch
  local min_major min_minor min_patch

  ver_major=$(echo "$ver" | cut -d. -f1)
  ver_minor=$(echo "$ver" | cut -d. -f2)
  ver_patch=$(echo "$ver" | cut -d. -f3 | sed 's/[^0-9].*//')

  min_major=$(echo "$min" | cut -d. -f1)
  min_minor=$(echo "$min" | cut -d. -f2)
  min_patch=$(echo "$min" | cut -d. -f3 | sed 's/[^0-9].*//')

  # Default missing parts to 0
  ver_minor="${ver_minor:-0}"
  ver_patch="${ver_patch:-0}"
  min_minor="${min_minor:-0}"
  min_patch="${min_patch:-0}"

  # Must be same major
  if [ "$ver_major" != "$min_major" ]; then
    return 1
  fi

  # Compare minor
  if [ "$ver_minor" -gt "$min_minor" ] 2>/dev/null; then
    return 0
  elif [ "$ver_minor" -lt "$min_minor" ] 2>/dev/null; then
    return 1
  fi

  # Compare patch
  if [ "$ver_patch" -ge "$min_patch" ] 2>/dev/null; then
    return 0
  fi

  return 1
}

# --- Helper: split condition into package name and version spec ---
# Handles scoped packages (@scope/pkg@version) by splitting on last @
split_pkg_version() {
  local cond="$1"
  # Strip surrounding quotes before parsing
  cond=$(echo "$cond" | sed 's/^"//;s/"$//')
  # Check if string ends with @<version-like> (digits, dots, plus)
  if echo "$cond" | grep -qE '@[0-9][0-9.+]*$'; then
    PKG_NAME=$(echo "$cond" | sed 's/@[^@]*$//')
    PKG_VER=$(echo "$cond" | sed 's/.*@//')
  else
    PKG_NAME="$cond"
    PKG_VER=""
  fi
}

# --- Helper: evaluate a single atomic condition ---
# Returns 0 (match) or 1 (no match), sets REASON global
eval_condition() {
  local cond="$1"

  # Trim whitespace
  cond=$(echo "$cond" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  # Always
  if [ "$cond" = "Always" ]; then
    REASON="Always applies"
    return 0
  fi

  # Directory check (starts with .)
  if echo "$cond" | grep -q '^\.' ; then
    if [ -d "$PROJECT_PATH/$cond" ]; then
      REASON="Directory $cond exists"
      return 0
    else
      REASON="Directory $cond not found"
      return 1
    fi
  fi

  # Split into package name and version spec (handles @scope/pkg@ver)
  split_pkg_version "$cond"

  # Package with version range: X.Y.Z+
  if echo "$PKG_VER" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\+$'; then
    local ver_min
    ver_min=$(echo "$PKG_VER" | sed 's/+$//')

    if ! pkg_exists "$PKG_NAME"; then
      REASON="$PKG_NAME not in dependencies"
      return 1
    fi

    local installed
    installed=$(pkg_version "$PKG_NAME")

    if semver_gte "$installed" "$ver_min"; then
      REASON="${PKG_NAME}@${installed} >= ${ver_min}"
      return 0
    else
      REASON="${PKG_NAME}@${installed} < ${ver_min}"
      return 1
    fi
  fi

  # Package with major version: N
  if echo "$PKG_VER" | grep -qE '^[0-9]+$'; then
    local major="$PKG_VER"

    if ! pkg_exists "$PKG_NAME"; then
      REASON="$PKG_NAME not in dependencies"
      return 1
    fi

    local installed
    installed=$(pkg_version "$PKG_NAME")
    local inst_major
    inst_major=$(echo "$installed" | cut -d. -f1)

    if [ "$inst_major" = "$major" ]; then
      REASON="${PKG_NAME}@${installed} starts with ${major}."
      return 0
    else
      REASON="${PKG_NAME}@${installed} does not start with ${major}."
      return 1
    fi
  fi

  # Plain name (no version spec) — check package.json first, then plugins
  if pkg_exists "$PKG_NAME"; then
    local installed
    installed=$(pkg_version "$PKG_NAME")
    REASON="${PKG_NAME}@${installed} in dependencies"
    return 0
  elif plugin_exists "$PKG_NAME"; then
    REASON="${PKG_NAME} plugin enabled"
    return 0
  else
    REASON="$PKG_NAME not in dependencies or plugins"
    return 1
  fi
}

# --- Helper: evaluate a full applies expression (supports | and &) ---
eval_applies() {
  local expr="$1"

  # AND operator: a & b
  if echo "$expr" | grep -q ' & '; then
    local all_reasons=""
    local result=0

    # Split on &
    local IFS_OLD="$IFS"
    local remaining="$expr"
    while [ -n "$remaining" ]; do
      local part
      part=$(echo "$remaining" | sed 's/ & .*//')
      remaining=$(echo "$remaining" | sed 's/^[^&]*&[[:space:]]*//')
      if [ "$part" = "$remaining" ]; then
        remaining=""
      fi

      if eval_condition "$part"; then
        all_reasons="${all_reasons}${all_reasons:+; }$REASON"
      else
        all_reasons="${all_reasons}${all_reasons:+; }$REASON"
        result=1
      fi
    done

    REASON="$all_reasons"
    return $result
  fi

  # OR operator: a | b
  if echo "$expr" | grep -q ' | '; then
    local any_matched=1
    local all_reasons=""

    local remaining="$expr"
    while [ -n "$remaining" ]; do
      local part
      part=$(echo "$remaining" | sed 's/ | .*//')
      remaining=$(echo "$remaining" | sed 's/^[^|]*|[[:space:]]*//')
      if [ "$part" = "$remaining" ]; then
        remaining=""
      fi

      if eval_condition "$part"; then
        all_reasons="${all_reasons}${all_reasons:+; }$REASON"
        any_matched=0
      else
        all_reasons="${all_reasons}${all_reasons:+; }$REASON"
      fi
    done

    REASON="$all_reasons"
    return $any_matched
  fi

  # Single condition
  eval_condition "$expr"
  return $?
}

# --- Extract applies and target from frontmatter ---
extract_frontmatter() {
  local file="$1"
  local field="$2"

  # Read between first --- pair, extract field
  sed -n '/^---$/,/^---$/p' "$file" | grep "^${field}:" | sed "s/^${field}:[[:space:]]*//" | head -1
}

# --- Main: scan all templates ---
FIRST=true
echo "["

find "$SKILL_DIR/core" "$SKILL_DIR/vendor" -name '*.md' -type f | sort | while read -r template; do
  # Get relative path from skill dir
  rel_path="${template#$SKILL_DIR/}"

  # Extract frontmatter fields
  applies=$(extract_frontmatter "$template" "applies")
  target=$(extract_frontmatter "$template" "target")

  # Skip files without applies (not templates)
  if [ -z "$applies" ]; then
    continue
  fi

  # Evaluate
  REASON=""
  if eval_applies "$applies"; then
    matches="true"
  else
    matches="false"
  fi

  # Output JSON object
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo ","
  fi

  # Use jq for safe JSON encoding
  jq -n \
    --arg template "$rel_path" \
    --arg target "${target:-unknown}" \
    --arg applies "$applies" \
    --argjson matches "$matches" \
    --arg reason "$REASON" \
    '{template: $template, target: $target, applies: $applies, matches: $matches, reason: $reason}'
done

echo ""
echo "]"
