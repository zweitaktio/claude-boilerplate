---
version: 1.11.0
applies: Always
target: rules
priority: high
tags: [tooling, yarn, check, typescript, eslint, biome, verification, git]
---

# Tooling & Workflow

## Verification Commands

### `yarn check` — Primary Verification (automated via hook)

The single command that validates code correctness — linting, formatting, type-checking in one pass.

**`yarn check` runs automatically** via a PostToolUse hook after every Edit/Write to code files. You do not need to run it manually. If it fails, the errors appear in context — fix them and continue.

```bash
# Typical yarn check structure (order matters):
eslint --fix --cache --cache-location ./node_modules/.cache/eslint . && \
prettier --write --log-level warn . && \
react-router typegen && \
tsc --build --noEmit && \
echo '✓ All checks passed!'
```

**Rules:**
- Never run `yarn tsc`, `yarn eslint`, `yarn prettier` individually — `yarn check` covers all
- Only commit when `yarn check` passes (the hook ensures you see failures)

### `yarn build` — Full Build (use sparingly)

```bash
yarn check && react-router build  # or next build, vite build, etc.
```

- **Use sparingly** — only to verify large chunks of work or before deployment
- **Not for every change** — it's slow; `yarn check` covers correctness
- Never run unless explicitly asked or before a major milestone

### `yarn i18n:extract` — Translation Keys

Run after adding new `t()` calls to extract keys to translation files.

## Dev Server Logs

**Never start dev servers** — assume they're already running. The user manages them manually.

Dev servers should tee output to disk for debugging:

```bash
# Pattern: kill existing → clear log → run with tee
lsof -ti:5173 | xargs kill -9 2>/dev/null; \
: > /tmp/frontend.log; \
react-router dev 2>&1 | tee /tmp/frontend.log
```

| Component | Log location | Port |
|-----------|--------------|------|
| Frontend | `/tmp/frontend.log` or `./dev-server.log` | 5173 |
| Backend | `/tmp/backend.log` | 3000 |
| Stripe listener | `/tmp/stripe.log` | — |

**To debug server issues:** Read the log file with the Read tool, don't restart the server.

## Git Usage

**Git is read-only** — use it to look up information, never to mutate.

### Allowed (read-only)
```bash
git status          # See changed files
git diff            # See unstaged changes
git diff --staged   # See staged changes
git log --oneline -10  # Recent commits
git branch -a       # List branches
git show <commit>   # Inspect a commit
```

### Commit Rules
- Only commit when user explicitly requests
- Only push when user explicitly requests
- Never add co-authorship lines, agent attribution, or AI-generated markers to commits
- Commit messages: concise, imperative, no conventional-commit prefixes (no "feat:", "fix:", etc.)
- Never skip pre-commit hooks (`--no-verify`)

### Never Do Without Explicit Request
- `git checkout`, `git reset`, `git revert`
- `git push --force`, `git reset --hard`, `git clean -f` — destructive, confirm first

## Tool Usage Discipline

**Principle:** Prefer auditable, dedicated tools over inline shell logic. Every Bash invocation should be a short, obvious command a human can approve at a glance.

### Bash Tool — Simple Commands Only

Allowed uses: `git`, `yarn`, `docker`, `docker compose`, `mkdir`, `cp`, `mv`, `ln`, `chmod`. Chaining with `&&` is fine.

```bash
# Good — obvious, reviewable
yarn check
git diff --staged
docker compose -f docker-compose.dev.yml up -d

# Bad — unauditable, one hallucination away from damage
python -c "import json; data = json.load(open('config.json')); ..."
node -e "const fs = require('fs'); fs.readdirSync('.').forEach(f => { ... })"
for f in $(find . -name '*.ts'); do sed -i '' 's/old/new/g' "$f"; done
```

### Never Run Inline

- **No inline scripts** — no `python -c`, `node -e`, `ruby -e`, bash heredocs, or multi-line awk/sed programs
- **No loops or iteration** — no `for`, `while`, `xargs` batch operations
- **No piped processing chains** — no `curl | jq | awk | sed` pipelines for data transformation

### Use Dedicated Tools Instead

| Instead of | Use |
|------------|-----|
| `cat`, `head`, `tail` | Read tool |
| `grep`, `rg` | Grep tool |
| `find`, `ls` | Glob tool |
| `sed`, `awk` | Edit tool |
| `echo >`, heredoc | Write tool |

### File Copy/Move — Use Bash, Not Read+Write

When the task is to copy or move a file without modification, use `cp` or `mv` directly.
Reading a file into context just to write it elsewhere wastes tokens and adds no value.

```bash
# Good — zero tokens spent on file content
cp src/config.default.json src/config.json
mv old/component.tsx new/component.tsx

# Bad — entire file loaded into context for no reason
# Read src/config.default.json → Write src/config.json (same content)
```

