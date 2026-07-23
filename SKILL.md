---
name: webstack
description: Bootstrap web stack conventions into .claude/rules/ (core, vendor, and the project knowledge wiki). Run on new projects or when conventions need updating.
disable-model-invocation: true
argument-hint: [init|update|maintenance]
---

# Web Stack Conventions

This skill deploys conventions to two targets based on each template's `target` frontmatter field:

- **`target: rules`** (core templates) → `.claude/rules/core/` — auto-loaded by Claude Code every turn, survives context compression
- **`target: rules`** (vendor templates) → `.claude/rules/vendor/` — path-scoped, auto-loaded when editing matching files

## Local Conventions Always Take Precedence

**CRITICAL:** These templates are defaults. Project-specific rules ALWAYS override boilerplate conventions.

- **CLAUDE.md wins** — If a project's `CLAUDE.md` contradicts a rule, follow `CLAUDE.md`
- **Project patterns win** — If existing code uses a different pattern than a rule suggests, follow the existing pattern
- **Team decisions win** — If the user states a preference that differs from a template, follow the user's preference

The boilerplate provides sensible defaults, not mandates. When in doubt, ask the user.

## Core Rules Are Always Loaded

Core conventions are deployed to `.claude/rules/core/`. Some load on every interaction, others are **path-scoped** and only load when touching relevant files — keeping context lean.

**Always loaded** (~23KB) — `core/process/`:
- `core/process/tooling` — Commands, verification, git, agent behavior
- `core/process/mcp-tools` — MCP & plugin usage rules (KG, Context7), workflows
- `core/process/security-checklist` — Security review standards
- `core/process/code-review` — Code quality standards (smells, comments, review)
- `core/process/engineering-discipline` — Task assessment, verification, change classification, failure protocol
- `core/process/interaction` — Use AskUserQuestion wizard for clarifications
- `core/process/monorepo` — Directory discipline for multi-package projects
- `core/process/issue-tracking` — When to open GitHub issues, DoD as verification barrier, labels, splitting, commit/PR linking

**Path-scoped** (loaded only when touching matching files):
- `core/frontend/react-components` — `**/*.tsx`, `**/*.ts` — Component patterns, useEffect
- `core/frontend/state-management` — `**/*.tsx`, `**/*.ts` — Context vs Zustand
- `core/frontend/i18n` — `**/*.tsx`, `**/*.ts`, `**/locales/**` — Translation patterns
- `core/frontend/ssr-hydration` — `**/*.tsx`, `**/*.ts` — SSR and client-only code
- `core/process/backporting` — `.claude/rules/project/**`, `.claude/docs/**`, `CLAUDE.md` — When to tag findings for backport
- `core/process/knowledge-base` — always-loaded — Where project knowledge lives (path-scoped Markdown), the tiered model, read/write triggers, frontmatter schema
- `core/process/scripting` — `scripts/**`, `**/*.sh` — Script requirements, shell compatibility
- `core/process/payload-api` — `backend/**` — Payload MCP plugin usage
- `core/testing/e2e-testing` — `**/*.test.*`, `**/*.spec.*`, `**/e2e/**` — Playwright testing patterns
- `core/testing/e2e-validation` — `**/*.spec.*`, `**/e2e/**`, `**/routes/**` — Three-layer E2E test validation (results → network → logs)
- `core/testing/unit-testing` — `**/*.test.ts`, `**/*.spec.ts` — Vitest unit testing patterns
- `core/claude-config/claude-md` — `CLAUDE.md`, `.claude/**` — CLAUDE.md conventions
- `core/claude-config/claude-settings` — `.claude/**`, `CLAUDE.md` — Permission patterns
- `core/claude-config/mcp-servers` — `.claude/**` — MCP server setup
- `core/claude-config/writing-rules` — `CLAUDE.md`, `.claude/**`, `SKILL.md`, `**/rules/**` — How to write effective agent rules

**Context budget:** Always-loaded rules total ~950 lines (~23KB). This is the per-turn baseline cost. If adding new always-loaded rules, check whether path-scoping is possible first.

| Rule | Lines | Notes |
|------|-------|-------|
| tooling | ~195 | Commands, verification, git, tool discipline, agent behavior |
| mcp-tools | ~145 | Tool usage rules, Context7 workflow |
| knowledge-base | ~120 | Where project knowledge lives, tiers, read/write triggers, schema |
| engineering-discipline | ~150 | Task assessment, verification, change classification |
| code-review | ~120 | Code quality standards (smells, comments, review) |
| security-checklist | ~60 | Security review checklist |
| interaction | ~25 | Use AskUserQuestion wizard for clarifications |
| monorepo | ~30 | Directory discipline |
| issue-tracking | ~95 | When to open issues, DoD barrier, labels, splitting, commit/PR linking |

Vendor docs are deployed as path-scoped rules in `.claude/rules/vendor/` — they auto-load when editing files in their domain.

## Requirements

This skill requires the following dependencies. Run the preflight check before init/update — **do not proceed if any are missing**.

### CLI Tools

```bash
~/.claude/skills/webstack/scripts/preflight.sh
```

Outputs JSON with availability status. If any tool shows `"available": false`, tell the user the install command and stop.

| Tool | Purpose | Install (macOS) | Install (Linux) |
|------|---------|-----------------|-----------------|
| `jq` | JSON parsing in evaluation scripts | `brew install jq` | `sudo apt install jq` / `sudo dnf install jq` |
| `git` | SHA tracking, change detection | `xcode-select --install` | `sudo apt install git` |

### MCP Servers

Verify each by attempting a lightweight call. If any fails, show the missing server and the install command, then stop.

