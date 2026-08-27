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

Core conventions are deployed to `.claude/rules/core/`. A rule is **always loaded** when it has no
`paths:` frontmatter — Claude Code injects it every turn.
Add `paths:` and it becomes **path-scoped**, loading only when you touch a matching file. That single
frontmatter key is the whole mechanism, so the tables below are read off disk rather than maintained by
hand. Regenerate after adding or rescoping a template:

```bash
~/.claude/skills/webstack/scripts/gen-inventory.sh --write   # rewrite the blocks below
~/.claude/skills/webstack/scripts/gen-inventory.sh --check   # CI: fail if stale
```

**Always loaded** — the per-turn baseline cost. Before adding one, check whether `paths:` would do.

<!-- generated:budget -->
| Rule | Lines | Bytes | Tags |
|------|-------|-------|------|
| `process/code-review` | 140 | 7994 | code-review, review, security, quality, validation, smells, comments, ste, best-practices |
| `process/engineering-discipline` | 243 | 15165 | engineering, process, planning, verification, discipline, workflow |
| `process/interaction` | 120 | 6210 | interaction, language, ste, asd-ste100, questions, wizard, density |
| `process/issue-tracking` | 108 | 8510 | issue-tracking, github, gh, workflow, process, definition-of-done |
| `process/knowledge-base` | 93 | 4808 | knowledge, wiki, memory, rules, atomicity, pitfalls, decisions |
| `process/mcp-tools` | 105 | 5206 | mcp, context7, codebase-memory, code-discovery, knowledge-base, tools, workflow |
| `process/requirements-engineering` | 93 | 4267 | requirements, planning, process |
| `process/security-checklist` | 61 | 2025 | security, auth, validation, XSS, CSRF, injection |
| `process/tooling` | 214 | 12025 | tooling, yarn, check, typescript, eslint, biome, verification |
| **Total** | **1177** | **66210** (~64 KB) | per-turn baseline |

Budget in `scripts/context-budget.sh`: 850 lines / 20480 bytes.
**Currently over budget** by 45730 bytes. Path-scope or trim before adding more.
<!-- /generated:budget -->

**Path-scoped:**

<!-- generated:scoped -->
| Rule | Loads when you touch |
|------|----------------------|
| `claude-config/claude-md` | `CLAUDE.md, .claude/**, CLAUDE.local.md` |
| `claude-config/claude-settings` | `.claude/**, CLAUDE.md` |
| `claude-config/mcp-servers` | `.claude/**, **/*mcp*, **/*playwright*, **/.cbmignore` |
| `claude-config/writing-rules` | `CLAUDE.md, .claude/**, SKILL.md, **/rules/**` |
| `frontend/i18n` | `**/*.tsx, **/*.ts, **/locales/**, **/i18n*` |
| `frontend/react-components` | `**/*.tsx, **/*.ts, !**/*.test.*, !**/*.spec.*` |
| `frontend/ssr-hydration` | `**/*.tsx, **/*.ts` |
| `frontend/state-management` | `**/*.tsx, **/*.ts, !**/*.test.*, !**/*.spec.*` |
| `process/backporting` | `.claude/rules/project/**, .claude/docs/**, CLAUDE.md` |
| `process/code-change-gates` | `**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.py, **/*.go, **/*.rs` |
| `process/dependencies` | `**/package.json, **/tsconfig*.json, **/eslint.config.*, **/.eslintrc*, **/.fallowrc*, **/yarn.lock, **/package-lock.json, **/pnpm-lock.yaml` |
| `process/monorepo` | `packages/**, apps/**, services/**, backend/**, frontend/**, scripts/**, docker-compose*, dev.sh, install.sh` |
| `process/multi-agent` | `.claude/rules/core/multi-agent.md` |
| `process/payload-api` | `backend/**` |
| `process/scripting` | `scripts/**, **/*.sh` |
| `testing/browser-verification` | `**/*.tsx, **/*.jsx, **/*.vue, **/*.svelte, **/routes/**, **/routes.ts` |
| `testing/e2e-testing` | `**/*.test.*, **/*.spec.*, **/tests/**, **/e2e/**, **/playwright*, backend/**, frontend/**, **/api/**, **/routes/**` |
| `testing/e2e-validation` | `**/*.spec.*, **/e2e/**, **/playwright*, backend/**, frontend/**, **/routes/**` |
| `testing/unit-testing` | `**/*.test.ts, **/*.spec.ts, **/vitest*, !**/*.test.tsx, !**/*.spec.tsx, backend/**` |
<!-- /generated:scoped -->

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
| `codebase-memory-mcp` | Structural code discovery (global npm binary) | `npm install -g codebase-memory-mcp` | `npm install -g codebase-memory-mcp` |

