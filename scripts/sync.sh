#!/bin/bash
# version: 1.0.0
# Deterministic sync of webstack assets to target projects.
# Reads manifest.json to enumerate deployable asset groups, compares versions,
# and deploys files idempotently.
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq and node/bun.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SKILL_DIR/manifest.json"

# ─── Help ─────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: sync.sh <command> <target-project-path> [options]

Commands:
  compare    Output JSON action table (dry-run)
  apply      Deploy assets and output JSON summary

Options:
  --group <name>   Filter to specific asset group(s), comma-separated
  --sha <sha>      Override stored SHA for change detection

Groups: hooks, hook-infra, rules, vendor, settings, configs, scaffold

Output:
  JSON array to stdout. Each entry has: group, file, action, and
  optional fields: from, to, version, reason, entity.

Actions:
  CREATE   — file doesn't exist in target
  UPDATE   — source version is newer
  SKIP     — versions match, no changes
  REVIEW   — versions match but git SHA shows content changed
  REPLACE  — target has no version (legacy)
  MERGE    — settings.json hook key merge
  CHECK_KG — vendor doc, requires MCP deployment

Requires: jq, node or bun
EOF
  exit 0
fi

# ─── Validate args ────────────────────────────────────────────────────────────
COMMAND="${1:-}"
if [ "$COMMAND" != "compare" ] && [ "$COMMAND" != "apply" ]; then
  echo "Error: command must be 'compare' or 'apply'. Run with --help." >&2
  exit 1
fi

TARGET_PATH="${2:-}"
if [ -z "$TARGET_PATH" ]; then
  echo "Error: target project path required." >&2
  exit 1
fi
TARGET_PATH="$(cd "$TARGET_PATH" && pwd)"

GROUP_FILTER=""
SHA_OVERRIDE=""
shift 2
while [ $# -gt 0 ]; do
  case "$1" in
    --group) GROUP_FILTER="$2"; shift 2 ;;
    --sha) SHA_OVERRIDE="$2"; shift 2 ;;
    *) echo "Error: unknown option: $1" >&2; exit 1 ;;
  esac
done

# ─── Dependency checks ───────────────────────────────────────────────────────
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq required. Install: brew install jq" >&2
  exit 1
fi

NODE_CMD=""
if command -v bun >/dev/null 2>&1; then
  NODE_CMD="bun"
elif command -v node >/dev/null 2>&1; then
  NODE_CMD="node"
else
  echo "Error: node or bun required." >&2
  exit 1
fi

# ─── Temp files ───────────────────────────────────────────────────────────────
ENTRIES_FILE=$(mktemp)
APPLIES_TMP=$(mktemp)
FILES_TMP=$(mktemp)
trap 'rm -f "$ENTRIES_FILE" "$APPLIES_TMP" "$FILES_TMP"' EXIT

# ─── Version extraction ──────────────────────────────────────────────────────
extract_comment_version() {
  local file="$1"
  if [ ! -f "$file" ]; then echo ""; return; fi
  case "${file##*.}" in
    sh) sed -n '2s/^# version: *//p' "$file" ;;
    *)  sed -n '1s/^\/\/ version: *//p' "$file" ;;
  esac
}

extract_frontmatter_version() {
  local file="$1"
  if [ ! -f "$file" ]; then echo ""; return; fi
  sed -n '/^---$/,/^---$/s/^version: *//p' "$file" | head -1
}

extract_frontmatter_domain() {
  local file="$1"
  if [ ! -f "$file" ]; then echo ""; return; fi
  sed -n '/^---$/,/^---$/s/^domain: *//p' "$file" | head -1
}

file_checksum() {
  if [ ! -f "$1" ]; then echo ""; return; fi
  shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1
}

# ─── SHA change detection ────────────────────────────────────────────────────
SHA_CHANGED_FILES=""

load_sha_changes() {
  local stored_sha="${SHA_OVERRIDE:-}"
  if [ -z "$stored_sha" ] && [ -f "$TARGET_PATH/.claude/webstack.sha" ]; then
    stored_sha=$(cat "$TARGET_PATH/.claude/webstack.sha")
  fi
  if [ -n "$stored_sha" ]; then
    SHA_CHANGED_FILES=$(git -C "$SKILL_DIR" log --name-only --pretty=format: \
      "$stored_sha..HEAD" -- core/ vendor/ .claude/hooks/ 2>/dev/null | \
      sort -u | grep -v '^$' || true)
  fi
}

