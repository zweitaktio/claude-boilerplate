---
version: 1.4.0
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

## Agent Behavior

### Never Do
- **Never write inline scripts** (bash heredocs, `node -e`, `python -c`) for file operations — use Claude Code tools (Read, Write, Edit, Glob, Grep) instead
- **Never use bash loops or batch operations** — no `for`, `while`, `xargs` batch ops. Chaining sequential commands with `&&` is fine.
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
2. `search_nodes` in Knowledge Graph for topics related to current task
3. Load vendor docs by domain: `search_nodes("domain: {relevant}")` → `open_nodes` (see CLAUDE.md Vendor Knowledge table)