| Server | Verify with | Purpose | Install |
|--------|------------|---------|---------|
| Context7 | `resolve-library-id` with query `"react"` | Version-specific library documentation | `claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp` |
| Payload (Payload projects only) | Any `mcp__payload__*` tool available | Payload CMS CRUD operations | `claude mcp add payload --transport http --scope project --header "Authorization: Bearer MCP-USER-API-KEY" -- http://localhost:3000/api/mcp` |

### Plugins

Verify by checking if the tool is available in the current session. If missing, show the install command and stop.

| Plugin | Verify with | Purpose | Install |
|--------|------------|---------|---------|
| context-mode | Any `mcp__plugin_context-mode_*` tool available | Large output handling, context budget management | `claude plugin install context-mode@context-mode` |

### User Environment Setup (one-time)

Run once per developer machine to install shared plugins and MCP servers:

```bash
~/.claude/skills/webstack/scripts/setup-user-env.sh
```

This installs user-scoped tools (context-mode, memory, context7).
Project-specific servers (Playwright, Payload MCP) are configured during `/webstack init`.

### Preflight Sequence

Run this at the start of every `/webstack init` or `/webstack update`:

1. Run `scripts/preflight.sh` — if exit code is non-zero, report missing CLI tools with install commands and stop
2. Call `resolve-library-id` with query `"react"` — if the tool is not available, report "Context7 MCP server not configured. Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` or: `claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp`" and stop
3. Check if `mcp__plugin_context-mode_context-mode__execute` is available — if not, report "context-mode plugin not installed. Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` or: `claude plugin install context-mode@context-mode`" and stop

The Knowledge Graph / `memory` MCP server is **no longer required** — project knowledge lives in path-scoped Markdown under `.claude/rules/project/` (see `core/process/knowledge-base`). `setup-user-env.sh` may still install the `memory` server for unrelated uses, but webstack does not depend on it.

If all checks pass, continue with the init/update flow.

## Installation

Symlink this directory to your user-level skills folder to make it available across all projects:

```bash
ln -s /path/to/claude-boilerplate ~/.claude/skills/webstack
```

Then invoke in any project with `/webstack init` or `/webstack update`.

## Usage

| Command | When to use |
|---------|-------------|
| `/webstack init` | New project — deploys rules + vendor docs, seeds the project wiki skeleton, and CLAUDE.md bootstrap |
| `/webstack update` | Existing project — diffs templates, preserves the project wiki (`.claude/rules/project/`, `.claude/docs/`) |
| `/webstack maintenance` | Periodic health check — audits the wiki (`wiki.sh lint`), rules, contradictions, stray files |

**For existing projects:**
- The skill compares each template against the deployed version (rule file)
- The project wiki under `.claude/rules/project/` and `.claude/docs/` is never touched — it's project-owned
- You'll be shown what's new vs what already exists before any changes

**For periodic health checks:**
- Runs `wiki.sh lint` — schema, `paths:`, glob collisions, staleness, unreachable docs
- Detects contradictions between rules, stale pitfalls, orphaned files, and context budget drift
- Auto-fixes safe issues (index regeneration, CLAUDE.md sections) and reports the rest for user decision

## Directory Structure

```
claude-boilerplate/
├── SKILL.md                    # This file — orchestration only
├── manifest.json               # Asset group declarations for sync.sh
├── core/                       # → deployed to .claude/rules/core/ (subdir stripped)
│   ├── process/                # Always-loaded (except path-scoped ones)
│   │   ├── tooling.md
│   │   ├── mcp-tools.md
│   │   ├── security-checklist.md
│   │   ├── code-review.md
│   │   ├── engineering-discipline.md
│   │   ├── interaction.md
│   │   ├── monorepo.md
│   │   ├── knowledge-base.md       # Always-loaded: where project knowledge lives (the wiki)
│   │   ├── backporting.md         # Path-scoped: .claude/rules/project/**, .claude/docs/**, CLAUDE.md
│   │   ├── scripting.md          # Path-scoped: scripts/**, **/*.sh
│   │   └── payload-api.md        # Path-scoped: backend/**
│   ├── frontend/               # Path-scoped to *.tsx, *.ts
│   │   ├── react-components.md
│   │   ├── state-management.md
│   │   ├── i18n.md
│   │   └── ssr-hydration.md
│   ├── testing/                # Path-scoped to test files
│   │   ├── e2e-testing.md
│   │   ├── e2e-validation.md
│   │   └── unit-testing.md
│   ├── claude-config/          # Path-scoped to .claude/**, CLAUDE.md
│   │   ├── claude-md.md
│   │   ├── claude-settings.md
│   │   ├── mcp-servers.md
│   │   └── writing-rules.md
│   └── playwright-mcp.config.json  # Copy to .claude/ in project
├── vendor/                     # → deployed as path-scoped rules in .claude/rules/vendor/
│   ├── daisyui-5.md            # auto-loads when editing styling files
│   ├── tailwind-4.md
│   ├── react-router-8/         # one path-scoped rule per topic
│   │   ├── _index.md
│   │   ├── routing.md
│   │   ├── data-loading.md
│   │   ├── actions.md
│   │   ├── pending-ui.md
│   │   ├── navigation.md
│   │   ├── error-handling.md
│   │   ├── type-safety.md
│   │   ├── special-files.md
│   │   ├── rendering-strategies.md
│   │   ├── route-modules.md
│   │   ├── sessions.md
│   │   └── middleware.md
│   ├── react-router-8-integration.md
│   ├── react-router-8-i18n/
│   │   ├── setup.md
│   │   ├── usage.md
│   │   └── operations.md
│   ├── payload/
│   │   ├── cms-3.md
│   │   ├── rest-client.md
│   │   └── live-preview.md
│   ├── ory-hydra.md
│   ├── remark-frontmatter-schema.md
│   ├── dokploy-monorepo-cicd.md
│   ├── conform-zod.md
│   ├── playwright.md
│   └── project-scaffolding.md
├── scripts/                    # Deployment and maintenance automation
│   ├── sync.sh                 # Deterministic asset sync (compare/apply)
│   ├── wiki.sh                 # Project wiki: find/new/sync/lint (→ .claude/scripts/)
│   ├── kg-to-wiki.sh           # One-shot KG → wiki migration (→ .claude/scripts/)
│   ├── evaluate-applies.sh     # Template applicability evaluation
│   ├── preflight.sh            # CLI dependency check
│   ├── setup-user-env.sh       # User-scoped MCP/plugin setup
│   ├── drift-check.sh          # CLAUDE.md drift checks (S/C series)
│   ├── bootstrap-claude-md.sh  # CLAUDE.md creation/section patching
│   ├── find-strays.sh          # Stray file detection
│   ├── audit-settings.sh       # Settings/MCP permission audit
│   └── context-budget.sh       # Context window budget analysis
├── scaffold/                    # → copied to project root on /webstack init
│   ├── dev.sh                   # Tmux dev launcher (optional: stripe listener pane)
│   ├── install.sh               # Bootstrap script
│   ├── scripts/                 # Git hooks
│   ├── services/                # Docker, sync CLI, OAuth setup
│   ├── .github/                 # CI/CD workflows
│   ├── backend/                 # Dockerfile, copy-types
│   └── frontend/                # Dockerfile
```