### MCP Servers

Verify each by attempting a lightweight call. If any fails, show the missing server and the install command, then stop.

| Server | Verify with | Purpose | Install |
|--------|------------|---------|---------|
| Context7 | `resolve-library-id` with query `"react"` | Version-specific library documentation | `claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp` |
| codebase-memory-mcp | Any `mcp__codebase-memory-mcp__*` tool available | Structural code discovery — `search_graph`, `trace_call_path` | Register in the project `.mcp.json`, not with `claude mcp add`. See `core/claude-config/mcp-servers` § codebase-memory-mcp |
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

This installs user-scoped tools (context-mode, memory, context7) and the global npm binary
`codebase-memory-mcp`. Project-scoped servers (Playwright, Payload MCP, codebase-memory-mcp) are
registered during `/webstack init` — the script only puts the binary on PATH.

### Preflight Sequence

Run this at the start of every `/webstack init` or `/webstack update`:

1. Run `scripts/preflight.sh` — if exit code is non-zero, report missing CLI tools with install commands and stop
2. Call `resolve-library-id` with query `"react"` — if the tool is not available, report "Context7 MCP server not configured. Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` or: `claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp`" and stop
3. Check whether **any** `mcp__plugin_context-mode_context-mode__*` tool is available — if none is, report "context-mode plugin not installed. Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` or: `claude plugin install context-mode@context-mode`" and stop

   Match on the server prefix, never on a specific tool name. context-mode has renamed its tools before (`__execute` → `__ctx_execute`), and a hardcoded name turns a working install into a hard stop at step 0.

4. Check whether any `mcp__codebase-memory-mcp__*` tool is available. If none is, the project has not
   registered the server in its `.mcp.json`. Report it and continue — this one is **not** a hard stop
   while projects are still adopting the graph. `scripts/preflight.sh` already told you at step 1
   whether the global binary is on PATH; the two failures are different and need different fixes.

   | Symptom | Fix |
   |---------|-----|
   | `preflight.sh` reports `codebase-memory-mcp: available false` | `npm install -g codebase-memory-mcp` |
   | Binary present, no `mcp__codebase-memory-mcp__*` tool | Add the server block to the project `.mcp.json` — `core/claude-config/mcp-servers` § codebase-memory-mcp |

   **Never run `codebase-memory-mcp install`** to fix either one. It writes MCP entries, skills and hooks
   into 43 global agent surfaces. The skill does not manage `.mcp.json`, so offer the block and let the
   user apply it.

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

## Layout

Each top-level directory maps to a `manifest.json` group, and the group decides where its files land and
how updates are compared. That mapping is the thing worth knowing; the file list itself is `find`'s job.

| Directory | Deploys to | Versioning | Notes |
|-----------|-----------|------------|-------|
| `core/` | `.claude/rules/core/` | frontmatter `version:` | Subdir flattened. `paths:` decides always-loaded vs scoped |
| `vendor/` | `.claude/rules/vendor/` | frontmatter `version:` | Path preserved. Conditional on `applies:` |
| `agents/` | `.claude/agents/` | checksum | Subagent definitions |
| `.claude/hooks/` | `.claude/hooks/` | `// version:` comment | Dispatched via `run.sh`; see Hooks below |
| `scripts/wiki.sh`, `kg-to-wiki.sh` | `.claude/scripts/` | checksum | The wiki tooling the project itself runs |
| `scaffold/.editorconfig` | project root | no-clobber | Always deployed — every project gets one |
| `scaffold/` (rest) | project root | no-clobber | Optional; needs `--group scaffold`; never overwrites |
| `core/playwright-mcp.config.json` | `.claude/` | overwrite | |

`scripts/` (other than the two above) stays in the skill — it is the deployment machinery, not payload:
`sync.sh` (compare/apply), `gen-inventory.sh` (regenerates the tables in this file), `evaluate-applies.sh`,
`preflight.sh`, `setup-user-env.sh`, `drift-check.sh`, `bootstrap-claude-md.sh`, `find-strays.sh`,
`audit-settings.sh`, `context-budget.sh`.

### Hooks

`run.sh <name>` resolves `<name>.ts` first, then `<name>.mjs`, and runs it under bun (or node
`--experimental-strip-types`). Line 1 of each hook is `// version:` for `sync.sh` comparison; line 2 is a
one-sentence description, which is where the Purpose column below comes from.

