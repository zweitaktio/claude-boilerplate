---
version: 1.6.1
applies: Always
target: rules
priority: high
tags: [tooling, yarn, check, typescript, eslint, biome, verification, git]
---

# Tooling & Workflow

## Verification Commands

### `yarn check` — Primary Verification (run after EVERY change)

The single command that validates code correctness. **Never run individual linters in isolation.**

```bash
# Typical yarn check structure (order matters):
eslint --fix --cache --cache-location ./node_modules/.cache/eslint . && \
prettier --write --log-level warn . && \
react-router typegen && \
tsc --build --noEmit && \
echo '✓ All checks passed!'
```

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `eslint --fix` | Lint + auto-fix, cached for speed |
| 2 | `prettier --write` | Format all files |
| 3 | `react-router typegen` | Generate route types (if using RR7) |
| 4 | `tsc --build --noEmit` | Type-check without emitting |
| 5 | `jscpd` | Copy-paste detection (DRY enforcement) — optional but recommended |

**Rules:**
- Run `yarn check` after EVERY change — non-negotiable
- Never run `yarn tsc`, `yarn eslint`, `yarn prettier` individually
- If check fails, fix the issues and re-run
- Only commit when `yarn check` passes

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

### When Shell Logic IS Needed — Create a Script

If a task genuinely requires loops, conditionals, parsing, or >3 lines of logic:

1. **Create a script file** in `scripts/` (e.g., `scripts/migrate-imports.sh`)
2. Let the user review it before execution
3. Run it with a single Bash command: `bash scripts/migrate-imports.sh`
4. Keep it — it becomes reusable, shareable, and versionable

This applies equally to one-off tasks. A script file is always preferable to an inline command that scrolls past in an approval prompt.

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
- Use platform tools that don't require manual approval (see `core/claude-settings`)
- Use absolute paths when possible
- Verify `pwd` before file operations in monorepos
- Follow `core/engineering-discipline` for task assessment, verification, and implementation process

## Monorepo Verification

For monorepos with frontend/backend/etc:

```bash
# Verify each workspace separately
cd frontend && yarn check
cd backend && yarn check

# Type sync after backend changes (if shared types)
cd backend && yarn generate:types && yarn copytypes
cd frontend && yarn typecheck
```

## Session Start Protocol

Core conventions are auto-loaded from `.claude/rules/core/` — no manual loading needed.

**On conversation start, context compaction, or "remember":**
1. Re-read `CLAUDE.md` for project-specific overrides
2. Load KG entities for the task's domain — see `core/mcp-tools` and domain-specific rules for exact queries
