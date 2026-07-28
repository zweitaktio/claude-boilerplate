#!/bin/bash
# version: 1.0.0
# Verifies that .mcp.json actually wires the Playwright MCP server to the deployed config and to an
# absolute output directory. Deploying .claude/playwright-mcp.config.json is not enough — nothing
# reads it unless --config points at it, and a relative outputDir silently misroutes artifacts.
#
# Usage:
#   check-mcp-wiring.sh <project-path>
#
# Outputs a JSON array of {id, status, severity, detail}.
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: check-mcp-wiring.sh <project-path>

Checks (Playwright MCP):
  PW1  .mcp.json exists and parses
  PW2  a "playwright" server is defined
  PW3  --config is passed, and is an ABSOLUTE path to the deployed config
  PW4  --output-dir is passed, and is an ABSOLUTE path
  PW5  the deployed config file parses as JSON (a malformed one is silently ignored)
  PW6  the deployed config does NOT set a relative outputDir (resolves against the
       server's cwd, not the config file's directory — misroutes artifacts)
  PW7  the package version is pinned (not @latest)
  PW8  the output directory is git-ignored
  PW9  no stale .playwright-mcp/ residue (the default dir used when --config is absent)

Output: JSON array. Exit 0 always — findings are data, not failures.

Requires: jq
EOF
  exit 0
fi

command -v jq >/dev/null 2>&1 || { echo "Error: jq is required." >&2; exit 1; }

PROJECT="${1:?Usage: check-mcp-wiring.sh <project-path>}"
PROJECT="$(cd "$PROJECT" && pwd)"

RESULTS="[]"
add() { # <id> <status> <severity> <detail>
  RESULTS=$(printf '%s' "$RESULTS" | jq \
    --arg id "$1" --arg status "$2" --arg severity "$3" --arg detail "$4" \
    '. + [{id: $id, status: $status, severity: $severity, detail: $detail}]')
}

MCP="$PROJECT/.mcp.json"
CFG_REL=".claude/playwright-mcp.config.json"
CFG="$PROJECT/$CFG_REL"

# ─── PW1: .mcp.json present and parseable ──
if [ ! -f "$MCP" ]; then
  add "PW1" "FAIL" "WARN" "No .mcp.json — Playwright MCP is not project-scoped here."
  printf '%s' "$RESULTS" | jq .
  exit 0
fi
if ! jq -e . "$MCP" >/dev/null 2>&1; then
  add "PW1" "FAIL" "ERROR" ".mcp.json is not valid JSON — every server in it is ignored."
  printf '%s' "$RESULTS" | jq .
  exit 0
fi
add "PW1" "PASS" "OK" ".mcp.json parses"

# ─── PW2: playwright server defined ──
if ! jq -e '.mcpServers.playwright' "$MCP" >/dev/null 2>&1; then
  add "PW2" "FAIL" "INFO" "No \"playwright\" server in .mcp.json — nothing to wire (skipping PW3-PW9)."
  printf '%s' "$RESULTS" | jq .
  exit 0
fi
add "PW2" "PASS" "OK" "playwright server is defined"

# Join args into one space-separated string, then read flag values positionally.
ARGS="$(jq -r '[.mcpServers.playwright.args // [] | .[]] | join(" ")' "$MCP")"
arg_value() { # <flag> -> the token after it, or empty
  printf '%s\n' "$ARGS" | tr ' ' '\n' | grep -A 1 -x -- "$1" 2>/dev/null | sed -n '2p' || true
}

# ─── PW3: --config present, absolute, pointing at the deployed config ──
CFG_ARG="$(arg_value --config)"
if [ -z "$CFG_ARG" ]; then
  add "PW3" "FAIL" "ERROR" "--config is not passed. $CFG_REL is deployed but NOTHING READS IT; playwright-mcp falls back to its defaults and writes to .playwright-mcp/. Fix: add --config \"$CFG\" to .mcp.json."
