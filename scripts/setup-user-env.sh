#!/bin/bash
# version: 1.0.0
# One-time setup for user-scoped plugins and MCP servers.
# Installs shared tools that don't need per-project configuration.
# Compatible with Bash 3.2 (macOS) and Bash 4+ (Linux).

set -euo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: $(basename "$0") [--dry-run]"
  echo ""
  echo "Installs user-scoped plugins and MCP servers for the webstack skill."
  echo "Safe to run multiple times — skips already-installed tools."
  echo ""
  echo "Options:"
  echo "  --dry-run    Show what would be installed without making changes"
  echo ""
  echo "Installs:"
  echo "  Plugins:     context-mode"
  echo "  MCP servers: memory (Knowledge Graph), context7 (library docs)"
  echo ""
  echo "Project-scoped servers (Playwright, Payload MCP) are configured"
  echo "during /webstack init — this script does not install those."
  exit 0
fi

# --- Check claude CLI ---
if ! command -v claude >/dev/null 2>&1; then
  echo "Error: claude CLI not found. Install from https://docs.anthropic.com/en/docs/claude-code" >&2
  exit 1
fi

INSTALLED=0
SKIPPED=0
REMOVED=0
FAILED=0

log() { echo "  $1"; }
dry() { echo "  [dry-run] $1"; }

# --- Plugins ---
echo "Checking plugins..."

PLUGIN_LIST=$(claude plugin list 2>/dev/null || echo "")

install_plugin() {
  local name="$1"
  local package="$2"
  local display_name="${3:-$name}"

  if echo "$PLUGIN_LIST" | grep -q "$name"; then
    log "SKIP $display_name — already installed"
    SKIPPED=$((SKIPPED + 1))
  else
    if [ "$DRY_RUN" = true ]; then
      dry "Would install plugin: $package"
      INSTALLED=$((INSTALLED + 1))
    else
      log "Installing $display_name..."
      if claude plugin install "$package" 2>/dev/null; then
        log "OK   $display_name installed"
        INSTALLED=$((INSTALLED + 1))
      else
        log "FAIL $display_name — install failed"
        FAILED=$((FAILED + 1))
      fi
    fi
  fi
}

install_plugin "context-mode" "context-mode@context-mode" "context-mode"

# --- MCP Servers (user-scoped) ---
echo ""
echo "Checking MCP servers..."

MCP_USER_LIST=$(claude mcp list --scope user 2>/dev/null || echo "")

install_mcp() {
  local name="$1"
  shift
  # remaining args are the command parts

  if echo "$MCP_USER_LIST" | grep -q "$name"; then
    log "SKIP $name — already installed (user scope)"
    SKIPPED=$((SKIPPED + 1))
  else
    if [ "$DRY_RUN" = true ]; then
      dry "Would install MCP server: $name (user scope)"
      INSTALLED=$((INSTALLED + 1))
    else
      log "Installing $name (user scope)..."
      if claude mcp add "$name" --scope user -- "$@" 2>/dev/null; then
        log "OK   $name installed (user scope)"
        INSTALLED=$((INSTALLED + 1))
      else
        log "FAIL $name — install failed"
        FAILED=$((FAILED + 1))
      fi
    fi
  fi
}

install_mcp "memory" npx -y @modelcontextprotocol/server-memory
install_mcp "context7" npx -y @upstash/context7-mcp

# --- Detect project-scoped duplicates ---
echo ""
echo "Checking for project-scoped duplicates..."

MCP_PROJECT_LIST=$(claude mcp list --scope project 2>/dev/null || echo "")

remove_project_duplicate() {
  local name="$1"

  if echo "$MCP_PROJECT_LIST" | grep -q "$name"; then
    if [ "$DRY_RUN" = true ]; then
      dry "Would remove project-scoped $name (now user-scoped)"
    else
      log "Removing project-scoped $name (now user-scoped)..."
      if claude mcp remove "$name" --scope project 2>/dev/null; then
        log "OK   Removed project-scoped $name"
        REMOVED=$((REMOVED + 1))
      else
        log "FAIL Could not remove project-scoped $name"
      fi
    fi
  fi
}

remove_project_duplicate "memory"
remove_project_duplicate "context7"

# --- Summary ---
echo ""
echo "Results:"
echo "  Installed: $INSTALLED"
echo "  Skipped:   $SKIPPED"
echo "  Removed:   $REMOVED (project-scoped duplicates)"
if [ "$FAILED" -gt 0 ]; then
  echo "  Failed:    $FAILED"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "Dry run complete. Run without --dry-run to apply changes."
fi
