---
name: webstack
description: Bootstrap web stack conventions into .claude/rules/ and Knowledge Graph vendor docs. Run on new projects or when conventions need updating.
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

**Always loaded** (~20KB) — `core/process/`:
- `core/process/tooling` — Commands, verification, git, agent behavior
- `core/process/mcp-tools` — MCP & plugin usage rules (KG, Context7), workflows
- `core/process/security-checklist` — Security review standards
- `core/process/code-review` — Code review standards
- `core/process/engineering-discipline` — Task assessment, verification, change classification, failure protocol
- `core/process/interaction` — Use AskUserQuestion wizard for clarifications
- `core/process/monorepo` — Directory discipline for multi-package projects

**Path-scoped** (loaded only when touching matching files):
- `core/frontend/react-components` — `**/*.tsx`, `**/*.ts` — Component patterns, useEffect
- `core/frontend/state-management` — `**/*.tsx`, `**/*.ts` — Context vs Zustand
- `core/frontend/i18n` — `**/*.tsx`, `**/*.ts`, `**/locales/**` — Translation patterns
- `core/frontend/ssr-hydration` — `**/*.tsx`, `**/*.ts` — SSR and client-only code
- `core/process/backporting` — `.memory/**`, `.claude/**`, `CLAUDE.md` — When to tag KG findings for backport
- `core/process/scripting` — `scripts/**`, `**/*.sh` — Script requirements, shell compatibility
- `core/process/payload-api` — `backend/**` — Payload MCP plugin usage
- `core/testing/e2e-testing` — `**/*.test.*`, `**/*.spec.*`, `**/e2e/**` — Playwright testing patterns
- `core/testing/e2e-validation` — `**/*.spec.*`, `**/e2e/**`, `**/routes/**` — Three-layer E2E test validation (results → network → logs)
- `core/testing/unit-testing` — `**/*.test.ts`, `**/*.spec.ts` — Vitest unit testing patterns
- `core/claude-config/claude-md` — `CLAUDE.md`, `.claude/**` — CLAUDE.md conventions
- `core/claude-config/claude-settings` — `.claude/**`, `CLAUDE.md` — Permission patterns
- `core/claude-config/mcp-servers` — `.claude/**` — MCP server setup
- `core/claude-config/writing-rules` — `CLAUDE.md`, `.claude/**`, `SKILL.md`, `**/rules/**` — How to write effective agent rules

**Context budget:** Always-loaded rules total ~850 lines (~20KB). This is the per-turn baseline cost. If adding new always-loaded rules, check whether path-scoping is possible first.

| Rule | Lines | Notes |
|------|-------|-------|
| tooling | ~195 | Commands, verification, git, tool discipline, agent behavior |
| mcp-tools | ~145 | Tool usage rules, KG read/write triggers |
| engineering-discipline | ~150 | Task assessment, verification, change classification |
| code-review | ~110 | Review standards |
| security-checklist | ~60 | Security review checklist |
| interaction | ~25 | Use AskUserQuestion wizard for clarifications |
| monorepo | ~30 | Directory discipline |

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
| Knowledge Graph | `search_nodes("preflight")` | Bug resolutions, decisions, vendor references | `claude mcp add memory --scope user -- npx -y @modelcontextprotocol/server-memory` |
| Context7 | `resolve-library-id` with query `"react"` | Version-specific library documentation | `claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp` |
| Payload (Payload projects only) | Any `mcp__payload__*` tool available | Payload CMS CRUD operations | `claude mcp add payload --transport http --scope project --header "Authorization: Bearer MCP-USER-API-KEY" -- http://localhost:3000/api/mcp` |

### Plugins

Verify by checking if the tool is available in the current session. If missing, show the install command and stop.