## Storage Taxonomy

Everything is Markdown loaded natively by path-scoped `paths:` frontmatter. There is no Knowledge Graph.

| Category | Owner | Location | Loads | Lifecycle |
|----------|-------|----------|-------|-----------|
| **Core** | upstream | `.claude/rules/core/` | always, or path-scoped | Scaffolded from boilerplate, pruned on update |
| **Vendor** | upstream | `.claude/rules/vendor/` | path-scoped | Deployed by `sync.sh`, pruned on update |
| **Project pitfalls / decisions / conventions** | project | `.claude/rules/project/{pitfalls,decisions,conventions}/` | path-scoped, on read of a matching file | Created during development, **never pruned** |
| **Domain maps** | project | `.claude/rules/project/domains/` | path-scoped (broad, tiny) | route to detail + name the heavy docs |
| **Heavy system docs** | project | `.claude/docs/` | on demand (not a rule) | narrated + linked from a map |

### Why this split?

- **Rules** (core + vendor) survive context compression — re-injected at full fidelity. They are upstream-owned and pruned on `/webstack update`.
- **The project wiki** (`.claude/rules/project/` + `.claude/docs/`) is project-owned and never touched by updates. Pitfalls/decisions/conventions auto-load in full when you read a file matching their `paths:` — zero recall, no query. The three tiers (domain map → detail rule → on-demand doc) keep context cost bounded. See `core/process/knowledge-base`.
- **No Knowledge Graph.** The `search_nodes` replacement is `.claude/scripts/wiki.sh find`, plus auto-load for anything you're actually editing.

### Vendor doc loading

Vendor docs auto-load via path-scoped rules in `.claude/rules/vendor/` when you read files in their domain — no manual lookup. `.claude/scripts/wiki.sh sync` regenerates `WIKI.md` (a human index) and backlinks from the project pages' frontmatter.

### SHA Tracking

In addition to per-template version comparison, the skill records the boilerplate git SHA at the time of deployment. This provides a reliable secondary change detection mechanism.

**File:** `.claude/webstack.sha` in the target project (single line: the git SHA of the boilerplate repo at deployment time).

**On init:** Record the current boilerplate HEAD SHA after deployment.

**On update:**
1. Read `.claude/webstack.sha` (if it exists)
2. Run `git -C ~/.claude/skills/webstack log --oneline <stored-sha>..HEAD -- core/ vendor/` to see which templates changed since last deployment
3. Use this to surface changed templates even if the author forgot to bump `version:` in frontmatter
4. Templates that appear in the git diff but have matching versions are flagged as `REVIEW` — the content changed but version wasn't bumped
5. After deployment, update `.claude/webstack.sha` with the current HEAD

**If `.claude/webstack.sha` doesn't exist** (pre-SHA projects), fall back to version-only comparison and create the file after deployment.

## Invocation Instructions

**Check the argument:** `$ARGUMENTS` will be `init`, `update`, or `maintenance`. If not provided, ask the user which mode to use.

### On a new project (`/webstack init`)

**CRITICAL: Use scripts for all file operations.** Never manually copy, write, or edit files in `.claude/rules/core/`, `.claude/hooks/`, or `.claude/settings.json`. The scripts handle stack detection, version tracking, and settings merging deterministically.

0. **Run preflight check** — see "Requirements" section above. Stop if any dependency is missing.

1. **Bootstrap CLAUDE.md:**
   ```bash
   ~/.claude/skills/webstack/scripts/bootstrap-claude-md.sh /path/to/project
   ```
   Show the user what was created/added.

2. **Detect stack** — read `package.json` (dependencies + devDependencies), note frameworks and exact versions.