sha_file_changed() {
  local rel_path="$1"
  if [ -z "$SHA_CHANGED_FILES" ]; then return 1; fi
  echo "$SHA_CHANGED_FILES" | grep -qxF "$rel_path" 2>/dev/null
}

# ─── Conditional applicability ────────────────────────────────────────────────
APPLIES_LOADED="false"

load_applies() {
  if [ "$APPLIES_LOADED" = "true" ]; then return; fi
  APPLIES_LOADED="true"
  if [ -x "$SCRIPT_DIR/evaluate-applies.sh" ]; then
    "$SCRIPT_DIR/evaluate-applies.sh" "$TARGET_PATH" > "$APPLIES_TMP" 2>/dev/null || echo "[]" > "$APPLIES_TMP"
  else
    echo "[]" > "$APPLIES_TMP"
  fi
}

template_matches() {
  local template="$1"
  jq -e --arg t "$template" \
    'map(select(.template == $t)) | length > 0 and .[0].matches' \
    "$APPLIES_TMP" >/dev/null 2>&1
}

# ─── Group filter ─────────────────────────────────────────────────────────────
group_included() {
  local name="$1"
  if [ -z "$GROUP_FILTER" ]; then return 0; fi
  echo ",$GROUP_FILTER," | grep -q ",$name," 2>/dev/null
}

# ─── Action determination ────────────────────────────────────────────────────
determine_action() {
  local src_file="$1"
  local tgt_file="$2"
  local versioning="$3"

  if [ ! -f "$tgt_file" ]; then
    echo "CREATE"
    return
  fi

  case "$versioning" in
    comment)
      local src_ver tgt_ver
      src_ver=$(extract_comment_version "$src_file")
      tgt_ver=$(extract_comment_version "$tgt_file")
      if [ -z "$tgt_ver" ]; then
        echo "REPLACE"
      elif [ "$src_ver" = "$tgt_ver" ]; then
        local rel="${src_file#$SKILL_DIR/}"
        if sha_file_changed "$rel"; then echo "REVIEW"; else echo "SKIP"; fi
      else
        echo "UPDATE"
      fi
      ;;
    frontmatter)
      local src_ver tgt_ver
      src_ver=$(extract_frontmatter_version "$src_file")
      tgt_ver=$(extract_frontmatter_version "$tgt_file")
      if [ -z "$tgt_ver" ]; then
        echo "REPLACE"
      elif [ "$src_ver" = "$tgt_ver" ]; then
        local rel="${src_file#$SKILL_DIR/}"
        if sha_file_changed "$rel"; then echo "REVIEW"; else echo "SKIP"; fi
      else
        echo "UPDATE"
      fi
      ;;
    checksum|overwrite)
      local src_sum tgt_sum
      src_sum=$(file_checksum "$src_file")
      tgt_sum=$(file_checksum "$tgt_file")
      if [ "$src_sum" = "$tgt_sum" ]; then
        echo "SKIP"
      else
        echo "UPDATE"
      fi
      ;;
    no-clobber)
      echo "SKIP"
      ;;
  esac
}

# ─── File deployment ──────────────────────────────────────────────────────────
deploy_file() {
  local src="$1"
  local tgt="$2"
  local do_chmod="${3:-false}"

  mkdir -p "$(dirname "$tgt")"
  cp "$src" "$tgt"
  if [ "$do_chmod" = "true" ]; then
    chmod +x "$tgt"
  fi
}