| Plugin | Verify with | Purpose | Install |
|--------|------------|---------|---------|
| context-mode | Any `mcp__plugin_context-mode_*` tool available | Large output handling, context budget management | `claude plugin install context-mode@claude-context-mode` |

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
2. Call `search_nodes("preflight")` — if the tool is not available, report "Knowledge Graph MCP server not configured. Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` or: `claude mcp add memory --scope user -- npx -y @modelcontextprotocol/server-memory`" and stop
3. Call `resolve-library-id` with query `"react"` — if the tool is not available, report "Context7 MCP server not configured. Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` or: `claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp`" and stop
4. Check if `mcp__plugin_context-mode_context-mode__execute` is available — if not, report "context-mode plugin not installed. Run `~/.claude/skills/webstack/scripts/setup-user-env.sh` or: `claude plugin install context-mode@claude-context-mode`" and stop

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
| `/webstack init` | New project — deploys rules + vendor docs, seeds KG references, and CLAUDE.md bootstrap |
| `/webstack update` | Existing project — diffs templates, preserves project-specific observations |
| `/webstack maintenance` | Periodic health check — audits KG, rules, relations, contradictions, stray files |

**For existing projects:**
- The skill compares each template against the deployed version (rule file)
- Project-specific KG observations (bug resolutions, decisions) are preserved
- You'll be shown what's new vs what already exists before any changes

**For periodic health checks:**
- Audits KG entity versions, relations, and quality without deploying templates
- Detects contradictions between rules, stale pitfalls, orphaned files, and context budget drift
- Auto-fixes safe issues (missing relations, CLAUDE.md sections) and reports the rest for user decision

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
│   │   ├── backporting.md         # Path-scoped: .memory/**, .claude/**, CLAUDE.md
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
│   ├── daisyui-5.md            # → entity: VendorDaisyui5
│   ├── tailwind-4.md           # → entity: VendorTailwind4
│   ├── react-router-7/         # → entities: VendorReactRouter7{Topic}
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
│   ├── react-router-7-integration.md
│   ├── react-router-7-i18n/
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
│   ├── conform-zod.md             # → entity: VendorConformZod
│   ├── playwright.md              # → entity: VendorPlaywright
│   └── project-scaffolding.md    # → entity: VendorProjectScaffolding
├── scripts/                    # Deployment and maintenance automation
│   ├── sync.sh                 # Deterministic asset sync (compare/apply)
│   ├── evaluate-applies.sh     # Template applicability evaluation
│   ├── preflight.sh            # CLI dependency check
│   ├── setup-user-env.sh       # User-scoped MCP/plugin setup
│   ├── generate-vendor-table.sh # CLAUDE.md vendor table generation
│   ├── check-relations.sh      # KG relation completeness check
│   ├── drift-check.sh          # CLAUDE.md drift checks (S1-C5)
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

| Category | Target | Location | Purpose | Lifecycle |
|----------|--------|----------|---------|-----------|
| **Core** | `.claude/rules/core/` | Auto-loaded every turn | Conventions, code style, review standards | Scaffolded from boilerplate, rarely edited |
| **Vendor** | Rule files (`.claude/rules/vendor/`) | Path-scoped, auto-loaded | Library/framework reference, version-pinned | Deployed by `sync.sh`, auto-loaded when editing matching files |
| **Issues** | Knowledge Graph (`bug_resolution`) | Queried via `search_nodes` | Bugs, decisions, relationships | Created during development, queryable |
| **Decisions** | Knowledge Graph (`architecture_decision`) | Queried via `search_nodes` | Why X was chosen over Y | Created during development |

### Why this split?

- **Rules** survive context compression — they're re-injected every turn at full fidelity. Core conventions need this because they must be followed consistently, even in long sessions.
- **Vendor docs** are also deployed as path-scoped rules in `.claude/rules/vendor/`. They auto-load when editing files matching their domain paths — no manual querying needed.
- **Knowledge Graph** handles bug resolutions, architecture decisions, and lightweight vendor references (pointing to the deployed rule files). Entities are queryable by type, content, and tags. The graph is portable (single `.memory/graph.jsonl` file) and supports relational linking between entities.