else
  case "$CFG_ARG" in
    /*) case "$CFG_ARG" in
          *"$CFG_REL") add "PW3" "PASS" "OK" "--config points at the deployed config (absolute)" ;;
          *) add "PW3" "FAIL" "WARN" "--config points at $CFG_ARG, not the skill-managed $CFG_REL. The deployed config is being ignored." ;;
        esac ;;
    *) add "PW3" "FAIL" "WARN" "--config is relative ($CFG_ARG) — resolved against the server's cwd, so it may not be found. Use an absolute path." ;;
  esac
fi

# ─── PW4: --output-dir present and absolute ──
OUT_ARG="$(arg_value --output-dir)"
if [ -z "$OUT_ARG" ]; then
  add "PW4" "FAIL" "ERROR" "--output-dir is not passed. Artifacts go to <server-cwd>/.playwright-mcp, which moves with wherever Claude Code was launched. Fix: add --output-dir \"$PROJECT/.claude/screenshots\"."
else
  case "$OUT_ARG" in
    /*) add "PW4" "PASS" "OK" "--output-dir is absolute ($OUT_ARG)" ;;
    *)  add "PW4" "FAIL" "ERROR" "--output-dir is relative ($OUT_ARG) — path.resolve() anchors it to the SERVER's cwd, not the project. This is the root cause of screenshots landing in the working tree. Use an absolute path." ;;
  esac
fi

# ─── PW5 / PW6: the deployed config file itself ──
if [ ! -f "$CFG" ]; then
  add "PW5" "FAIL" "INFO" "$CFG_REL is not deployed — run /webstack update."
else
  if jq -e . "$CFG" >/dev/null 2>&1; then
    add "PW5" "PASS" "OK" "$CFG_REL parses as JSON"
    CFG_OUT="$(jq -r '.outputDir // ""' "$CFG")"
    if [ -z "$CFG_OUT" ]; then
      add "PW6" "PASS" "OK" "config sets no outputDir (correct — it belongs in .mcp.json)"
    else
      case "$CFG_OUT" in
        /*) add "PW6" "FAIL" "WARN" "config sets an absolute outputDir ($CFG_OUT). It works, but /webstack update OVERWRITES this file — the setting will be lost. Move it to --output-dir in .mcp.json." ;;
        *)  add "PW6" "FAIL" "ERROR" "config sets a RELATIVE outputDir ($CFG_OUT). playwright-mcp resolves it against the server's cwd, not this file's directory, so artifacts land unpredictably. Remove it and use --output-dir in .mcp.json." ;;
      esac
    fi
  else
    add "PW5" "FAIL" "ERROR" "$CFG_REL is not valid JSON. loadConfig() swallows the error and falls back to defaults, so the whole config is silently ignored."
  fi
fi

# ─── PW7: version pinned ──
case "$ARGS" in
  *@playwright/mcp@latest*) add "PW7" "FAIL" "WARN" "Version is @latest — output-path behaviour can change between sessions. Pin it (e.g. @playwright/mcp@0.0.78)." ;;
  *@playwright/mcp@*)       add "PW7" "PASS" "OK" "Playwright MCP version is pinned" ;;
  *)                        add "PW7" "FAIL" "INFO" "Could not determine the @playwright/mcp version from args." ;;
esac

# ─── PW8: output dir is git-ignored ──
if [ -n "$OUT_ARG" ] && [ -d "$PROJECT/.git" ]; then
  REL_OUT="${OUT_ARG#"$PROJECT"/}"
  # Probe a file path INSIDE the dir: a `dir/` pattern only matches a directory, and check-ignore
  # cannot tell a non-existent path is one — probing the bare dir gives a false negative.
  if git -C "$PROJECT" check-ignore -q "$REL_OUT/probe.jpeg" 2>/dev/null; then
    add "PW8" "PASS" "OK" "$REL_OUT is git-ignored"
  else
    add "PW8" "FAIL" "WARN" "$REL_OUT is NOT git-ignored — screenshots will show up as untracked noise. Add it to .gitignore."
  fi
fi

# ─── PW9: residue from an unwired setup ──
STRAY="$PROJECT/.playwright-mcp"
if [ -d "$STRAY" ]; then
  N=$(find "$STRAY" -type f 2>/dev/null | wc -l | tr -d ' ')
  add "PW9" "FAIL" "INFO" ".playwright-mcp/ holds $N file(s) — the default dir used when --output-dir is absent. Residue from before the wiring was fixed; safe to delete once you have checked the dates."
else
  add "PW9" "PASS" "OK" "no .playwright-mcp/ residue"
fi

printf '%s' "$RESULTS" | jq .