<!-- generated:hooks -->
| Hook | File | Event / Matcher | Purpose |
|------|------|-----------------|---------|
| auto-check | `auto-check.mjs` | PostToolUse / `Edit\|Write` | Runs `yarn check` after a code edit, resolving the nearest workspace in a monorepo. |
| bash-guard | `bash-guard.mjs` | PreToolUse / `Bash` | Blocks risky Bash: inline env vars, ad-hoc scripting, loops, linter isolation, dev servers, unsafe git. |
| code-guard | `code-guard.mjs` | PreToolUse / `Write\|Edit` | Content gate on writes (React.FC, default exports, .test.tsx, i18n, shell compat, comment length); tracks session-edited files for completion-gate. |
| compact-preservation | `compact-preservation.mjs` | PreCompact / `—` | Tells the compaction summary what to keep: requirements, decisions and rationale, risks. |
| completion-gate | `completion-gate.ts` | Stop / `—` | Stop gate: checks for TODO/FIXME markers and incomplete-work signals, and triggers review on session-edited files. |
| context7-guard | `context7-guard.mjs` | PostToolUse / `mcp__context7__resolve-library-id` | Enforces resolve-library-id before query-docs, so docs are fetched for a real library ID. |
| context7-guard | `context7-guard.mjs` | PreToolUse / `mcp__context7__query-docs` | Enforces resolve-library-id before query-docs, so docs are fetched for a real library ID. |
| dep-change-reminder | `dep-change-reminder.mjs` | PostToolUse / `Bash` | Reminds you to install after a dependency manifest changes, so the lockfile and node_modules keep up. |
| edit-review | `edit-review.mjs` | PostToolUse / `Edit\|Write` | Non-blocking self-review nudge after each code edit, debounced per file. |
| failure-protocol | `failure-protocol.mjs` | PostToolUseFailure / `—` | After 2 consecutive tool failures, injects a diagnose-before-retry checklist instead of letting the loop run. |
| i18n-extract-reminder | `i18n-extract-reminder.mjs` | PostToolUse / `Edit\|Write` | Reminds you to run `yarn i18n:extract` after adding t() calls, so locale files stay in sync. |
| migration-guard | `migration-guard.mjs` | PreToolUse / `Write\|Edit` | On writes to migration or schema files, injects the reversibility and data-loss checks to run first. |
| payload-guard | `payload-guard.mjs` | PreToolUse / `mcp__payload__*` | Checks Payload MCP calls for the missing data wrapper, empty objects, and null enum fields. |
| peer-message-guard | `peer-message-guard.mjs` | PostToolUse / `SendMessage` | Keeps peer messages terse and in Simplified Technical English, and blocks relaying the exchange |
| peer-message-guard | `peer-message-guard.mjs` | PreToolUse / `SendMessage` | Keeps peer messages terse and in Simplified Technical English, and blocks relaying the exchange |
| prompt-context | `prompt-context.mjs` | UserPromptSubmit / `—` | On a review request, injects the code files edited this session (session state ∩ git diff) to scope it. |
| requirements-gate | `requirements-gate.mjs` | PreToolUse / `EnterPlanMode` | Before plan mode, injects the requirements questions to settle with the user first (core/process/requirements-engineering). |
| research-gate | `research-gate.mjs` | PreToolUse / `EnterPlanMode\|ExitPlanMode\|Agent\|Task` | Before planning or delegating, injects the research checklist: wiki find, Context7, WebSearch. |
| rules-guard | `rules-guard.ts` | PreToolUse / `Write\|Edit` | Write-time quality gate for .claude/rules/**: frontmatter, non-empty paths:, upstream-edit warning, bloat. |
| screenshot-guard | `screenshot-guard.ts` | PreToolUse / `mcp__playwright__browser_(take_screenshot\|pdf_save\|storage_state)` | Keeps browser artifacts small AND inside the configured output directory. |
| session-context | `session-context.mjs` | SessionStart / `—` | Injects branch, recent commits, uncommitted changes, wiki counts and the multi-agent digest at session start. |
| subagent-review | `subagent-review.mjs` | SubagentStop / `—` | Flags a subagent that returned nothing, so an empty result is not mistaken for a clean one. |
| test-companion | `test-companion.mjs` | PostToolUse / `Edit\|Write` | Reminds you once per source file to add its companion .test.ts. |
| wiki-discipline | `wiki-discipline.ts` | PostToolUse / `Edit\|Write` | Reminds you to record durable knowledge as a path-scoped wiki page after several code edits. |
<!-- /generated:hooks -->

Regenerate with `scripts/gen-inventory.sh --write` after adding, renaming, or rewiring a hook. A hook not
dispatched in `.claude/settings.json` does not run and will not appear here.

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

   **MCP scope note:** Playwright MCP is project-scoped (installed here). Context7 and plugins are user-scoped — see "User Environment Setup" above. `sync.sh apply` also deploys `wiki.sh`/`kg-to-wiki.sh` to `.claude/scripts/` (the `wiki-scripts` group) and the subagent definitions to `.claude/agents/` (the `agents` group).

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

   **Hooks inventory** — see the generated table under "Hooks" below.

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

1a. **Check MCP wiring:**
   ```bash
   ~/.claude/skills/webstack/scripts/check-mcp-wiring.sh /path/to/project
   ```
   Deploying `.claude/playwright-mcp.config.json` does **not** make it take effect — nothing reads it
   unless `.mcp.json` passes `--config`, and a relative `outputDir`/`--output-dir` resolves against the
   MCP server's cwd rather than the project, so artifacts land wherever Claude Code was launched from.
   The skill does not manage `.mcp.json`, so this must be verified rather than assumed. Report any
   `ERROR` findings and offer the exact `.mcp.json` fix; they are one-line edits.

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
    # Candidates are pages flagged for backport that have NOT already been carried upstream.
    # `backported:` records the skill sha a page landed in — without excluding it, every past
    # backport re-proposes forever and the scan stops being a work list.
    grep -rl "backport: true" /path/to/project/.claude/rules/project \
      | xargs grep -L "^backported:"
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

    **After a candidate lands upstream, stamp its page** with the skill commit that carried it —
    `backported: <sha>` in the page's frontmatter, alongside the existing `backport: true`. Do this in
    the same pass that lands it; a page stamped without the content upstream is worse than an unstamped
    one, because the next scan skips it silently.

    If the user approves:
    1. Read the skill source: `~/.claude/skills/webstack/vendor/{file}.md` or `core/{subdir}/{file}.md`
    2. Add the pitfall/content to the appropriate section
    3. Bump the template's version (patch for pitfall additions)
    4. Note that subsequent `/webstack update` on other projects picks up the change

    This step is informational — skip silently if no candidates are found.

### Periodic health check (`/webstack maintenance`)

Audits deployed rules, the project wiki, settings and project hygiene **without deploying templates**.
Run every few weeks, or when the rule set starts feeling stale or contradictory.

Read `references/maintenance.md` for the full 13-step specification: what each step gathers, the exact
scripts to run, the output tables, and which findings are auto-fixable versus user-decision.

Nothing in maintenance writes without asking, and it never updates `.claude/webstack.sha` — no templates
are deployed.


### Template Versioning

Each template has YAML frontmatter with `version`, `applies`, `target`, `priority` (optional), and `tags`. Read `references/versioning.md` for the full schema, applies condition patterns, operators, version comparison rules, and when to bump versions.

**`AHEAD` means stop, not skip.** When a target's `version` is newer than the source's, `sync.sh`
emits `AHEAD` and deploys nothing — the project edited that file locally and bumped it. Report it to
the user and offer to backport the target's copy into the boilerplate (`core/process/backporting.md`).
Never resolve `AHEAD` by bumping the source version to win the comparison.

**Quick reference — applies operators:**
- `Always` — unconditional
- `package-name` — package in dependencies/devDependencies
- `pkg@N` — version starts with `N.` (major match)
- `pkg@X.Y.Z+` — version >= X.Y.Z (same major)
- `a | b` — OR (at least one matches)
- `a & b` — AND (all must match)
- `.some/path` — file or directory exists in project root; `*`/`?` globs supported
  (e.g. `.github/workflows/*deploy*`). No `**` recursion — Bash 3.2 has no globstar.

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

Read the bootstrap template from `references/bootstrap-template.md` and deploy it. The template includes: How you answer (Simplified Technical English), Working with other sessions, Commands, Architecture, Rules, Vendor Knowledge (with domain table), and Knowledge accumulation sections.

On `/webstack init`, if no CLAUDE.md exists: create it from the template. If it exists but is missing required sections (especially `## How you answer` and `## Vendor Knowledge`): append them.

### Update: CLAUDE.md Drift Checks

On `/webstack update`, step 1 runs drift detection against the bootstrap template invariants. Read `references/drift-checks.md` for the full check specification (IDs S1-S2, C1-C7).

Key rules:
- The drift report is informational, not blocking — always continue with template updates
- For MISSING sections: offer to append from bootstrap template
- For legacy sections (e.g., `## Vendor Memory Loading`): offer to rename/remove
- Never overwrite existing project-specific content (Commands, Architecture, Rules)