### Vendor doc loading

Vendor docs auto-load via path-scoped rules in `.claude/rules/vendor/` — no manual KG queries needed for vendor reference content. The Knowledge Graph contains lightweight reference entities (`vendor_doc` type) that point to the deployed rule files and track domain/source metadata for relational queries.

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

   **MCP scope note:** Playwright MCP is project-scoped (installed here). Other MCP servers (memory, context7) and plugins are user-scoped — see "User Environment Setup" above.

   **Payload projects:** If the project uses Payload CMS (has `payload` in dependencies), set up the Payload MCP server:
   ```bash
   claude mcp add payload --transport http --scope project --header "Authorization: Bearer MCP-USER-API-KEY" -- http://localhost:3000/api/mcp
   ```
   This requires `@payloadcms/plugin-mcp` in the backend's Payload config and a running backend. Add `"mcp__payload__*"` to the project's `.claude/settings.json` allow list.

6. **Create lightweight vendor reference entities** — for each `CHECK_KG` item from the comparison output:

   These are lightweight references pointing to the deployed rule files — no content body needed.

   ```
   create_entities([{
     name: "VendorDaisyui5",
     entityType: "vendor_doc",
     observations: [
       "domain: styling",
       "rule: .claude/rules/vendor/daisyui-5.md",
       "source: vendor/daisyui-5.md"
     ]
   }])
   ```

   **CRITICAL:** Ensure `.memory/` directory exists before creating entities. Run `mkdir -p .memory` if needed.

   **Hooks inventory:**

   All hooks are `.mjs` files dispatched through `run.sh` (bun/node). Each has a `// version:` comment on line 1. Version comparison is handled by `sync.sh`.

   | Hook | File | Event / Matcher | Purpose |
   |------|------|----------------|---------|
   | Bash guard | `bash-guard.mjs` | PreToolUse / `Bash` | Blocks env vars, inline scripts, loops, pipes, linter isolation, dev servers, git safety, shell compat, Payload CLI |
   | Research gate | `research-gate.mjs` | PreToolUse / `EnterPlanMode\|Task` | Injects research checklist (KG pitfalls + Context7 + WebSearch); vendor docs auto-load |
   | Code guard | `code-guard.mjs` | PreToolUse / `Write\|Edit` | Content inspection: React.FC, default exports, .test.tsx, @testing-library, i18n, shell compat. Tracks session-edited files for completion-gate scoping |
   | Migration guard | `migration-guard.mjs` | PreToolUse / `Write\|Edit` | Guards against unsafe migration patterns |
   | Context7 guard | `context7-guard.mjs` | PreToolUse / `query-docs` + PostToolUse / `resolve-library-id` | Enforces resolve-library-id before query-docs |
   | Screenshot guard | `screenshot-guard.mjs` | PreToolUse / `browser_take_screenshot` | Enforces JPEG format for screenshots |
   | Payload guard | `payload-guard.mjs` | PreToolUse / `mcp__payload__*` | Checks for data wrapper, empty objects, null enum fields |
   | Auto-check | `auto-check.mjs` | PostToolUse / `Edit\|Write` | Runs `yarn check` after code edits, finds nearest workspace |
   | i18n extract | `i18n-extract-reminder.mjs` | PostToolUse / `Edit\|Write` | Reminds to run `yarn i18n:extract` after new t() calls |
   | KG discipline | `kg-discipline.mjs` | PostToolUse / `Edit\|Write` + KG write tools | Tracks code file edits, reminds about KG writes (bug_resolution, architecture_decision) after 4+ files |
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