3. **Run deployment comparison:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project
   ```
   Present the JSON action table to the user as a formatted table.

4. **Wait for user approval**

5. **Deploy file-based assets:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh apply /path/to/project
   ```
   Do NOT manually write any files that this command handles. It deploys rules, hooks, configs, merges settings, and records `.claude/webstack.sha`.

   **MCP scope note:** Playwright MCP is project-scoped (installed here). Context7 and plugins are user-scoped — see "User Environment Setup" above. `sync.sh apply` also deploys `wiki.sh`/`kg-to-wiki.sh` to `.claude/scripts/` (the `wiki-scripts` manifest group).

   **Payload projects:** If the project uses Payload CMS (has `payload` in dependencies), set up the Payload MCP server:
   ```bash
   claude mcp add payload --transport http --scope project --header "Authorization: Bearer MCP-USER-API-KEY" -- http://localhost:3000/api/mcp
   ```
   This requires `@payloadcms/plugin-mcp` in the backend's Payload config and a running backend. Add `"mcp__payload__*"` to the project's `.claude/settings.json` allow list.

6. **Seed the project wiki skeleton** — create the directory structure the project will grow its own
   knowledge into. Vendor docs need no registration step: they are file-deployed path-scoped rules that
   auto-load on their own.

   ```bash
   mkdir -p /path/to/project/.claude/rules/project/{pitfalls,decisions,conventions,domains} \
            /path/to/project/.claude/docs/systems
   ```

   Nothing else to record. As the project accrues findings, they become pages via
   `.claude/scripts/wiki.sh new <type> <slug>` (see `core/process/knowledge-base`). Run
   `.claude/scripts/wiki.sh sync` after adding pages to refresh `WIKI.md`.

   **Hooks inventory:**

   All hooks are `.mjs` files dispatched through `run.sh` (bun/node). Each has a `// version:` comment on line 1. Version comparison is handled by `sync.sh`.

   | Hook | File | Event / Matcher | Purpose |
   |------|------|----------------|---------|
   | Bash guard | `bash-guard.mjs` | PreToolUse / `Bash` | Blocks env vars, inline scripts, loops, pipes, linter isolation, dev servers, git safety, shell compat, Payload CLI |
   | Research gate | `research-gate.mjs` | PreToolUse / `EnterPlanMode\|Task` | Injects research checklist (wiki find + Context7 + WebSearch); vendor + project pitfalls auto-load |
   | Rules guard | `rules-guard.mjs` | PreToolUse / `Write\|Edit` | Quality gate on `.claude/rules/**`: frontmatter, non-empty `paths:`, upstream-edit warning, bloat |
   | Code guard | `code-guard.mjs` | PreToolUse / `Write\|Edit` | Content inspection: React.FC, default exports, .test.tsx, @testing-library, i18n, shell compat. Tracks session-edited files for completion-gate scoping |
   | Migration guard | `migration-guard.mjs` | PreToolUse / `Write\|Edit` | Guards against unsafe migration patterns |
   | Context7 guard | `context7-guard.mjs` | PreToolUse / `query-docs` + PostToolUse / `resolve-library-id` | Enforces resolve-library-id before query-docs |
   | Screenshot guard | `screenshot-guard.mjs` | PreToolUse / `browser_take_screenshot` | Enforces JPEG format for screenshots |
   | Payload guard | `payload-guard.mjs` | PreToolUse / `mcp__payload__*` | Checks for data wrapper, empty objects, null enum fields |
   | Auto-check | `auto-check.mjs` | PostToolUse / `Edit\|Write` | Runs `yarn check` after code edits, finds nearest workspace |
   | i18n extract | `i18n-extract-reminder.mjs` | PostToolUse / `Edit\|Write` | Reminds to run `yarn i18n:extract` after new t() calls |
   | Wiki discipline | `wiki-discipline.mjs` | PostToolUse / `Edit\|Write` | Tracks code file edits, reminds to record a wiki page after 4+ files; resets when a project page is written |
   | Test companion | `test-companion.mjs` | PostToolUse / `Edit\|Write` | Test-related companion reminders |
   | Dep change | `dep-change-reminder.mjs` | PostToolUse / `Bash` | Reminds to install after dependency changes |
   | Session context | `session-context.mjs` | SessionStart | Injects branch, commits, uncommitted changes |
   | Completion gate | `completion-gate.mjs` | Stop | Checks for TODO/FIXME markers, incomplete work signals, triggers code review on session-edited files (scoped via code-guard tracking) |
   | Compact preservation | `compact-preservation.mjs` | PreCompact | Preserves critical context across context compactions |
   | Prompt context | `prompt-context.mjs` | UserPromptSubmit | Injects additional context per user prompt |
   | Failure protocol | `failure-protocol.mjs` | PostToolUseFailure | Handles tool failures with structured recovery |
   | Subagent review | `subagent-review.mjs` | SubagentStop | Reviews subagent output on completion |
   | Post-task review | `post-plan-review.sh` | TaskCompleted | Triggers code review on files changed during the task |
   | Stop gate (alt) | `stop-gate.sh` | Stop (optional) | Multi-workspace verification with infinite-loop prevention — alternative to completion-gate |
   | Auto-check (shell) | `auto-check.sh` | PostToolUse / `Edit\|Write` | Shell variant of auto-check with backend (sbt compile) support |

7. **Fill in the Vendor Knowledge table** in CLAUDE.md. List the vendor rules that were deployed,
   grouped by domain. Read the `domain:` and `paths:` frontmatter from each deployed
   `.claude/rules/vendor/*.md` and write one row per domain: `| <domain> | <what the rules auto-load on> |`.
   No script — it's a short table the bootstrap template scaffolds with a commented example.

8. **Scaffold project infrastructure** (optional):
    - Ask user: "Deploy scaffold files (dev scripts, Docker, sync tools, CI/CD)?"
    - Preview available files:
      ```bash
      ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project --group scaffold
      ```
    - If approved, deploy:
      ```bash
      ~/.claude/skills/webstack/scripts/sync.sh apply /path/to/project --group scaffold
      ```
    - Existing files are never overwritten (no-clobber)
    - Ask user for their project name, then replace `myproject` placeholders in `dev.sh` (session name) and any other scaffold files
    - Remind user to copy `.env.example` to `.env` and fill in credentials
    - **Stripe CLI** is optional — `dev.sh` includes a commented-out tmux pane for `stripe listen`. Only uncomment if the project uses Stripe webhooks.

