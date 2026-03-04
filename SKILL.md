---
name: webstack
description: Bootstrap web stack conventions into .claude/rules/ and Knowledge Graph vendor docs. Run on new projects or when conventions need updating.
disable-model-invocation: true
argument-hint: [init|update]
---

# Web Stack Conventions

This skill deploys conventions to two targets based on each template's `target` frontmatter field:

- **`target: rules`** (core templates) → `.claude/rules/core/` — auto-loaded by Claude Code every turn, survives context compression
- **`target: graph`** (vendor templates) → Knowledge Graph entities — queryable, relational, portable

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
- `core/process/mcp-tools` — MCP & plugin usage rules (typescript-lsp, KG, Context7), workflows
- `core/process/security-checklist` — Security review standards
- `core/process/code-review` — Code review standards
- `core/process/engineering-discipline` — Task assessment, verification, change classification, failure protocol
- `core/process/monorepo` — Directory discipline for multi-package projects

**Path-scoped** (loaded only when touching matching files):
- `core/frontend/react-components` — `**/*.tsx`, `**/*.ts` — Component patterns, useEffect
- `core/frontend/state-management` — `**/*.tsx`, `**/*.ts` — Context vs Zustand vs Redux
- `core/frontend/i18n` — `**/*.tsx`, `**/*.ts`, `**/locales/**` — Translation patterns
- `core/frontend/ssr-hydration` — `**/*.tsx`, `**/*.ts` — SSR and client-only code
- `core/process/scripting` — `scripts/**`, `**/*.sh` — Script requirements, shell compatibility
- `core/process/payload-api` — `scripts/payload-*`, `backend/**` — Payload REST API helpers
- `core/testing/e2e-testing` — `**/*.test.*`, `**/*.spec.*`, `**/e2e/**` — Playwright testing patterns
- `core/testing/unit-testing` — `**/*.test.ts`, `**/*.spec.ts` — Vitest unit testing patterns
- `core/claude-config/claude-md` — `CLAUDE.md`, `.claude/**` — CLAUDE.md conventions
- `core/claude-config/claude-settings` — `.claude/**`, `CLAUDE.md` — Permission patterns
- `core/claude-config/mcp-servers` — `.claude/**` — MCP server setup
- `core/claude-config/writing-rules` — `CLAUDE.md`, `.claude/**`, `SKILL.md`, `**/rules/**` — How to write effective agent rules

**Context budget:** Always-loaded rules total ~850 lines (~20KB). This is the per-turn baseline cost. If adding new always-loaded rules, check whether path-scoping is possible first.

| Rule | Lines | Notes |
|------|-------|-------|
| tooling | ~195 | Commands, verification, git, tool discipline, agent behavior |
| mcp-tools | ~170 | Tool usage rules, typescript-lsp triggers, KG read/write triggers |
| engineering-discipline | ~150 | Task assessment, verification, change classification |
| code-review | ~110 | Review standards |
| security-checklist | ~60 | Security review checklist |
| monorepo | ~30 | Directory discipline |

Vendor docs are stored in the Knowledge Graph — use `search_nodes` + `open_nodes` when working in a specific domain.

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

| Server | Verify with | Purpose | Install (project-scoped) |
|--------|------------|---------|--------------------------|
| Knowledge Graph | `search_nodes("preflight")` | Vendor doc storage, bug resolutions, decisions | `claude mcp add memory --scope project -- npx -y @modelcontextprotocol/server-memory` |
| Context7 | `resolve-library-id` with query `"react"` | Version-specific library documentation | `claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp` |

### Plugins

Verify by checking if the tool is available in the current session. If missing, show the install command and stop.

| Plugin | Verify with | Purpose | Install (project-scoped) |
|--------|------------|---------|--------------------------|
| typescript-lsp | `doctor` tool available | TypeScript code intelligence (go-to-definition, find references, diagnostics) | `claude plugin install typescript-lsp --scope project` |
| context-mode | Any `mcp__plugin_context-mode_*` tool available | Large output handling, context budget management | `claude plugin install context-mode@claude-context-mode --scope project` |

### Preflight Sequence

Run this at the start of every `/webstack init` or `/webstack update`:

