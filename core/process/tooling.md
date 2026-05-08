---
version: 2.11.0
applies: Always
target: rules
priority: high
tags: [tooling, yarn, check, typescript, eslint, biome, verification]
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

## Tool Usage Discipline

**Principle:** Prefer auditable, dedicated tools over inline shell logic. Every Bash invocation should be a short, obvious command a human can approve at a glance.

### Bash Tool — Allowlisted Commands Only

Allowed: `git`, `yarn`, `docker`, `docker compose`, `mkdir`, `cp`, `mv`, `ln`, `chmod`, `jq`. Chaining with `&&` is fine. Everything else uses dedicated tools.

```bash
# Good — obvious, reviewable
yarn check
git diff --staged
docker compose -f docker-compose.dev.yml up -d

# Bad — unauditable, one hallucination away from damage
python -c "import json; data = json.load(open('config.json')); ..."
node -e "const fs = require('fs'); fs.readdirSync('.').forEach(f => { ... })"
for f in $(find . -name '*.ts'); do mv "$f" "$f.bak"; done
```

### No Inline Scripts, Loops, or Pipe Chains (enforced by hook)

`python -c`, `node -e`, `ruby -e`, `for`/`while` loops, `xargs`, and 3+ pipe chains are blocked. Create a script file in `scripts/` instead.

### Use Dedicated Tools Instead

| Instead of | Use |
|------------|-----|
| `cat`, `head`, `tail` | Read tool |
| `grep`, `rg` | Grep tool |
| `find`, `ls` | Glob tool |
| `awk` | Edit tool |
| `echo >`, heredoc | Write tool |

### context-mode — Large Output Handling

Prefer context-mode's sandbox execution when output may be large or you only need specific data from it. Only your printed summary enters context — raw output stays in the sandbox, preserving your context budget.

| Instead of | Use | When |
|------------|-----|------|
| Bash (command output) | context-mode `execute` | Output may exceed 20 lines (test runs, git log, API responses) |
| Read (large file) | context-mode `execute_file` | File >50 lines and you only need specific data (logs, CSV, JSON) |
| WebFetch | context-mode `fetch_and_index` | Fetching URL for reference — indexes for later `search` |
| Multiple Bash + Read calls | context-mode `batch_execute` | Running 2+ commands and searching across all results in one call |
| Storing docs/content for later | context-mode `index` | Indexing API refs, skill prompts, migration guides, Context7 output |
| Finding specific info in indexed content | context-mode `search` | After any indexing step — pass all queries in one call |

**After indexing** (via `fetch_and_index`, `index`, or `batch_execute`), use `search` to query the indexed content on demand — no need to re-fetch or re-read.

**When NOT to use context-mode:** Short commands with predictable output (`git status`, `yarn check`, `docker ps`), files you need to edit (use Read + Edit instead), and quick file existence checks.

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

```
# Bad — loads entire file to find one thing
Read package.json → scan for "react" in dependencies

# Good — targeted search, zero file content in context
Grep: pattern="\"react\"" glob="package.json"
```

### Edit Tool — Indentation Awareness

The Edit tool cannot match literal tab characters. If the project uses tabs (check `.editorconfig` or the file itself), use these alternatives:

| Edit type | Tab-safe alternative |
|-----------|---------------------|
| Whole file or large section | Write tool (full rewrite) |
| Config files (YAML, TOML, Makefile) | Write tool |

For space-indented files, the Edit tool works normally.

On session start, check `.editorconfig` at the project root. If `indent_style = tab`, prefer Write over Edit for all file modifications.

### Shell Scripts — Cross-Platform Compatibility

Every Bash script in the project must work on both macOS (Bash 3.2, BSD coreutils) and Linux (Bash 4+, GNU coreutils). Avoid GNU-only flags, bashisms above 3.2, and Linux-only paths. For detailed requirements, see `core/process/scripting`.

### TypeScript 6 — default and locked-option changes

When upgrading from TS 5.x to 6.x, several `tsconfig.json` defaults change and previously-tunable options become locked. Audit the project tsconfig before bumping:

| Option | TS 5.x | TS 6.x | Impact |
|--------|--------|--------|--------|
| `noUncheckedSideEffectImports` | `false` | `true` | Breaks side-effect-only imports without type declarations (e.g. `@payloadcms/next/css`). Set explicitly to `false` if you have such imports |
| `baseUrl` | optional, used by `paths` | deprecated (removed in TS7) | `paths` now resolve relative to the tsconfig directory by default. Drop `baseUrl` from tsconfig; update any code that relied on it (e.g. Payload `importMap.js` may need bare `src/...` imports rewritten to `@/...`) |
| `types` default | `["*"]` (auto-include all `@types/*`) | `[]` | Projects with no explicit `types:` lose all `@types/*` auto-inclusion. Add the packages you actually depend on, e.g. `"types": ["node"]` |
| `esModuleInterop` | tunable | locked to `true` | Cannot disable; remove from tsconfig or accept the value |
| `allowSyntheticDefaultImports` | tunable | locked to `true` | Same — cannot disable |

Run `tsc --build --noEmit` after the bump and read errors literally — many are mechanical config fixes, not real type problems.

## Shared Branch Safety

Multiple agents (or the user) may be working on the same branch concurrently. Never mutate branch state in ways that would break other agents' work:

- **`git stash`** — moves uncommitted changes out from under other agents. Never use it.
- **`git worktree`** — never use it, even if other plugins or skills suggest it. Treat the working tree as shared.
- **New branches** — do not create branches to "isolate" your work. Stay on the current branch.
- **`git revert`** — creates a revert commit that changes the branch for everyone. Confirm with the user first.
- **`git reset`** — rewrites history. Blocked by hook unless user explicitly requests it.
- **`git checkout <file>`** — silently discards uncommitted changes. Confirm first.

If files are dirty when you arrive, assume another agent put them there. Investigate before discarding or restaging. Stage and commit only the files you intentionally changed, by name — never `git add -A` / `git add .`.

## Agent Behavior

### Always Do
- **Use task lists** for any work with 2+ steps — create tasks, track progress, keep the user informed
- Use platform tools that don't require manual approval (see `core/claude-config/claude-settings`)
- In monorepos, ensure every command runs in the correct workspace directory (see `core/process/monorepo`)
- Follow `core/process/engineering-discipline` for task assessment, verification, and implementation process

## Monorepo Verification

See `core/process/monorepo` for ports, logs, type flow, and cross-workspace verification.

## Session Start Protocol

Core conventions are auto-loaded from `.claude/rules/core/` — no manual loading needed. `core/` references in other rules point to these auto-loaded rule files — do not manually read them.

**On conversation start, context compaction, or "remember":**
1. Re-read `CLAUDE.md` for project-specific overrides
2. Load KG entities for the task's domain — see `core/process/mcp-tools` and domain-specific rules for exact queries
3. If `.editorconfig` exists at project root, read it — indentation style affects tool selection (see Edit Tool — Indentation Awareness above)