7. **Generate the Vendor Knowledge table** in CLAUDE.md:
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project --group vendor | \
     ~/.claude/skills/webstack/scripts/generate-vendor-table.sh --patch /path/to/project
   ```

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

3. **Detect project-specific observations** in existing KG entities. Project-specific observations are those that are NOT standard metadata (`version:`, `applies:`, `tags:`, `domain:`, `rule:`, `source:`) and NOT the content body. These are preserved during migration/updates — typically `Pitfall:`, `Backport:`, `GitHub:`, and `Docs:` observations.

4. **Complete drift report** (C3 entity match check):
   ```bash
   ~/.claude/skills/webstack/scripts/drift-check.sh /path/to/project \
     --entities <sync-output-from-step-2>
   ```
   Present unified findings from steps 1 and 4.

5. **Wait for user approval**

6. **Deploy file-based updates:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh apply /path/to/project
   ```
   This single command deploys all rules, hooks, configs, merges settings, prunes stale files, and records `.claude/webstack.sha`. Do NOT manually write any files that this command handles. Report any `PRUNE` actions to the user — these are files removed because they no longer exist in the skill.

   **Safe directories:** `.claude/rules/project/` is never touched — pruning is scoped to `core/` and `vendor/` only. Project-specific rules are always preserved.

7. **Update vendor reference entities** — for each vendor item from the sync comparison:

    Vendor doc content is deployed as rule files by `sync.sh apply` (step 6). KG entities are lightweight references only.

    For new vendors → `create_entities` with lightweight reference (same as init step 6).

    For existing vendors → `open_nodes(["VendorEntityName"])` to check current state, then:

    **If entity has full content body (migration from pre-rules format):**
    The entity was created under the old architecture where KG stored full vendor doc content. Migrate to lightweight reference:
    1. Identify project-specific observations to preserve: any observation starting with `Pitfall:`, `Backport:`, `GitHub:`, or `Docs:` (from step 3)
    2. `delete_entities(["VendorEntityName"])` — remove the full-content entity
    3. `create_entities` with lightweight reference (domain, rule, source — same as init step 6)
    4. `add_observations` to re-add the preserved project-specific observations from sub-step 1
    5. `create_relations` to restore any relations the old entity had

    **How to detect full-content entities:** if `open_nodes` returns more than 3-4 observations, or any observation does NOT start with a known prefix (`domain:`, `rule:`, `source:`, `Pitfall:`, `Backport:`, `GitHub:`, `Docs:`), the entity has full content and needs migration.

    **If entity is already a lightweight reference:**
    `sync.sh apply` handles the rule file. Update KG reference only if domain/rule/source changed:
    1. `delete_observations` for the stale values
    2. `add_observations` with updated values