1. Run `scripts/preflight.sh` — if exit code is non-zero, report missing CLI tools with install commands and stop
2. Call `search_nodes("preflight")` — if the tool is not available, report "Knowledge Graph MCP server not configured" with install command and stop
3. Call `resolve-library-id` with query `"react"` — if the tool is not available, report "Context7 MCP server not configured" with install command and stop
4. Check if `doctor` tool is available — if not, report "typescript-lsp plugin not installed" with install command and stop
5. Check if `mcp__plugin_context-mode_context-mode__execute` is available — if not, report "context-mode plugin not installed" with install command and stop

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
| `/webstack init` | New project — deploys rules, seeds KG vendor docs, and CLAUDE.md bootstrap |
| `/webstack update` | Existing project — diffs templates, preserves project-specific observations |

**For existing projects:**
- The skill compares each template against the deployed version (rule file or KG entity)
- Project-specific additions (Known Issues observations, custom notes) are preserved in KG entities
- You'll be shown what's new vs what already exists before any changes

## Directory Structure

```
claude-boilerplate/
├── SKILL.md                    # This file — orchestration only
├── core/                       # → deployed to .claude/rules/core/ (subdir stripped)
│   ├── process/                # Always-loaded (except path-scoped ones)
│   │   ├── tooling.md
│   │   ├── mcp-tools.md
│   │   ├── security-checklist.md
│   │   ├── code-review.md
│   │   ├── engineering-discipline.md
│   │   ├── monorepo.md
│   │   ├── scripting.md          # Path-scoped: scripts/**, **/*.sh
│   │   └── payload-api.md        # Path-scoped: scripts/payload-*, backend/**
│   ├── frontend/               # Path-scoped to *.tsx, *.ts
│   │   ├── react-components.md
│   │   ├── state-management.md
│   │   ├── i18n.md
│   │   └── ssr-hydration.md
│   ├── testing/                # Path-scoped to test files
│   │   ├── e2e-testing.md
│   │   └── unit-testing.md
│   ├── claude-config/          # Path-scoped to .claude/**, CLAUDE.md
│   │   ├── claude-md.md
│   │   ├── claude-settings.md
│   │   ├── mcp-servers.md
│   │   └── writing-rules.md
│   └── playwright-mcp.config.json  # Copy to .claude/ in project
├── vendor/                     # → deployed as Knowledge Graph entities
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
│   ├── react-router-7-i18n.md
│   ├── payload-cms-3.md
│   ├── payload-rest-client.md
│   ├── ory-hydra.md
│   ├── remark-frontmatter-schema.md
│   ├── dokploy-monorepo-cicd.md
│   ├── conform-zod.md             # → entity: VendorConformZod
│   └── project-scaffolding.md    # → entity: VendorProjectScaffolding
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
| **Vendor** | Knowledge Graph (`vendor_doc`) | Queried via `search_nodes` | Library/framework reference, version-pinned | Seeded by skill, appended with gotchas during work |
| **Issues** | Knowledge Graph (`bug_resolution`) | Queried via `search_nodes` | Bugs, decisions, relationships | Created during development, queryable |
| **Decisions** | Knowledge Graph (`architecture_decision`) | Queried via `search_nodes` | Why X was chosen over Y | Created during development |

### Why this split?

- **Rules** survive context compression — they're re-injected every turn at full fidelity. Core conventions need this because they must be followed consistently, even in long sessions.
- **Knowledge Graph** handles everything else: vendor docs (large, domain-specific, loaded on demand via `search_nodes`), bug resolutions, architecture decisions. Entities are queryable by type, content, and tags. The graph is portable (single `.memory/graph.jsonl` file) and supports relational linking between entities.

### If Knowledge Graph MCP is unavailable

If `search_nodes` fails or the KG MCP server is not configured, fall back to reading vendor templates directly from the skill source directory (`~/.claude/skills/webstack/vendor/`). This provides the same content without relational querying or persistent observations.

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

**Check the argument:** `$ARGUMENTS` will be `init` or `update`. If not provided, ask the user which mode to use.

### On a new project (`/webstack init`)

0. **Run preflight check** — see "Requirements" section above. Stop if any dependency is missing.

1. **Bootstrap CLAUDE.md:**
   - Check if `CLAUDE.md` exists in project root
   - If missing: create it using the bootstrap template (see "CLAUDE.md Bootstrap" section)
   - If exists but missing required sections: append them
   - Show user what was created/added
   - Note: subsequent `/webstack update` runs will check for drift in managed CLAUDE.md sections

2. **Detect stack:**
   - Read `package.json` (dependencies + devDependencies)
   - Check file structure (`app/features/`, etc.)
   - Note frameworks and exact versions

3. **Evaluate template applicability:**
   ```bash
   ~/.claude/skills/webstack/scripts/evaluate-applies.sh /path/to/project
   ```
   Parse the JSON output to build the action table. Each entry has `template`, `target`, `applies`, `matches` (boolean), and `reason`. If the script is unavailable or fails, fall back to manual evaluation (see `references/versioning.md` for applies condition spec).

4. **Propose a plan to the user:**
   ```
   | Template | Target | Action | Reason |
   |----------|--------|--------|--------|
   | core/process/tooling | rules | CREATE | Always applies |
   | vendor/daisyui-5 | graph | CREATE | daisyui@5.5.14 detected |
   | vendor/payload-cms-3 | graph | SKIP | payload not in dependencies |
   | core/testing/e2e-testing | rules | SKIP | playwright not installed |
   ```

5. **Wait for user approval**

6. **Deploy templates based on `target` field:**

   For `target: rules`:
   ```
   Read: ~/.claude/skills/webstack/core/process/tooling.md
   Write: .claude/rules/core/tooling.md  (subdir stripped from target)
   ```

   For `target: graph` (vendor docs → Knowledge Graph entities):
   ```
   Read: ~/.claude/skills/webstack/vendor/daisyui-5.md
   Parse frontmatter: version, applies, tags
   Determine entity name: VendorDaisyui5 (see naming convention below)
   Determine domain: styling (see domain mapping below)

   create_entities([{
     name: "VendorDaisyui5",
     entityType: "vendor_doc",
     observations: [
       "version: 1.1.0",
       "applies: daisyui@5",
       "tags: daisyui, ui, components, tailwind, styling, themes",
       "domain: styling",
       "source: vendor/daisyui-5.md",
       <full markdown content body, without frontmatter>
     ]
   }])
   ```

   **CRITICAL:** Copy the markdown content body verbatim (everything after the closing `---` of frontmatter). Do NOT retype, summarize, or reinterpret. The templates are pre-written and verified.

   **CRITICAL:** Ensure `.memory/` directory exists before creating entities. Run `mkdir -p .memory` if needed.

7. **Deploy config files and hooks** to project:
   ```
   Copy: ~/.claude/skills/webstack/core/playwright-mcp.config.json → .claude/playwright-mcp.config.json
   Copy: ~/.claude/skills/webstack/.claude/hooks/ → .claude/hooks/ (all .sh files, chmod +x)
   Merge: ~/.claude/skills/webstack/.claude/settings.json → .claude/settings.json (merge hooks key)
   ```
   If `.claude/settings.json` already exists, merge the `hooks` key — don't overwrite other settings.

   **Hooks inventory:**

   | Hook | File | Event / Matcher | Purpose |
   |------|------|----------------|---------|
   | Auto-check | `auto-check.sh` | PostToolUse / `Edit\|Write` | Runs `yarn check` after code edits, finds nearest workspace |
   | KG precheck | `kg-precheck.sh` | PreToolUse / `EnterPlanMode\|Task` | Injects KG lookup reminder when planning or spawning subagents |
   | Env rejection | `reject-env-prefix.sh` | PreToolUse / `Bash` | Blocks `$VAR` expansion, `export VAR=`, inline env overrides |
   | Stop gate | `stop-gate.sh` | Stop | Verifies `yarn check` passes in all affected workspaces before stopping |
   | Post-task review | `post-plan-review.sh` | TaskCompleted | Triggers code quality review on changed files |

   Each hook has a `# version:` comment on line 2. On update, compare hook versions with the same logic as rules: UPDATE if version increased, SKIP if equal, REVIEW if content changed but version matches.