### On an existing project (`/webstack update`)

**CRITICAL: Use scripts for all file operations.** Never manually copy, write, or edit files in `.claude/rules/core/`, `.claude/hooks/`, or `.claude/settings.json`. The scripts handle version comparison, stack detection, and settings merging deterministically. Manual operations cause version drift, duplicate hooks, and settings corruption.

0. **Run preflight check** — see "Requirements" section above. Stop if any dependency is missing.

0a. **Detect knowledge mode and guard the update.** The full update deploys KG-free rules that tell the
    agent "knowledge is in the wiki." If the project still has un-migrated Knowledge-Graph knowledge, that
    knowledge goes dark. Classify by the state of `.memory/graph.jsonl`:

    - **Non-empty `.memory/graph.jsonl`** (regardless of whether `.claude/rules/project/` exists) → the
      graph may hold **un-migrated** knowledge. Do **NOT** run a full update until you confirm it's
      migrated. Note that a partial wiki (a few pages) does NOT mean the graph was migrated — a project
      can be hybrid. Verify: has `kg-to-wiki.sh` been run and the graph archived to `.jsonl.migrated`?
      If not, migrate first (update step 7), review `MIGRATION-REPORT.md`, then archive the graph. Only
      then proceed. As an interim, a **vendor-only update** is always safe: `sync.sh apply /path/to/project --group vendor`.
    - **No graph, or graph renamed to `.memory/graph.jsonl.migrated`** → **wiki mode** — proceed to step 1.

    Only proceed to a full update once the graph is empty/archived (or the user explicitly overrides,
    accepting that KG-only knowledge will no longer auto-load).

1. **Run CLAUDE.md drift check:**
   ```bash
   ~/.claude/skills/webstack/scripts/drift-check.sh /path/to/project
   ```
   Show results to user. If S0 FAIL (missing), suggest `/webstack init`. If S1 MISSING, fix with `bootstrap-claude-md.sh`. Continue — informational, not blocking.

2. **Run deployment comparison:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project
   ```
   Outputs JSON action table. Present it to the user as a formatted table.

3. **The project wiki is preserved automatically.** Everything under `.claude/rules/project/` and
   `.claude/docs/` is project-owned files that `sync.sh apply` never prunes — there is nothing to
   detect or migrate. If a legacy `.memory/graph.jsonl` exists, the project predates the wiki: offer an
   opt-in migration (see step 7).

4. **Lint the project wiki** (knowledge health, replaces the old KG entity-match check):
   ```bash
   /path/to/project/.claude/scripts/wiki.sh lint --root /path/to/project
   ```
   Report schema errors, pages missing `paths:`, glob collisions, staleness, and unreachable docs.
   Present unified findings from steps 1 and 4.

5. **Wait for user approval**

6. **Deploy file-based updates:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh apply /path/to/project
   ```
   This single command deploys all rules, hooks, configs, merges settings, prunes stale files, and records `.claude/webstack.sha`. Do NOT manually write any files that this command handles. Report any `PRUNE` actions to the user — these are files removed because they no longer exist in the skill.

   **Safe directories:** `.claude/rules/project/` is never touched — pruning is scoped to `core/` and `vendor/` only. Project-specific rules are always preserved.

7. **Legacy graph migration (only if `.memory/graph.jsonl` exists).** Vendor docs are file-deployed by
   `sync.sh apply` — there are no entities to register or reconcile. If the project still has a KG from
   the pre-wiki era, offer a one-shot, opt-in migration:
   ```bash
   ~/.claude/skills/webstack/scripts/kg-to-wiki.sh --root /path/to/project            # dry-run plan
   ~/.claude/skills/webstack/scripts/kg-to-wiki.sh --root /path/to/project --apply     # write pages
   ```
   It never overwrites existing pages and writes `MIGRATION-REPORT.md` (pages needing `paths:`, entities
   flagged `multi-fact` to split). After `--apply`, fix paths and run `wiki.sh lint`, then `wiki.sh sync`.
   Leave `.memory/graph.jsonl` in place; archive it to `.jsonl.migrated` once satisfied.

8. **Regenerate the wiki index:**
   ```bash
   /path/to/project/.claude/scripts/wiki.sh sync --root /path/to/project
   ```
   Refreshes `WIKI.md` and backlinks from the project pages' frontmatter.

9. **Cleanup legacy artifacts:** rules and hooks are pruned automatically by `sync.sh apply` (action
   `PRUNE`). `.claude/rules/project/` and `.claude/docs/` are never pruned. No manual KG cleanup exists.

10. **Scan for backport candidates** — knowledge worth contributing back to the skill. `core/process/backporting`
    tells the working agent to flag generalizable findings with `backport: true` frontmatter. Find them:
    ```bash
    grep -rl "backport: true" /path/to/project/.claude/rules/project
    ```
    For each, and for any project pitfall whose root cause is in a library (not project business logic),
    present a candidate:
    ```
    ### Backport Candidates
    | Page | Type | Content | Action |
    |------|------|---------|--------|
    | pitfalls/clientloader-ssr.md | pitfall | clientLoader SSR behavior | Add to vendor/react-router-8/routing.md |
    | pitfalls/date-hydration.md | pitfall | Date.now() server/client divergence | Add to vendor/react-router-8/routing.md Known Issues |
    ```
    Also check `.claude/rules/` for project rule files outside `core/`/`vendor/`/`project/` that encode
    generalizable patterns — candidates for new core templates.

    If the user approves:
    1. Read the skill source: `~/.claude/skills/webstack/vendor/{file}.md` or `core/{subdir}/{file}.md`
    2. Add the pitfall/content to the appropriate section
    3. Bump the template's version (patch for pitfall additions)
    4. Note that subsequent `/webstack update` on other projects picks up the change

    This step is informational — skip silently if no candidates are found.