8. **Update Vendor Knowledge table:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project --group vendor | \
     ~/.claude/skills/webstack/scripts/generate-vendor-table.sh --patch /path/to/project
   ```

9. **KG health check:**

    **a) Reference integrity** — `open_nodes` each vendor entity, verify `rule:` observation points to an existing file in `.claude/rules/vendor/`. Flag missing rule files.

    **b) Entity relations** — compute expected relations:
    ```bash
    ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project --group vendor | \
      ~/.claude/skills/webstack/scripts/check-relations.sh
    ```
    Compare output against actual relations from `open_nodes`. Create missing ones via `create_relations`.

10. **Cleanup legacy artifacts:**
    - **Rules and hooks** are automatically pruned by `sync.sh apply` — files in `core/` and `vendor/` that have no matching source in the manifest are deleted (action: `PRUNE` in the output). `.claude/rules/project/` is never pruned. No manual cleanup needed.
    - **Stale KG reference entities** whose `source:` template no longer exists must be cleaned up manually — `search_nodes` for `vendor_doc` entities matching removed templates, propose `delete_entities` to user, wait for approval.

11. **Scan for backport candidates** — check the project for knowledge worth contributing back to the skill:

    The `core/process/backporting` rule instructs the agent to tag generalizable findings with `"Backport: <reason>"` observations. Scan for these first — they're pre-qualified by the agent that created them.

    **a) KG entities with `Backport:` tags:**
    `search_nodes("Backport:")` — these are explicitly marked for backport by the working agent. Each has a reason explaining why it's generalizable.

    **b) KG pitfalls linked to vendor docs:**
    Scan for standalone `bug_resolution` entities related to vendor docs via relations (not observations on vendor entities). These are project-discovered pitfalls that may be generalizable.
    ```
    search_nodes("bug_resolution") →
      open_nodes to check relations to vendor_doc entities →
      If related to a vendor entity AND root cause is in the library → BACKPORT CANDIDATE
    ```

    **c) Bug resolutions:**
    `search_nodes("bug_resolution")` — scan for entries whose root cause is in a library (not project-specific business logic). These may warrant a new pitfall on the vendor template or a new `issues/` template.

    **d) Project-created KG entities without skill counterparts:**
    `search_nodes("vendor_doc")` — find vendor entities that don't match any skill template (no `source:` observation pointing to the boilerplate). These may be candidates for new vendor templates.

    **e) Project rules not in the skill:**
    Check `.claude/rules/` for rule files outside `core/` (project-created rules). If any encode generalizable patterns, they may belong as new core templates.

    Present candidates in a table:
    ```
    ### Backport Candidates

    | Source | Type | Content | Action |
    |--------|------|---------|--------|
    | VendorReactRouter7Routing | pitfall | clientLoader SSR behavior | Add to vendor/react-router-7/routing.md |
    | HydrationMismatchOnDateFormat | bug_resolution | Date.now() server/client divergence | Add to vendor/react-router-7/routing.md Known Issues |
    | VendorStripeCheckout | vendor_doc (no source) | Project-created Stripe reference | Create vendor/stripe-checkout.md template |
    | .claude/rules/api-conventions.md | project rule | REST naming + error shape conventions | Consider new core template |
    ```

    If the user approves backports:
    1. Read the skill source: `~/.claude/skills/webstack/vendor/{file}.md` or `core/{subdir}/{file}.md`
    2. Add the pitfall/content to the appropriate section
    3. Bump the template's version (patch for pitfall additions)
    4. Inform the user that subsequent `/webstack update` runs on other projects will pick up the change

    This step is informational — skip silently if no candidates are found.

### Periodic health check (`/webstack maintenance`)

Audits KG entities, rules, relations, and project hygiene without deploying templates. Run periodically (e.g., every few weeks, or when KG feels stale).

0. **Run preflight check** — see "Requirements" section above. Stop if KG MCP is unavailable. If `.claude/webstack.sha` doesn't exist, warn that `/webstack init` may not have run yet — continue anyway (some checks still work).

1. **Snapshot project state** — gather all data needed by subsequent steps in one pass. Run these in parallel:

   **a)** Run `scripts/sync.sh compare /path/to/project` → full deployment diff (rules, hooks, configs, vendor)

   **b)** Read `package.json` (root + 1 level deep for monorepos) → installed versions

   **c)** List `.claude/rules/` recursively → deployed rule inventory

   **d)** `search_nodes("vendor_doc")` → all vendor entities in KG

   **e)** `search_nodes("bug_resolution")` + `search_nodes("architecture_decision")` + `search_nodes("convention")` → all project-created entities

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

   **c) Orphaned entities/files:** `vendor_doc` KG entities whose `rule:` observation points to a file that no longer exists, or vendor rule files with no matching source template in the boilerplate.

   Output table:
   ```
   | Rule File | Template Ver | Deployed Ver | Installed | Status |
   |-----------|-------------|-------------|-----------|--------|
   | daisyui-5.md | 1.3.0 | 1.3.0 | 5.8.0 | PASS |
   | react-router-7/routing.md | 2.0.0 | 1.5.0 | 7.11.0 | DRIFT |
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