8. **Generate the Vendor Knowledge table** in CLAUDE.md:
   - Group deployed vendor entities by domain (routing, styling, backend, auth, i18n, cicd)
   - Replace the placeholder table in the `## Vendor Knowledge` section
   - Only include vendor entities that were actually deployed in step 6

9. **Record boilerplate SHA:**
    ```bash
    git -C ~/.claude/skills/webstack rev-parse HEAD > .claude/webstack.sha
    ```

10. **Scaffold project infrastructure** (optional):
    - Ask user: "Deploy scaffold files (dev scripts, Docker, sync tools, CI/CD)?"
    - List available scaffold files from `~/.claude/skills/webstack/scaffold/`
    - If yes, copy selected files to project root
    - **Skip files that already exist** — warn user instead of overwriting
    - Ask user for their project name, then replace `myproject` placeholders in `dev.sh` (session name) and any other scaffold files
    - Remind user to copy `.env.example` to `.env` and fill in credentials
    - **Stripe CLI** is optional — `dev.sh` includes a commented-out tmux pane for `stripe listen`. Only uncomment if the project uses Stripe webhooks.

### On an existing project (`/webstack update`)

0. **Run preflight check** — see "Requirements" section above. Stop if any dependency is missing.

1. **Assess CLAUDE.md drift** (see "CLAUDE.md Drift Checks"):
   - Read `CLAUDE.md` in project root
   - If missing: warn and suggest `/webstack init`, skip to step 2
   - Check if bootstrapped: search for `## Vendor Knowledge` or known aliases (`## Knowledge Graph`, `## KG Entities`, `## Vendor Docs`)
     - If not bootstrapped: show "not bootstrapped" message, skip detailed checks, continue to step 2
     - If bootstrapped: run drift checks S1, S2, C1, C2, C4, C5
   - Collect findings (C3 is deferred to after step 8)
   - For MISSING sections: offer to append from the bootstrap template
   - For WARN legacy sections (`## Vendor Memory Loading`, `## MCP Tools:`): offer to rename/remove
   - Show drift findings to user, then continue — drift report is informational, not blocking