# ─── File enumeration ─────────────────────────────────────────────────────────
enumerate_files() {
  local src_dir="$1"
  local group_json="$2"

  local includes excludes
  includes=$(echo "$group_json" | jq -r '.include[]? // empty')
  excludes=$(echo "$group_json" | jq -r '.exclude[]? // empty')

  : > "$FILES_TMP"

  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    case "$pattern" in
      \*\*/*)
        local name_pat="${pattern#**/}"
        find "$src_dir" -name "$name_pat" -type f 2>/dev/null >> "$FILES_TMP" || true
        ;;
      */*)
        local subdir="${pattern%/*}"
        local name_pat="${pattern#*/}"
        find "$src_dir/$subdir" -maxdepth 1 -name "$name_pat" -type f 2>/dev/null >> "$FILES_TMP" || true
        ;;
      *)
        find "$src_dir" -maxdepth 1 -name "$pattern" -type f 2>/dev/null >> "$FILES_TMP" || true
        ;;
    esac
  done <<EOF
$includes
EOF

  # Apply excludes
  if [ -n "$excludes" ]; then
    local excl_re=""
    while IFS= read -r ex; do
      [ -z "$ex" ] && continue
      if [ -n "$excl_re" ]; then excl_re="$excl_re|"; fi
      excl_re="${excl_re}${ex}"
    done <<EOF2
$excludes
EOF2
    if [ -n "$excl_re" ]; then
      grep -v -E "/(${excl_re})$" "$FILES_TMP" | sort -u || true
    else
      sort -u "$FILES_TMP"
    fi
  else
    sort -u "$FILES_TMP"
  fi
}

# ─── Vendor entity name ──────────────────────────────────────────────────────
vendor_entity_name() {
  local file="$1"
  local name="${file#vendor/}"
  name="${name%.md}"
  # Strip leading underscore from _index segments (becomes "index" → "Index" in PascalCase)
  name=$(echo "$name" | sed 's/_index$/index/')
  # Convert kebab-case/slashes to PascalCase
  # Split on - and /, capitalize each word
  local result="Vendor"
  local IFS='-/'
  for part in $name; do
    local first rest
    first=$(echo "$part" | cut -c1 | tr '[:lower:]' '[:upper:]')
    rest=$(echo "$part" | cut -c2-)
    result="${result}${first}${rest}"
  done
  echo "$result"
}

# ─── Settings merge ──────────────────────────────────────────────────────────
run_settings_merge() {
  local src_file="$1"
  local tgt_path="$2"
  local dry_run="$3"

  mkdir -p "$tgt_path/.claude"

  $NODE_CMD -e '
const fs = require("fs");
const [srcFile, tgtDir, dryRun] = process.argv.slice(1);
const tgtFile = tgtDir + "/.claude/settings.json";

const src = JSON.parse(fs.readFileSync(srcFile, "utf8"));
let tgt = {};
try { tgt = JSON.parse(fs.readFileSync(tgtFile, "utf8")); } catch(e) {}

const isWs = cmd => cmd && cmd.includes(".claude/hooks/");
const stats = { added: 0, updated: 0, preserved: 0 };

// Build merged hooks
const mergedHooks = {};

// Process events in source
for (const [event, srcEntries] of Object.entries(src.hooks || {})) {
  const tgtEntries = (tgt.hooks || {})[event] || [];

  // Keep project-specific entries from target
  const kept = tgtEntries.filter(e =>
    e.hooks && e.hooks.every(h => !isWs(h.command))
  );
  stats.preserved += kept.length;

  // Count new vs updated source entries
  for (const se of srcEntries) {
    const existed = tgtEntries.some(te =>
      te.matcher === se.matcher &&
      te.hooks && te.hooks.some(h => isWs(h.command))
    );
    if (existed) stats.updated++;
    else stats.added++;
  }

  mergedHooks[event] = [...kept, ...srcEntries];
}

// Preserve target events not in source
for (const [event, entries] of Object.entries(tgt.hooks || {})) {
  if (!mergedHooks[event]) {
    mergedHooks[event] = entries;
    stats.preserved += entries.length;
  }
}

// Build final object: target keys + source keys, hooks merged
const merged = {};
for (const [k, v] of Object.entries(tgt)) {
  if (k !== "hooks") merged[k] = v;
}
for (const [k, v] of Object.entries(src)) {
  if (k !== "hooks" && !(k in merged)) merged[k] = v;
}
merged.hooks = mergedHooks;

if (dryRun !== "true") {
  fs.writeFileSync(tgtFile, JSON.stringify(merged, null, 2) + "\n");
}

console.log(JSON.stringify(stats));
' "$src_file" "$tgt_path" "$dry_run"
}