### Periodic health check (`/webstack maintenance`)

Audits KG entities, rules, relations, and project hygiene without deploying templates. Run periodically (e.g., every few weeks, or when KG feels stale).

0. **Run preflight check** — see "Requirements" section above. If `.claude/webstack.sha` doesn't exist, warn that `/webstack init` may not have run yet — continue anyway (some checks still work).

1. **Snapshot project state** — gather all data needed by subsequent steps in one pass. Run these in parallel:

   **a)** Run `scripts/sync.sh compare /path/to/project` → full deployment diff (rules, hooks, configs, vendor)

   **b)** Read `package.json` (root + 1 level deep for monorepos) → installed versions

   **c)** List `.claude/rules/` recursively → deployed rule inventory

   **d)** `.claude/scripts/wiki.sh lint --root /path/to/project` → project wiki health (schema, `paths:`, collisions, staleness, unreachable docs)

   **e)** List `.claude/rules/project/` and `.claude/docs/` → project wiki inventory (pitfalls, decisions, conventions, domain maps, system docs)

   **f)** Read `.claude/settings.json` and `.claude/settings.local.json` (if exists) → permissions, MCP tool patterns

   No user-visible output yet — this feeds steps 2–11.

2. **Vendor version audit** — for each deployed vendor rule file and KG reference entity, run three checks:

   **a) Rule file drift:**
   Compare deployed `.claude/rules/vendor/*.md` against skill source `vendor/*.md` using `sync.sh compare --group vendor`. Flag files where the deployed version is older than the template.

   **b) Installed version match:**
   ```
   Rule file applies: daisyui@5
   package.json: daisyui@5.8.0 → PASS (major matches)

   Rule file applies: daisyui@5
   package.json: daisyui@6.1.0 → MISMATCH — rule is for v5, project has v6
   ```
   Flag if the project upgraded past the rule's major version.

   **c) Orphaned files:** vendor rule files in `.claude/rules/vendor/` with no matching source template in the boilerplate (candidates for removal in step 11).

   Output table:
   ```
   | Rule File | Template Ver | Deployed Ver | Installed | Status |
   |-----------|-------------|-------------|-----------|--------|
   | daisyui-5.md | 1.3.0 | 1.3.0 | 5.8.0 | PASS |
   | react-router-8/routing.md | 2.0.0 | 1.5.0 | 7.11.0 | DRIFT |
   | payload/cms-3.md | 1.2.0 | 1.2.0 | 4.1.0 | MISMATCH (rule v3, installed v4) |
   | old-library.md | — | 1.0.0 | (removed) | ORPHAN |
   ```
   Report-only. DRIFT → suggest running `/webstack update`. MISMATCH → warn that entity may contain outdated patterns. ORPHAN → propose removal in step 11.

3. **Core rules file audit** — compare `.claude/rules/core/*.md` against boilerplate templates:

   - **Orphaned rules** — files in `core/` with no matching template (template removed or renamed)
   - **Missing rules** — templates where `applies` matches the stack but no file is deployed
   - **Version drift** — deployed version vs template version (same extraction as update step 2)
   - **Content tampering** — if versions match, diff content bodies to detect local edits that the next `/webstack update` will silently overwrite

   Output table:
   ```
   | Rule File | Template | Deployed Ver | Template Ver | Status |
   |-----------|----------|-------------|-------------|--------|
   | tooling.md | core/process/tooling | 2.2.0 | 2.2.0 | PASS |
   | react-components.md | core/frontend/... | 1.5.0 | 1.6.0 | DRIFT |
   | old-rule.md | (none) | 1.0.0 | — | ORPHAN |
   | — | core/testing/e2e | — | 1.1.0 | MISSING |
   | tooling.md | core/process/tooling | 2.2.0 | 2.2.0 | MODIFIED (local edits) |
   ```
   Report-only. ORPHAN files proposed for removal in step 11.

4. **Project wiki audit** — from the `wiki.sh lint` snapshot (step 1d), report:

   - **Schema errors** — pages with missing/invalid frontmatter, `type:`/`status:` out of enum
   - **Missing/unbounded `paths:`** — a page with no `paths:` always-loads; a `**` glob floods context
   - **Glob collisions** — >~8 pages sharing one glob (reading one file injects them all)
   - **Staleness** — pages whose `verified-against:` names a version no longer installed (check `package.json`)
   - **Unreachable docs** — `.claude/docs/` system docs that no domain map or page links to
   - **Bloat** — atoms over the line budget (candidates to split, or move detail to a `.claude/docs/` doc)

   Report-only. `wiki.sh lint` produces most of this; add the staleness cross-check against installed versions.

5. **Legacy graph check** — if `.memory/graph.jsonl` exists, the project has un-migrated KG knowledge.
   Report it and offer `kg-to-wiki.sh` (see update step 7). Report-only.