2. **Detect stack and evaluate applicability** — same as init step 2-3: run `scripts/evaluate-applies.sh` against the project. The JSON output feeds into the action table in step 5.

3. **Check boilerplate changes since last deployment:**
   - Read `.claude/webstack.sha` if it exists
   - Run `git -C ~/.claude/skills/webstack log --oneline <stored-sha>..HEAD -- core/ vendor/` to list changed templates
   - This list supplements the version comparison in step 6 — templates with content changes but matching versions are flagged as `REVIEW`
   - If `.claude/webstack.sha` doesn't exist, skip this step (rely on version comparison only)

4. **Compare versions — don't read full files yet.**

   The version number is all that matters for the comparison. Reading every template into context wastes tokens. Use targeted extraction instead:

   For `target: rules`:
   ```bash
   # Extract just the version from template frontmatter (3 lines, not 200)
   head -5 ~/.claude/skills/webstack/core/{subdir}/{name}.md | grep '^version:'
   # Extract version from deployed file
   head -5 .claude/rules/core/{name}.md | grep '^version:'
   ```

   For `target: graph`:
   ```bash
   # Template version
   head -5 ~/.claude/skills/webstack/vendor/{name}.md | grep '^version:'
   ```
   ```
   # Deployed version — single KG query, not full entity read
   open_nodes(["Vendor{PascalCaseName}"]) → find "version:" observation
   ```

   Only read the full template content in step 11 when actually deploying an UPDATE or CREATE.

5. **Build the action table** by cross-referencing versions with the SHA diff (step 3):

   | Template version | Deployed version | In SHA diff? | Action |
   |------------------|------------------|-------------|--------|
   | 1.1.0 | 1.0.0 | — | **UPDATE** — show "1.0.0 → 1.1.0" |
   | 1.0.0 | 1.0.0 | No | **SKIP** — versions match, no changes |
   | 1.0.0 | 1.0.0 | Yes | **REVIEW** — content changed but version not bumped |
   | 1.0.0 | (entity missing) | — | **CREATE** — new |
   | (any) | (no version observation) | — | **REPLACE** — legacy entity |

6. **Detect project-specific observations** in existing KG entities:
   - Observations that are NOT part of the standard set (version, applies, tags, domain, source, content)
   - These are project-specific additions (gotchas, known issues) — preserve them

7. **Propose changes to the user** in a table:
   ```
   | Template | Target | Action | Version | Notes |
   |----------|--------|--------|---------|-------|
   | core/process/tooling | rules | UPDATE | 1.3.0 → 1.4.0 | |
   | vendor/daisyui-5 | graph | UPDATE | 1.0.0 → 1.1.0 | 2 extra observations preserved |
   | vendor/tailwind-4 | graph | SKIP | 1.1.0 = 1.1.0 | |
   | core/process/monorepo | rules | REVIEW | 1.1.0 = 1.1.0 | content changed (SHA diff), version not bumped |
   | core/testing/e2e-testing | rules | SKIP | — | playwright not installed |
   ```