Only read a file when you need to understand or modify its content.

### Edit Tool — Indentation Awareness

The Edit tool cannot match literal tab characters. If the project uses tabs (check `.editorconfig` or the file itself), use these alternatives:

| Edit type | Tab-safe alternative |
|-----------|---------------------|
| Function/method body | Serena `replace_symbol_body` (auto-indentation) |
| Whole file or large section | Write tool (full rewrite) |
| Config files (YAML, TOML, Makefile) | Write tool |

For space-indented files, the Edit tool works normally.

On session start, check `.editorconfig` at the project root. If `indent_style = tab`, prefer Write and Serena over Edit for all file modifications.

### When Shell Logic IS Needed — Create a Script

If a task genuinely requires loops, conditionals, parsing, or >3 lines of logic:

1. **Create a script file** in `scripts/` (e.g., `scripts/migrate-imports.sh`)
2. Let the user review it before execution
3. Run it with a single Bash command: `bash scripts/migrate-imports.sh`
4. Keep it — it becomes reusable, shareable, and versionable

This applies equally to one-off tasks. A script file is always preferable to an inline command that scrolls past in an approval prompt.

### Script Requirements

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

### Shell Compatibility — macOS/Darwin Baseline

All shell scripts must run on macOS with its default toolchain:

- **Bash 3.2** (macOS ships v3.2 due to GPLv3 — no Bash 4+ features)
- **BSD coreutils** (`sed`, `find`, `grep`, `awk`, `xargs` — not GNU)

Forbidden (Bash 4+):
- Associative arrays (`declare -A`)
- `${var,,}` / `${var^^}` (case conversion)
- `|&` (pipe stderr), `coproc`, `readarray`/`mapfile`
- `[[ $var =~ regex ]]` with stored patterns in variables

Forbidden (GNU-only):
- `sed -i 's/...'` without `''` arg — BSD requires `sed -i '' 's/...'`
- `grep -P` (PCRE) — use `grep -E` (extended regex)
- `find -regex` with GNU syntax — use `-name` or `-path`
- `readlink -f` — use `realpath` or manual loop

Use `#!/bin/bash` (not `#!/usr/bin/env bash`) and test on macOS before assuming portability.

## Payload API Scripts

Helper scripts for querying the Payload CMS REST API from the CLI. Use these instead of raw `curl` commands.

### `scripts/payload-api.sh` — REST API requests

```bash
# Public endpoints
./scripts/payload-api.sh GET '/products?limit=2&depth=0'
./scripts/payload-api.sh GET '/products/404?depth=2'

# With jq filter
PAYLOAD_JQ='{totalDocs, title: .docs[0].title}' ./scripts/payload-api.sh GET '/products?limit=1'

# Authenticated (JWT from token script)
PAYLOAD_TOKEN=$(...) ./scripts/payload-api.sh GET '/users?limit=1'

# Authenticated (API key)
PAYLOAD_API_KEY=<key> ./scripts/payload-api.sh GET '/users?limit=1'

# POST with body
./scripts/payload-api.sh POST '/products' -d '{"title":"Test"}'
```

### `scripts/payload-token.sh` — Get a JWT token

```bash
./scripts/payload-token.sh <email> <password>
# Outputs raw JWT token on success, error to stderr on failure
```

Env: `PAYLOAD_URL` overrides the default `http://localhost:3000`.

## Agent Behavior

### Never Do
- **Never start dev servers** — assume they're already running
- **Never mutate git** without explicit user request (see Git Usage above)
- **Never skip pre-commit hooks** (`--no-verify`)

### Always Do
- **Use task lists** for any work with 2+ steps — create tasks, track progress, keep the user informed
- Use platform tools that don't require manual approval (see `core/claude-config/claude-settings`)
- Use absolute paths when possible
- Verify `pwd` before file operations in monorepos
- Follow `core/process/engineering-discipline` for task assessment, verification, and implementation process

## Monorepo Verification

`yarn check` runs automatically per-workspace via the PostToolUse hook — it finds the nearest `package.json` with a `check` script from the edited file. No manual runs needed.

For cross-workspace type sync (if shared types):
```bash
cd backend && yarn generate:types && yarn copytypes
cd frontend && yarn typecheck
```

## Session Start Protocol

Core conventions are auto-loaded from `.claude/rules/core/` — no manual loading needed.

**On conversation start, context compaction, or "remember":**
1. Re-read `CLAUDE.md` for project-specific overrides
2. Load KG entities for the task's domain — see `core/process/mcp-tools` and domain-specific rules for exact queries
3. If `.editorconfig` exists at project root, read it — indentation style affects tool selection (see Edit Tool — Indentation Awareness above)