6. **Rule contradiction detection** — analyze all rule files in `.claude/rules/` plus `CLAUDE.md` for conflicting instructions:

   **a) Opposing directives** — scan for instruction pairs that commonly conflict:
   - Component exports: `export default` vs `export const` (named)
   - Component typing: `React.FC` vs bare arrow functions
   - Error handling: `try/catch` in loaders vs ErrorBoundary-only
   - Dev workflow: "never run dev server" vs "run yarn dev"
   - Import style: barrel imports vs direct imports

   Read each rule file, collect directive statements, flag contradicting pairs across files.

   **b) Scope overlap** — check for rules with overlapping `paths:` frontmatter that cover the same topic with different guidance. Extract `paths:` from each rule file's frontmatter and find intersections.

   **c) CLAUDE.md vs rules** — instructions in CLAUDE.md that contradict a deployed rule. Since CLAUDE.md takes precedence, flag these so the user can decide whether to update the rule or the CLAUDE.md.

   **d) Stale references** — rules referencing commands (`yarn xyz`), file paths (`app/features/...`), or tool names that no longer exist in the project. Check against `package.json` scripts, file system, and available MCP tools.

   Output:
   ```
   | File A | File B | Topic | Conflict |
   |--------|--------|-------|----------|
   | core/react-components.md | CLAUDE.md | Exports | "named exports only" vs "export default for pages" |
   | core/tooling.md | .claude/rules/dev.md | Dev server | "never start" vs "yarn dev" |
   | core/tooling.md | — | Command | References `yarn typecheck` (not in package.json scripts) |
   ```
   Report-only — user decides precedence.

7. **Stray file detection:**
   ```bash
   ~/.claude/skills/webstack/scripts/find-strays.sh /path/to/project
   ```
   Outputs JSON array of stray `.md` files with path, size, git status, and frontmatter detection.
   Report-only — user decides to keep, convert into a wiki page (`wiki.sh new`), or delete.

8. **Settings & MCP audit:**
   ```bash
   ~/.claude/skills/webstack/scripts/audit-settings.sh /path/to/project
   ```
   Outputs JSON with `permission_wildcards` (non-wildcarded MCP entries), `stale_hooks` (missing hook files), and `deny_entries` (informational).

   Auto-fixable: rewrite non-wildcarded entries as server-prefix wildcards. Stale hooks resolved by `sync.sh apply --group hooks,hook-infra,settings`.

9. **Context budget analysis:**
   ```bash
   ~/.claude/skills/webstack/scripts/context-budget.sh /path/to/project
   ```
   Outputs JSON with `always_loaded` rules, `path_scoped` rules (flagging broad patterns), `claude_md` size, and `totals` (vs 850-line / 20KB budget).
   Informational only.

10. **Cross-page contradiction detection** — find conflicting guidance across wiki pages and vendor rules:

   **a) Cross-page contradictions:** For pages in the same domain (shared `tags:`/`paths:`), compare guidance.
   Look for contradicting version requirements, conflicting patterns without a "when to use which," and a
   pitfall page that contradicts a convention page or a vendor rule.

   **b) Context7 pitfall verification** (optional, user-gated): For pitfall pages carrying `verified-against:`,
   verify against current library docs. Ask first: "Found N verifiable pitfalls. Verify via Context7? (y/n)"
   ```
   For each pitfall page:
     resolve-library-id → library ID for the package in verified-against
     query-docs → search for the pitfall's topic
     Compare: still valid in the current version? If FIXED, propose status: superseded.
   ```

   Output:
   ```
   ### Cross-Page Contradictions
   | Page A | Page B | Topic | Conflict |
   |--------|--------|-------|----------|
   | pitfalls/clientloader-ssr.md | conventions/data-loading.md | clientLoader | contradicting SSR behavior |

   ### Stale Pitfalls (Context7 verified)
   | Page | Pitfall | Current Status |
   |------|---------|---------------|
   | pitfalls/btn-ghost-color.md | "btn-ghost needs explicit color in v5" | FIXED in 5.7.0 → supersede |
   ```
   Report-only. Stale pitfalls proposed for `status: superseded` in step 12.

11. **CLAUDE.md drift check:**
    ```bash
    ~/.claude/skills/webstack/scripts/drift-check.sh /path/to/project
    ```
    Same checks as update step 1 but standalone. Offer to auto-fix MISSING sections with `bootstrap-claude-md.sh`.

12. **Remediation proposals** — aggregate all findings into a unified health report:

    **Auto-fixable** (after blanket user approval):
    - Regenerate `WIKI.md` + backlinks (`wiki.sh sync`) if stale (step 1d/4)
    - Non-wildcarded MCP permissions → rewrite as server-prefix wildcards (step 8a)
    - Stale hook entries → remove from settings (step 8c)
    - Missing CLAUDE.md sections from bootstrap template (step 11, MISSING items)

    **User-decision required:**
    - Remove orphaned rule files from `.claude/rules/core/`,`vendor/` (steps 2c, 3)
    - Fix wiki schema errors / add missing `paths:` / split colliding or bloated pages (step 4)
    - Migrate a legacy `.memory/graph.jsonl` via `kg-to-wiki.sh` (step 5)
    - Resolve rule/page contradictions — decide which takes precedence (steps 6, 10)
    - Handle stray files — convert to a wiki page (`wiki.sh new`) or delete (step 7)
    - Stale MCP server references → propose removal (step 8b)
    - `status: superseded` for stale pitfalls verified by Context7 (step 10b)

    **Informational** (no action, awareness only):
    - Version drift between templates and deployed rules → recommend `/webstack update` (step 2a)
    - Installed version mismatches (step 2b)
    - Context budget breakdown (step 9)
    - Content tampering in rules (step 3)
    - Stale deny entries (step 8d)

    Ask: "Apply auto-fixes? (WIKI.md regen, CLAUDE.md sections, MCP wildcards, stale hooks)"