8. **Complete drift report** (C3 check):
   - Compare entity names in the CLAUDE.md domain table against the entities proposed for CREATE/UPDATE/SKIP in step 7
   - Flag entities listed in the table that no longer exist (deleted templates) or were skipped (no longer applies)
   - Flag deployed entities missing from the table
   - Present the unified drift report (findings from step 1 + C3)

9. **Wait for user approval**

10. **Deploy updates based on `target` field:**

    Read full template content **now** — only for templates marked UPDATE or CREATE.

    For `target: rules` — same mechanics as init step 6.

    For `target: graph` — update KG entities in place:
   ```
   1. open_nodes(["VendorDaisyui5"]) — get current observations
   2. Identify standard observations: version:, applies:, tags:, domain:, source:, and content body
   3. delete_observations — remove only the standard observations
   4. add_observations — add new standard observations from template
   ```

   Project-specific observations (gotchas, known issues added during work) are **automatically preserved** — only standard observations are replaced. Entity relations are also preserved.

   **CRITICAL:** Copy template content verbatim. Do NOT retype, summarize, or reinterpret.

11. **KG health check** — verify deployed entities are sound:

    **a) Version match** — each vendor entity's `applies:` condition must match the project's actual installed version:
    ```
    open_nodes(["VendorDaisyui5"]) → applies: daisyui@5
    package.json → daisyui@5.8.0 → PASS (major matches)

    open_nodes(["VendorDaisyui5"]) → applies: daisyui@5
    package.json → daisyui@6.1.0 → MISMATCH — entity is for v5, project has v6
    ```
    Flag mismatches in the report. If a template for the correct version exists, offer to replace. If not, warn that the entity may contain outdated patterns.

    **b) Entity relations** — vendor entities in the same domain or with cross-domain dependencies should be linked via `create_relations`:

    | Relation type | Example | When |
    |---------------|---------|------|
    | `same_domain` | `VendorReactRouter7Routing` ↔ `VendorReactRouter7DataLoading` | Entities share a domain |
    | `depends_on` | `VendorDaisyui5` → `VendorTailwind4` | Library requires another |
    | `integrates_with` | `VendorReactRouter7I18n` → `VendorReactRouter7Routing` | Cross-domain integration |

    For each deployed entity, check if expected relations exist (`open_nodes` returns relations). Create missing ones. Don't duplicate existing relations.

    Report findings:
    ```
    | Entity | Version | Relations | Issue |
    |--------|---------|-----------|-------|
    | VendorDaisyui5 | PASS (5.8.0) | 2 linked | — |
    | VendorReactRouter7Routing | PASS (7.9.2) | 0 linked | MISSING: same_domain links to other RR7 entities |
    | VendorPayloadCms3 | MISMATCH (v4 installed) | 1 linked | Entity is for v3, project has v4 |
    ```

12. **Update config files and hooks** if changed:
    - Compare `~/.claude/skills/webstack/core/playwright-mcp.config.json` with `.claude/playwright-mcp.config.json`
    - If skill version is newer, update project config
    - Compare hook versions:
      ```bash
      head -2 ~/.claude/skills/webstack/.claude/hooks/{name}.sh | grep '# version:'
      head -2 .claude/hooks/{name}.sh | grep '# version:'
      ```
    - Same logic as rules: **UPDATE** if version increased, **SKIP** if equal, **REVIEW** if content changed but version matches
    - New hooks (in skill but not project): **CREATE** (`chmod +x`)
    - Merge `~/.claude/skills/webstack/.claude/settings.json` hooks key into `.claude/settings.json` — add missing hook entries, don't remove project-specific hooks or overwrite other settings

13. **Cleanup legacy artifacts:**
    - Check for stale KG entities: `vendor_doc` entities whose `source:` template no longer exists in the boilerplate
    - Check for orphaned rule files: `.claude/rules/core/*.md` files that don't match any current template
    - Propose cleanup table to user, wait for approval, then execute