# ─── Emit JSON entry ─────────────────────────────────────────────────────────
emit() {
  # Appends a compact JSON object to ENTRIES_FILE
  # All arguments are passed directly to jq -n -c
  jq -n -c "$@" >> "$ENTRIES_FILE"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
load_sha_changes

NUM_GROUPS=$(jq '.groups | length' "$MANIFEST")
g=0
while [ "$g" -lt "$NUM_GROUPS" ]; do
  GROUP_JSON=$(jq -c ".groups[$g]" "$MANIFEST")
  NAME=$(echo "$GROUP_JSON" | jq -r '.name')
  g=$((g + 1))

  # Skip if filtered out
  if ! group_included "$NAME"; then continue; fi

  VERSIONING=$(echo "$GROUP_JSON" | jq -r '.versioning')
  SRC=$(echo "$GROUP_JSON" | jq -r '.src // empty')
  DEST=$(echo "$GROUP_JSON" | jq -r '.dest // empty')
  FLATTEN=$(echo "$GROUP_JSON" | jq -r '.flatten // "false"')
  CONDITIONAL=$(echo "$GROUP_JSON" | jq -r '.conditional // "false"')
  DO_CHMOD=$(echo "$GROUP_JSON" | jq -r '.chmod // "false"')
  DEPLOY_METHOD=$(echo "$GROUP_JSON" | jq -r '.deployMethod // "file"')
  OPTIONAL=$(echo "$GROUP_JSON" | jq -r '.optional // "false"')

  # ── Optional groups: skip on apply unless explicitly requested ──
  if [ "$OPTIONAL" = "true" ] && [ "$COMMAND" = "apply" ]; then
    if [ -z "$GROUP_FILTER" ] || ! group_included "$NAME"; then
      continue
    fi
  fi

  # ── Settings merge (special case) ──
  if [ "$VERSIONING" = "merge" ]; then
    dry_run="true"
    if [ "$COMMAND" = "apply" ]; then dry_run="false"; fi
    stats=$(run_settings_merge "$SKILL_DIR/$SRC" "$TARGET_PATH" "$dry_run")
    emit \
      --arg group "$NAME" \
      --arg action "MERGE" \
      --argjson stats "$stats" \
      '{group: $group, file: "settings.json", action: $action, added: $stats.added, updated: $stats.updated, preserved: $stats.preserved}'
    continue
  fi

  # ── Files map (configs group) ──
  HAS_FILES=$(echo "$GROUP_JSON" | jq 'has("files")')
  if [ "$HAS_FILES" = "true" ]; then
    echo "$GROUP_JSON" | jq -r '.files | to_entries[] | "\(.key)\t\(.value)"' | \
    while IFS="$(printf '\t')" read -r src_rel dest_rel; do
      src_file="$SKILL_DIR/$src_rel"
      tgt_file="$TARGET_PATH/$dest_rel"

      action=$(determine_action "$src_file" "$tgt_file" "$VERSIONING")

      if [ "$COMMAND" = "apply" ] && [ "$action" != "SKIP" ]; then
        deploy_file "$src_file" "$tgt_file" "$DO_CHMOD"
      fi

      emit \
        --arg group "$NAME" \
        --arg file "$src_rel" \
        --arg action "$action" \
        '{group: $group, file: $file, action: $action}'
    done
    continue
  fi

  # ── Regular src/include groups ──
  if [ -z "$SRC" ]; then continue; fi

  SRC_DIR="$SKILL_DIR/$SRC"

  if [ "$CONDITIONAL" = "true" ]; then
    load_applies
  fi

  enumerate_files "$SRC_DIR" "$GROUP_JSON" | while IFS= read -r src_file; do
    [ -z "$src_file" ] && continue

    rel_from_skill="${src_file#$SKILL_DIR/}"
    rel_from_src="${src_file#$SRC_DIR/}"

    # ── Conditional: check applies ──
    if [ "$CONDITIONAL" = "true" ]; then
      if ! template_matches "$rel_from_skill"; then
        emit \
          --arg group "$NAME" \
          --arg file "$rel_from_skill" \
          --arg action "SKIP" \
          --arg reason "applies condition not met" \
          '{group: $group, file: $file, action: $action, reason: $reason}'
        continue
      fi
    fi

    # ── KG-deployed (vendor docs) ──
    if [ "$DEPLOY_METHOD" = "kg" ]; then
      ver=$(extract_frontmatter_version "$src_file")
      domain=$(extract_frontmatter_domain "$src_file")
      entity=$(vendor_entity_name "$rel_from_skill")
      emit \
        --arg group "$NAME" \
        --arg file "$rel_from_skill" \
        --arg action "CHECK_KG" \
        --arg entity "$entity" \
        --arg version "${ver:-unknown}" \
        --arg domain "${domain:-unknown}" \
        '{group: $group, file: $file, action: $action, entity: $entity, version: $version, domain: $domain}'
      continue
    fi

    # ── Compute target path ──
    if [ "$FLATTEN" = "true" ]; then
      tgt_file="$TARGET_PATH/$DEST/$(basename "$rel_from_src")"
    else
      tgt_file="$TARGET_PATH/$DEST/$rel_from_src"
    fi

    # ── Scaffold: skip existing files ──
    if [ "$OPTIONAL" = "true" ] && [ -f "$tgt_file" ]; then
      emit \
        --arg group "$NAME" \
        --arg file "$rel_from_skill" \
        --arg action "SKIP" \
        --arg reason "exists" \
        '{group: $group, file: $file, action: $action, reason: $reason}'
      continue
    fi

    # ── Determine action ──
    action=$(determine_action "$src_file" "$tgt_file" "$VERSIONING")

    # ── Get version info for output ──
    src_ver="" tgt_ver=""
    case "$VERSIONING" in
      comment)
        src_ver=$(extract_comment_version "$src_file")
        tgt_ver=$(extract_comment_version "$tgt_file")
        ;;
      frontmatter)
        src_ver=$(extract_frontmatter_version "$src_file")
        tgt_ver=$(extract_frontmatter_version "$tgt_file")
        ;;
    esac

    # ── Apply deployment ──
    if [ "$COMMAND" = "apply" ]; then
      case "$action" in
        CREATE|UPDATE|REPLACE|REVIEW)
          deploy_file "$src_file" "$tgt_file" "$DO_CHMOD"
          ;;
      esac
    fi

    # ── Emit entry with version details ──
    if [ -n "$src_ver" ] && [ -n "$tgt_ver" ] && [ "$action" = "UPDATE" ]; then
      emit \
        --arg group "$NAME" \
        --arg file "$rel_from_skill" \
        --arg action "$action" \
        --arg from "$tgt_ver" \
        --arg to "$src_ver" \
        '{group: $group, file: $file, action: $action, from: $from, to: $to}'
    elif [ -n "$src_ver" ] && [ "$action" = "SKIP" ]; then
      emit \
        --arg group "$NAME" \
        --arg file "$rel_from_skill" \
        --arg action "$action" \
        --arg version "$src_ver" \
        '{group: $group, file: $file, action: $action, version: $version}'
    elif [ "$action" = "REVIEW" ]; then
      emit \
        --arg group "$NAME" \
        --arg file "$rel_from_skill" \
        --arg action "$action" \
        --arg version "${src_ver:-unknown}" \
        --arg reason "SHA changed, version not bumped" \
        '{group: $group, file: $file, action: $action, version: $version, reason: $reason}'
    else
      emit \
        --arg group "$NAME" \
        --arg file "$rel_from_skill" \
        --arg action "$action" \
        '{group: $group, file: $file, action: $action}'
    fi
  done
done

# ── Update SHA on apply ──
if [ "$COMMAND" = "apply" ]; then
  mkdir -p "$TARGET_PATH/.claude"
  git -C "$SKILL_DIR" rev-parse HEAD > "$TARGET_PATH/.claude/webstack.sha"
fi

# ── Output JSON array ──
if [ -s "$ENTRIES_FILE" ]; then
  echo "["
  # Add commas between entries, not after last
  sed '$ ! s/$/,/' "$ENTRIES_FILE"
  echo "]"
else
  echo "[]"
fi