13. **Execute fixes and final report:**

    Execute approved auto-fixes:
    - `wiki.sh sync` to regenerate `WIKI.md` + backlinks
    - Rewrite `permissions.allow` entries to use server-prefix wildcards, remove redundant individual entries
    - Remove stale hook entries from `.claude/settings.json`
    - Append missing sections to CLAUDE.md from bootstrap template

    Execute user-approved individual fixes:
    - Edit wiki pages to fix schema / add `paths:` / set `status: superseded` on stale pitfalls
    - Remove stale MCP permission entries
    - Add missing hook entries to `.claude/settings.json`
    - Delete approved stray files

    Log each action taken.

    **Final report:**
    ```
    ### Health Report Summary

    | Category | Issues Found | Fixed | Needs User Action | Info Only |
    |----------|-------------|-------|--------------------|-----------|
    | Vendor versions | 3 | 0 | 0 | 3 (run /webstack update) |
    | Core rules | 2 | 0 | 1 orphan | 1 drift |
    | Project wiki (lint) | 8 | 1 (sync) | 5 (paths/split) | 2 |
    | Legacy graph | 1 | 0 | 1 (migrate) | 0 |
    | Rule/page contradictions | 2 | 0 | 2 | 0 |
    | Stray files | 1 | 0 | 1 | 0 |
    | Settings & MCP | 4 | 2 wildcarded | 1 stale server | 1 deny entry |
    | Context budget | 0 | 0 | 0 | budget OK |
    | CLAUDE.md drift | 1 | 1 | 0 | 0 |
    ```

    **No SHA update** — maintenance does not deploy templates, so the SHA stays unchanged. The SHA only updates on `/webstack init` and `/webstack update`.

### Template Versioning

Each template has YAML frontmatter with `version`, `applies`, `target`, `priority` (optional), and `tags`. Read `references/versioning.md` for the full schema, applies condition patterns, operators, version comparison rules, and when to bump versions.

**Quick reference — applies operators:**
- `Always` — unconditional
- `package-name` — package in dependencies/devDependencies
- `pkg@N` — version starts with `N.` (major match)
- `pkg@X.Y.Z+` — version >= X.Y.Z (same major)
- `a | b` — OR (at least one matches)
- `a & b` — AND (all must match)
- `.dir/path` — directory exists in project root

### Vendor docs

Vendor reference is deployed as path-scoped rule files under `.claude/rules/vendor/` (one file per topic).
Each declares `paths:` and `domain:` frontmatter and auto-loads when you read a file in its domain. There
are no vendor entities to register — the file is the source of truth. `sync.sh` handles deployment,
pruning, and version comparison from frontmatter.

## Automatic Updates During Work

These happen outside of this skill — they are standing instructions for how conventions evolve during normal development. The write triggers and page formats are defined in `core/process/knowledge-base` (deployed to `.claude/rules/core/knowledge-base.md`): record a pitfall/decision/convention as a path-scoped wiki page via `.claude/scripts/wiki.sh new`.

Session progress → Claude Code auto memory (`MEMORY.md`), separate from the project wiki.

## Contributing Back to the Boilerplate

**Pitfalls and postmortems that are generalizable (not project-specific) should be contributed back to this skill** so all projects benefit.

When you discover something that would help other projects:
1. **Vendor issues:** Add to `vendor/{library}.md` in the boilerplate under "Known Issues"
2. **General patterns:** Update the relevant `core/{subdir}/*.md` template
3. **New library:** Create a new `vendor/{library}.md` template with `applies` and `target: rules`

Examples of what to contribute back:
- Library version gotchas (e.g., "DaisyUI 5 removed form-control")
- Framework quirks (e.g., "RR8 loaders run in parallel, not sequentially")
- Security patterns discovered during reviews
- Build/tooling issues that affect multiple projects

Examples of what stays project-specific:
- Business logic bugs
- Project-specific architecture decisions
- Environment/deployment issues unique to one setup

### Pitfall page format

Record a resolved bug as a path-scoped pitfall page — `.claude/scripts/wiki.sh new pitfall <slug>`, then fill it in:

```markdown
---
schema: 1
title: One-sentence statement of the pitfall
type: pitfall
status: active
created: YYYY-MM-DD
paths:
  - "**/narrowest/glob/that/fires/**"   # required — scope to the code it concerns
tags: [area, library]
links: [vendor/<slug>]                    # optional — the vendor rule it relates to
---

# Title

**Symptom:** what went wrong.
**Root cause:** why it happened.
**Fix:** how it was resolved.
```

One pitfall per page. See `core/process/knowledge-base` § Atomicity.

## CLAUDE.md Bootstrap

The CLAUDE.md bootstrap describes where knowledge lives (the wiki) and the deployed rule set. MCP tool usage rules are in `.claude/rules/core/mcp-tools.md`; the knowledge model is in `.claude/rules/core/knowledge-base.md` (both auto-loaded).

### Required CLAUDE.md Content

Read the bootstrap template from `references/bootstrap-template.md` and deploy it. The template includes: Commands, Architecture, Rules, Vendor Knowledge (with domain table), and Knowledge accumulation sections.

On `/webstack init`, if no CLAUDE.md exists: create it from the template. If it exists but is missing required sections (especially `## Vendor Knowledge`): append them.

### Update: CLAUDE.md Drift Checks

On `/webstack update`, step 1 runs drift detection against the bootstrap template invariants. Read `references/drift-checks.md` for the full check specification (IDs S1-S2, C1-C5).

Key rules:
- The drift report is informational, not blocking — always continue with template updates
- For MISSING sections: offer to append from bootstrap template
- For legacy sections (e.g., `## Vendor Memory Loading`): offer to rename/remove
- Never overwrite existing project-specific content (Commands, Architecture, Rules)