14. **Scan for backport candidates** — check the project for knowledge worth contributing back to the skill:

    **a) KG pitfalls on vendor entities:**
    For each deployed `vendor_doc` entity, check for project-specific observations (pitfalls, GitHub issues, doc findings added during work). These are the observations preserved in step 6/10 — if they're generalizable, they belong in the boilerplate template.
    ```
    open_nodes(["VendorReactRouter7Routing"]) →
      "Pitfall: clientLoader doesn't run on initial SSR — only on client navigations"
      "GitHub: https://github.com/remix-run/react-router/issues/11234 — confirmed"
    → BACKPORT CANDIDATE — applies to all RR7 projects
    ```

    **b) Bug resolutions:**
    `search_nodes("bug_resolution")` — scan for entries whose root cause is in a library (not project-specific business logic). These may warrant a new pitfall on the vendor template or a new `issues/` template.

    **c) Project-created KG entities without skill counterparts:**
    `search_nodes("vendor_doc")` — find vendor entities that don't match any skill template (no `source:` observation pointing to the boilerplate). These may be candidates for new vendor templates.

    **d) Project rules not in the skill:**
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

15. **Record boilerplate SHA:**
    ```bash
    git -C ~/.claude/skills/webstack rev-parse HEAD > .claude/webstack.sha
    ```

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

KG entities use `Vendor` prefix with PascalCase template name:

| Source template | KG entity name | Domain |
|----------------|---------------|--------|
| `vendor/daisyui-5.md` | `VendorDaisyui5` | styling |
| `vendor/tailwind-4.md` | `VendorTailwind4` | styling |
| `vendor/react-router-7/routing.md` | `VendorReactRouter7Routing` | routing |
| `vendor/react-router-7/data-loading.md` | `VendorReactRouter7DataLoading` | routing |
| `vendor/react-router-7/_index.md` | `VendorReactRouter7Index` | routing |
| `vendor/react-router-7-integration.md` | `VendorReactRouter7Integration` | routing |
| `vendor/react-router-7-i18n.md` | `VendorReactRouter7I18n` | i18n |
| `vendor/payload-cms-3.md` | `VendorPayloadCms3` | backend |
| `vendor/payload-rest-client.md` | `VendorPayloadRestClient` | backend |
| `vendor/ory-hydra.md` | `VendorOryHydra` | auth |
| `vendor/remark-frontmatter-schema.md` | `VendorRemarkFrontmatterSchema` | tooling |
| `vendor/dokploy-monorepo-cicd.md` | `VendorDokployMonorepoCicd` | cicd |
| `vendor/base-ui-react.md` | `VendorBaseUiReact` | styling |
| `vendor/conform-zod.md` | `VendorConformZod` | forms |
| `vendor/project-scaffolding.md` | `VendorProjectScaffolding` | tooling |

For subdirectory files, the directory name + filename are joined in PascalCase.

### Domain mapping

Group vendor entities by domain for the CLAUDE.md loading table:

| Domain | Entities | Search query |
|--------|----------|-------------|
| routing | `VendorReactRouter7*` | `search_nodes("domain: routing")` |
| styling | `VendorDaisyui5`, `VendorTailwind4`, `VendorBaseUiReact` | `search_nodes("domain: styling")` |
| backend | `VendorPayloadCms3`, `VendorPayloadRestClient` | `search_nodes("domain: backend")` |
| auth | `VendorOryHydra` | `search_nodes("domain: auth")` |
| i18n | `VendorReactRouter7I18n` | `search_nodes("domain: i18n")` |
| cicd | `VendorDokployMonorepoCicd` | `search_nodes("domain: cicd")` |
| forms | `VendorConformZod` | `search_nodes("domain: forms")` |
| tooling | `VendorRemarkFrontmatterSchema`, `VendorProjectScaffolding` | `search_nodes("domain: tooling")` |

## Automatic Updates During Work

These happen outside of this skill — they are standing instructions for how conventions evolve during normal development. The write triggers and observation formats are defined in `core/process/mcp-tools` (deployed to `.claude/rules/core/mcp-tools.md`). The CLAUDE.md bootstrap template includes the observation format strings for easy reference.

Session progress → Claude Code auto memory (`MEMORY.md`), not the Knowledge Graph.

## Contributing Back to the Boilerplate

**Pitfalls and postmortems that are generalizable (not project-specific) should be contributed back to this skill** so all projects benefit.

When you discover something that would help other projects:
1. **Vendor issues:** Add to `vendor/{library}.md` in the boilerplate under "Known Issues"
2. **General patterns:** Update the relevant `core/{subdir}/*.md` template
3. **New library:** Create a new `vendor/{library}.md` template with `applies` and `target: graph`

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
