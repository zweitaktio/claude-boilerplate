#!/bin/bash
# version: 1.1.0
# Finds .md files that don't belong to any managed structure in a target project.
# Outputs JSON array of stray file descriptors.
#
# Usage:
#   find-strays.sh <project-path>
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: find-strays.sh <project-path>

Finds .md files that don't belong to any managed structure.

Scans:
  .claude/          Files NOT in rules/, hooks/, plans/, worktrees/ and NOT
                    matching settings*.json, webstack.sha, *.config.json
  .claude/rules/    .md files outside core/, vendor/ and project/
  Project root      .md files that aren't standard names (tracked or not)

Never reported:
  .claude/rules/project/   the project wiki — project-owned, never pruned
  .claude/rules/core/      upstream, managed by sync.sh
  .claude/rules/vendor/    upstream, managed by sync.sh

Heuristics for "likely Claude-created":
  - .md extension
  - Untracked in git, or tracked but never referenced (see git_status)
  - No YAML frontmatter (not a skill template)

Output: JSON array of {path, size_kb, git_status, has_frontmatter}

Requires: jq
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

PROJECT="${1:?Usage: find-strays.sh <project-path>}"

if [ ! -d "$PROJECT" ]; then
  echo "Error: $PROJECT is not a directory." >&2
  exit 1
fi

# Resolve to absolute path
PROJECT=$(cd "$PROJECT" && pwd)

RESULTS="[]"

# ─── Helper: check if file is untracked in git ──
git_status_for() {
  local filepath="$1"
  local relpath="${filepath#$PROJECT/}"

  if [ -d "$PROJECT/.git" ] || git -C "$PROJECT" rev-parse --git-dir >/dev/null 2>&1; then
    if git -C "$PROJECT" ls-files --error-unmatch "$relpath" >/dev/null 2>&1; then
      echo "tracked"
    elif git -C "$PROJECT" ls-files --others --exclude-standard "$relpath" 2>/dev/null | grep -q .; then
      echo "untracked"
    else
      echo "ignored"
    fi
  else
    echo "no-git"
  fi
}

# ─── Helper: check if file starts with YAML frontmatter ──
has_frontmatter() {
  local filepath="$1"
  local first_line
  first_line=$(head -1 "$filepath" 2>/dev/null || true)
  if [ "$first_line" = "---" ]; then
    echo "true"
  else
    echo "false"
  fi
}

# ─── Helper: get file size in KB (portable) ──
size_kb() {
  local filepath="$1"
  local bytes
  if [ "$(uname)" = "Darwin" ]; then
    bytes=$(stat -f%z "$filepath" 2>/dev/null || echo 0)
  else
    bytes=$(stat -c%s "$filepath" 2>/dev/null || echo 0)
  fi
  # Use awk for floating point division (portable)
  echo "$bytes" | awk '{printf "%.1f", $1 / 1024}'
}

# ─── Helper: add a stray to results ──
add_stray() {
  local relpath="$1" size="$2" status="$3" fm="$4"
  RESULTS=$(echo "$RESULTS" | jq \
    --arg path "$relpath" \
    --arg size "$size" \
    --arg status "$status" \
    --arg fm "$fm" \
    '. + [{path: $path, size_kb: ($size | tonumber), git_status: $status, has_frontmatter: ($fm == "true")}]')
}

# ─── Scan 1: .claude/ — files NOT in managed subdirectories ──
CLAUDE_DIR="$PROJECT/.claude"
if [ -d "$CLAUDE_DIR" ]; then
  # Allowed subdirs
  # Find files directly in .claude/ or in non-managed subdirs
  while IFS= read -r filepath; do
    [ -z "$filepath" ] && continue
    relpath="${filepath#$PROJECT/}"

    # Skip managed subdirectories
    case "$relpath" in
      .claude/rules/*) continue ;;
      .claude/hooks/*) continue ;;
      .claude/plans/*) continue ;;
      .claude/worktrees/*) continue ;;
    esac

    # Skip known config files
    basename_f=$(basename "$filepath")
    case "$basename_f" in
      settings*.json) continue ;;
      webstack.sha) continue ;;
      *.config.json) continue ;;
    esac

    status=$(git_status_for "$filepath")
    fm=$(has_frontmatter "$filepath")
    size=$(size_kb "$filepath")
    add_stray "$relpath" "$size" "$status" "$fm"

  done <<EOF
$(find "$CLAUDE_DIR" -type f -not -path "$CLAUDE_DIR/rules/*" -not -path "$CLAUDE_DIR/hooks/*" -not -path "$CLAUDE_DIR/plans/*" -not -path "$CLAUDE_DIR/worktrees/*" 2>/dev/null || true)
EOF
fi

# ─── Scan 2: .claude/rules/ — .md files outside the managed trees ──
RULES_DIR="$PROJECT/.claude/rules"
if [ -d "$RULES_DIR" ]; then
  while IFS= read -r filepath; do
    [ -z "$filepath" ] && continue
    relpath="${filepath#$PROJECT/}"

    # Skip every managed tree. core/ and vendor/ are upstream-owned (sync.sh deploys
    # and prunes them); project/ is the project wiki, which webstack promises never to
    # touch. Reporting a wiki page as a stray invites the user to delete their own
    # knowledge base — see SKILL.md "Safe directories".
    case "$relpath" in
      .claude/rules/core/*) continue ;;
      .claude/rules/vendor/*) continue ;;
      .claude/rules/project/*) continue ;;
    esac

    status=$(git_status_for "$filepath")
    fm=$(has_frontmatter "$filepath")
    size=$(size_kb "$filepath")
    add_stray "$relpath" "$size" "$status" "$fm"

  done <<EOF
$(find "$RULES_DIR" -name '*.md' -type f 2>/dev/null || true)
EOF
fi

# ─── Scan 3: Project root — non-standard .md files, tracked or not ──
# Committing a planning artifact does not make it belong here: PLAN-*.md and
# PROPOSAL-*.md survive precisely because they got committed early and nothing
# ever flagged them again. Report on git status rather than filtering by it.
# WIKI.md is generated by `wiki.sh sync`; SKILL.md marks a skill root.
STANDARD_MDS="README.md CHANGELOG.md LICENSE.md CLAUDE.md CONTRIBUTING.md SKILL.md WIKI.md AGENTS.md SECURITY.md CODE_OF_CONDUCT.md"
while IFS= read -r filepath; do
  [ -z "$filepath" ] && continue
  relpath="${filepath#$PROJECT/}"

  # Only root-level files (find -maxdepth 1 already guarantees this; belt and braces)
  case "$relpath" in
    */*) continue ;;
  esac

  # Skip standard names
  basename_f=$(basename "$relpath")
  skip=""
  for std in $STANDARD_MDS; do
    if [ "$basename_f" = "$std" ]; then
      skip="true"
      break
    fi
  done
  [ -n "$skip" ] && continue

  status=$(git_status_for "$filepath")
  fm=$(has_frontmatter "$filepath")
  size=$(size_kb "$filepath")
  add_stray "$relpath" "$size" "$status" "$fm"

done <<EOF
$(find "$PROJECT" -maxdepth 1 -name '*.md' -type f 2>/dev/null || true)
EOF

echo "$RESULTS" | jq .