4. **KG relation completeness** — check relations between KG entities:

   **a+b) Expected relations:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project --group vendor | \
     ~/.claude/skills/webstack/scripts/check-relations.sh
   ```
   Outputs JSON with `same_domain` pairs and `cross_domain` dependencies. Use `open_nodes` to check which relations already exist, then `create_relations` for missing ones.

   **c) Orphan project entities:** `bug_resolution`, `architecture_decision`, `convention` entities with zero relations. Inspect observation text for library or domain keywords (e.g., "react-router", "daisyui", "payload") to propose links to the relevant vendor entity. Also check for `"Backport: ..."` observations — these were pre-tagged by the working agent as generalizable and should be related to the relevant vendor entity.

5. **KG entity quality check** — inspect entities for structural issues:

   - **Missing standard observations** on `vendor_doc` entities — each should have: `domain:`, `rule:`, `source:`
   - **Duplicate entities** — entities with very similar names that may overlap (e.g., `ReactRouterLoading` vs `VendorReactRouter7DataLoading`)
   - **Empty/minimal entities** — entities with fewer than 2 observations (likely placeholders)
   - **Type mismatches** — e.g., a `vendor_doc` without a `source:` observation (likely project-created, should be `convention` or `dependency`)

   Report-only.

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
   Report-only — user decides to keep, move to KG, or delete.

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

10. **KG contradiction detection** — find conflicting information across KG entities:

   **a) Cross-entity contradictions:** For vendor entities in the same domain or related domains, compare key guidance. Look for:
   - Contradicting version requirements (e.g., one entity says "requires React 18", another says "React 19 only")
   - Conflicting patterns (e.g., data loading via `loader` in one entity, via `clientLoader` in another, without explaining when to use which)
   - Pitfall observations that contradict the main content body of the same or another entity

   **b) Context7 pitfall verification** (optional, user-gated): For entities with `Pitfall:` or `GitHub:` observations, verify against current library docs. Before running, ask the user: "Found N pitfalls on vendor entities. Verify against current docs via Context7? (y/n)"

   If approved:
   ```
   For each pitfall:
     resolve-library-id → get library ID for the entity's package
     query-docs → search for the pitfall's topic
     Compare: is the pitfall still valid in the current version?
   ```

   Output:
   ```
   ### Cross-Entity Contradictions
   | Entity A | Entity B | Topic | Conflict |
   |----------|----------|-------|----------|
   | VendorRR7Routing | VendorRR7DataLoading | clientLoader | Contradicting SSR behavior description |

   ### Stale Pitfalls (Context7 verified)
   | Entity | Pitfall | Current Status |
   |--------|---------|---------------|
   | VendorDaisyui5 | "btn-ghost needs explicit color in v5" | FIXED in 5.7.0 |
   | VendorRR7Routing | "clientLoader skips on SSR" | STILL VALID |
   ```
   Report-only. Stale pitfalls proposed for removal in step 11.

11. **CLAUDE.md drift check:**
    ```bash
    ~/.claude/skills/webstack/scripts/drift-check.sh /path/to/project \
      --entities <sync-output-from-step-1a.json>
    ```
    Same checks as update step 1 but standalone. Offer to auto-fix MISSING sections with `bootstrap-claude-md.sh`.

12. **Remediation proposals** — aggregate all findings into a unified health report:

    **Auto-fixable** (after blanket user approval):
    - Missing `same_domain` relations between vendor entities in the same domain (step 4a)
    - Missing known cross-domain relations (step 4b)
    - Non-wildcarded MCP permissions → rewrite as server-prefix wildcards (step 8a)
    - Stale hook entries → remove from settings (step 8c)
    - Missing CLAUDE.md sections from bootstrap template (step 11, MISSING items)

    **User-decision required:**
    - Remove orphaned vendor entities from KG (step 2c)
    - Remove orphaned rule files from `.claude/rules/core/` (step 3)
    - Resolve rule contradictions — decide which instruction takes precedence (step 6)
    - Handle stray files — keep, move to KG, or delete (step 7)
    - Stale MCP server references → propose removal (step 8b)
    - Missing hook entries → propose addition (step 8c)
    - Relate orphan project entities to vendor entities (step 4c)
    - Remove stale pitfalls verified by Context7 (step 10b)

    **Informational** (no action, awareness only):
    - Version drift between templates and deployed rules → recommend `/webstack update` (step 2a)
    - Installed version mismatches (step 2b)
    - Context budget breakdown (step 9)
    - Cross-entity contradictions in KG (step 10a)
    - Content tampering in rules (step 3)
    - KG entity quality issues (step 5)
    - Stale deny entries (step 8d)

    Ask: "Apply auto-fixes? (relations, CLAUDE.md sections, MCP wildcards, stale hooks)"

13. **Execute fixes and final report:**

    Execute approved auto-fixes:
    - `create_relations` for missing intra-domain and cross-domain relations
    - `add_observations` for missing standard observations (if approved)
    - Rewrite `permissions.allow` entries to use server-prefix wildcards, remove redundant individual entries
    - Remove stale hook entries from `.claude/settings.json`
    - Append missing sections to CLAUDE.md from bootstrap template

    Execute user-approved individual fixes:
    - `delete_entities` for approved orphan removals
    - `delete_observations` for approved stale pitfall removals
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
    | KG relations | 8 | 6 | 2 proposed | 0 |
    | Entity quality | 1 | 0 | 0 | 1 |
    | Rule contradictions | 2 | 0 | 2 | 0 |
    | Stray files | 1 | 0 | 1 | 0 |
    | Settings & MCP | 4 | 2 wildcarded | 1 stale server | 1 deny entry |
    | Context budget | 0 | 0 | 0 | budget OK |
    | KG contradictions | 1 | 0 | 0 | 1 |
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

### Vendor entity naming convention

KG lightweight reference entities use `Vendor` prefix with PascalCase template name. These are reference-only entities (domain, rule path, source) — full vendor content is in `.claude/rules/vendor/` rule files:

| Source template | KG entity name | Domain |
|----------------|---------------|--------|
| `vendor/daisyui-5.md` | `VendorDaisyui5` | styling |
| `vendor/tailwind-4.md` | `VendorTailwind4` | styling |
| `vendor/react-router-7/routing.md` | `VendorReactRouter7Routing` | routing |
| `vendor/react-router-7/data-loading.md` | `VendorReactRouter7DataLoading` | routing |
| `vendor/react-router-7/_index.md` | `VendorReactRouter7Index` | routing |
| `vendor/react-router-7-integration.md` | `VendorReactRouter7Integration` | routing |
| `vendor/react-router-7-i18n/setup.md` | `VendorReactRouter7I18nSetup` | i18n |
| `vendor/react-router-7-i18n/usage.md` | `VendorReactRouter7I18nUsage` | i18n |
| `vendor/react-router-7-i18n/operations.md` | `VendorReactRouter7I18nOperations` | i18n |
| `vendor/payload/cms-3.md` | `VendorPayloadCms3` | backend |
| `vendor/payload/rest-client.md` | `VendorPayloadRestClient` | backend |
| `vendor/payload/live-preview.md` | `VendorPayloadLivePreview` | full-stack |
| `vendor/ory-hydra.md` | `VendorOryHydra` | auth |
| `vendor/remark-frontmatter-schema.md` | `VendorRemarkFrontmatterSchema` | tooling |
| `vendor/dokploy-monorepo-cicd.md` | `VendorDokployMonorepoCicd` | cicd |
| `vendor/base-ui-react.md` | `VendorBaseUiReact` | styling |
| `vendor/conform-zod.md` | `VendorConformZod` | forms |
| `vendor/project-scaffolding.md` | `VendorProjectScaffolding` | tooling |
| `vendor/react-hooks.md` | `VendorReactHooks` | frontend |
| `vendor/state-management-libs.md` | `VendorStateManagementLibs` | frontend |
| `vendor/playwright.md` | `VendorPlaywright` | testing |

For subdirectory files, the directory name + filename are joined in PascalCase.

> **Note:** Entity names and domains are computed automatically by `sync.sh` (from filename conversion and `domain:` frontmatter). This table is for reference only.

### Domain mapping

Group vendor reference entities by domain for KG reference discovery. Actual vendor content auto-loads via path-scoped rules in `.claude/rules/vendor/`:

| Domain | Entities | Search query |
|--------|----------|-------------|
| routing | `VendorReactRouter7*` | `search_nodes("domain: routing")` |
| styling | `VendorDaisyui5`, `VendorTailwind4`, `VendorBaseUiReact` | `search_nodes("domain: styling")` |
| backend | `VendorPayloadCms3`, `VendorPayloadRestClient` | `search_nodes("domain: backend")` |
| full-stack | `VendorPayloadLivePreview` | `search_nodes("domain: full-stack")` |
| auth | `VendorOryHydra` | `search_nodes("domain: auth")` |
| i18n | `VendorReactRouter7I18nSetup`, `VendorReactRouter7I18nUsage`, `VendorReactRouter7I18nOperations` | `search_nodes("domain: i18n")` |
| cicd | `VendorDokployMonorepoCicd` | `search_nodes("domain: cicd")` |
| forms | `VendorConformZod` | `search_nodes("domain: forms")` |
| tooling | `VendorRemarkFrontmatterSchema`, `VendorProjectScaffolding` | `search_nodes("domain: tooling")` |
| frontend | `VendorReactHooks`, `VendorStateManagementLibs` | `search_nodes("domain: frontend")` |
| testing | `VendorPlaywright` | `search_nodes("domain: testing")` |

> **Note:** Domain grouping is generated by `generate-vendor-table.sh` from `domain:` frontmatter in each vendor template. This table is for reference only.

## Automatic Updates During Work

These happen outside of this skill — they are standing instructions for how conventions evolve during normal development. The write triggers and observation formats are defined in `core/process/mcp-tools` (deployed to `.claude/rules/core/mcp-tools.md`). The CLAUDE.md bootstrap template includes the observation format strings for easy reference.

Session progress → Claude Code auto memory (`MEMORY.md`), not the Knowledge Graph.

## Contributing Back to the Boilerplate

**Pitfalls and postmortems that are generalizable (not project-specific) should be contributed back to this skill** so all projects benefit.

When you discover something that would help other projects:
1. **Vendor issues:** Add to `vendor/{library}.md` in the boilerplate under "Known Issues"
2. **General patterns:** Update the relevant `core/{subdir}/*.md` template
3. **New library:** Create a new `vendor/{library}.md` template with `applies` and `target: rules`

Examples of what to contribute back:
- Library version gotchas (e.g., "DaisyUI 5 removed form-control")
- Framework quirks (e.g., "RR7 loaders run in parallel, not sequentially")
- Security patterns discovered during reviews
- Build/tooling issues that affect multiple projects

Examples of what stays project-specific:
- Business logic bugs
- Project-specific architecture decisions
- Environment/deployment issues unique to one setup

### Issue Entity Format (Knowledge Graph)

When creating `bug_resolution` entities in the Knowledge Graph:

```
Entity name: PascalCase description (e.g., HydrationMismatchOnDateFormat)
Entity type: bug_resolution
Observations:
  - "Symptom: [what went wrong]"
  - "Context: [what was being done]"
  - "Root cause: [why it happened]"
  - "Fix: [how it was resolved]"
  - "Date: [YYYY-MM-DD]"
  - "Area: [Frontend|Backend|CI/CD|Styling]"
```

## CLAUDE.md Bootstrap

**CRITICAL:** The skill MUST ensure CLAUDE.md contains the vendor knowledge section, otherwise vendor docs in the Knowledge Graph won't be loaded correctly. MCP tool usage rules are in `.claude/rules/core/mcp-tools.md` (auto-loaded).

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
