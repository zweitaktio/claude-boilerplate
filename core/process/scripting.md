---
version: 1.1.0
applies: Always
target: rules
paths:
  - "scripts/**"
  - "**/*.sh"
tags: [scripting, bash, shell, compatibility, macos]
---

# Scripting Standards

## When Shell Logic IS Needed — Create a Script

**Bash only** — all project scripts use Bash. No Python, Node/ts-node, or other runtimes for internal tooling scripts.

If a task genuinely requires loops, conditionals, parsing, or >3 lines of logic:

1. **Create a script file** in `scripts/` (e.g., `scripts/migrate-imports.sh`)
2. Let the user review it before execution
3. Run it with a single Bash command: `bash scripts/migrate-imports.sh`
4. Keep it — it becomes reusable, shareable, and versionable

This applies equally to one-off tasks. A script file is always preferable to an inline command that scrolls past in an approval prompt.

## Script Requirements

Every script must:

1. **Source secrets from `.env`** — never accept secrets as CLI arguments or hardcode them.
   Secrets in arguments appear in `ps` output and shell history. Source from `.env` files instead.
   ```bash
   # Good — secrets stay out of context and process list
   [ -f .env ] && source .env
   curl -H "Authorization: Bearer ${API_KEY}" ...

   # Bad — secret visible in context, history, and ps output
   ./scripts/deploy.sh --token sk-1234abc
   ```
   The PreToolUse hook blocks `$VAR` expansion in Bash commands for this reason — scripts that source `.env` internally sidestep this by keeping secrets out of the agent's context entirely.

2. **Support `--help`** — print usage, purpose, and required env vars. Another agent or human running the script months later should understand what it does without reading the source.
   ```bash
   if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
     echo "Usage: $(basename "$0") [options]"
     echo ""
     echo "Syncs product data from Stripe to the local database."
     echo ""
     echo "Required env vars (via .env):"
     echo "  STRIPE_SECRET_KEY    Stripe API key"
     echo "  PAYLOAD_URL          Payload CMS base URL (default: http://localhost:3000)"
     echo ""
     echo "Options:"
     echo "  --dry-run    Show what would change without writing"
     exit 0
   fi
   ```

3. **Validate required env vars early** — fail fast with a clear message, not with a cryptic curl error 10 lines later.
   ```bash
   [ -f .env ] && source .env
   : "${STRIPE_SECRET_KEY:?Missing STRIPE_SECRET_KEY — add it to .env}"
   ```

## Shell Compatibility — macOS/Darwin Baseline

All shell scripts must run on macOS with its default toolchain:

- **Bash 3.2** (macOS ships v3.2 due to GPLv3 — no Bash 4+ features)
- **BSD coreutils** (`sed`, `find`, `grep`, `awk`, `xargs` — not GNU)

Bash 4+ (blocked by hook — macOS ships 3.2):
- Associative arrays (`declare -A`)
- `${var,,}` / `${var^^}` (case conversion)
- `|&` (pipe stderr), `coproc`, `readarray`/`mapfile`
- `[[ $var =~ regex ]]` with stored patterns in variables

GNU-only (blocked by hook — macOS uses BSD):
- `sed -i 's/...'` without `''` arg — BSD requires `sed -i '' 's/...'`
- `grep -P` (PCRE) — use `grep -E` (extended regex)
- `find -regex` with GNU syntax — use `-name` or `-path`
- `readlink -f` — use `realpath` or manual loop

Use `#!/bin/bash` (not `#!/usr/bin/env bash`) and test on macOS before assuming portability.
