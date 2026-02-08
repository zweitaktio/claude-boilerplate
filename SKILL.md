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

**Always loaded** (~20KB):
- `core/tooling` — Commands, verification, git, agent behavior
- `core/mcp-tools` — MCP tool usage rules, workflows, and division of labor
- `core/security-checklist` — Security review standards
- `core/code-review` — Code review standards
- `core/engineering-discipline` — Task assessment, verification, change classification, failure protocol
- `core/monorepo` — Directory discipline for multi-package projects

**Path-scoped** (loaded only when touching matching files):
- `core/react-components` — `**/*.tsx`, `**/*.ts` — Component patterns, useEffect
- `core/state-management` — `**/*.tsx`, `**/*.ts` — Context vs Zustand vs Redux
- `core/i18n` — `**/*.tsx`, `**/*.ts`, `**/locales/**` — Translation patterns
- `core/ssr-hydration` — `**/*.tsx`, `**/*.ts` — SSR and client-only code
- `core/e2e-testing` — `**/*.test.*`, `**/*.spec.*`, `**/e2e/**` — Playwright testing patterns
- `core/claude-md` — `CLAUDE.md`, `.claude/**` — CLAUDE.md conventions
- `core/claude-settings` — `.claude/**`, `CLAUDE.md` — Permission patterns
- `core/mcp-servers` — `.claude/**`, `.serena/**` — MCP server setup
- `core/writing-rules` — `CLAUDE.md`, `.claude/**`, `SKILL.md`, `**/rules/**` — How to write effective agent rules

Vendor docs are stored in the Knowledge Graph — use `search_nodes` + `open_nodes` when working in a specific domain.

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
├── core/                       # → deployed to .claude/rules/core/
│   ├── tooling.md
│   ├── claude-md.md
│   ├── claude-settings.md
│   ├── mcp-servers.md
│   ├── mcp-tools.md
│   ├── playwright-mcp.config.json  # Copy to .claude/ in project
│   ├── react-components.md
│   ├── state-management.md
│   ├── i18n.md
│   ├── ssr-hydration.md
│   ├── security-checklist.md
│   ├── code-review.md
│   ├── e2e-testing.md
│   ├── engineering-discipline.md
│   ├── writing-rules.md
│   └── monorepo.md
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
│   ├── forgejo-actions.md
│   └── dokploy-monorepo-cicd.md
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

## Invocation Instructions

**Check the argument:** `$ARGUMENTS` will be `init` or `update`. If not provided, ask the user which mode to use.

### On a new project (`/webstack init`)

1. **Bootstrap CLAUDE.md:**
   - Check if `CLAUDE.md` exists in project root
   - If missing: create it using the bootstrap template (see "CLAUDE.md Bootstrap" section)
   - If exists but missing required sections: append them
   - Show user what was created/added

2. **Detect stack:**
   - Read `package.json` (dependencies + devDependencies)
   - Check file structure (`app/features/`, `.forgejo/`, `.gitea/`, etc.)
   - Note frameworks and exact versions

3. **Evaluate each template's `applies` condition** from frontmatter:
   ```yaml
   ---
   version: 1.0.0
   applies: daisyui@5
   target: rules
   ---
   ```
   - Parse the `applies` field
   - Check against detected stack (see "Applies conditions" below)
   - Read the `target` field to determine deployment location

4. **Propose a plan to the user:**
   ```
   | Template | Target | Action | Reason |
   |----------|--------|--------|--------|
   | core/tooling | rules | CREATE | Always applies |
   | vendor/daisyui-5 | graph | CREATE | daisyui@5.5.14 detected |
   | vendor/payload-cms-3 | graph | SKIP | payload not in dependencies |
   | core/e2e-testing | rules | SKIP | playwright not installed |
   ```

5. **Wait for user approval**

6. **Deploy templates based on `target` field:**

   For `target: rules`:
   ```
   Read: ~/.claude/skills/webstack/core/tooling.md
   Write: .claude/rules/core/tooling.md
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

7. **Copy config files** to project:
   ```
   Read: ~/.claude/skills/webstack/core/playwright-mcp.config.json
   Write: .claude/playwright-mcp.config.json
   ```

8. **Generate the Vendor Knowledge table** in CLAUDE.md:
   - Group deployed vendor entities by domain (routing, styling, backend, auth, i18n, cicd)
   - Replace the placeholder table in the `## Vendor Knowledge` section
   - Only include vendor entities that were actually deployed in step 6

9. **Cleanup legacy artifacts** (for existing projects being re-initialized):
   - Check for `.serena/memories/core/`, `.serena/memories/vendor/`, `.serena/memories/_index.md`
   - Check if Serena `list_memories` returns any `vendor-*` or `core/*` entries
   - If any found, propose cleanup:
     ```
     Legacy artifacts detected. These are no longer needed:

     | Artifact | Action |
     |----------|--------|
     | .serena/memories/core/*.md | DELETE (now in .claude/rules/core/) |
     | .serena/memories/vendor/*.md | DELETE (now in Knowledge Graph) |
     | .serena/memories/_index.md | DELETE (no longer used) |
     | .serena/memories/issues/*.md | DELETE (now in Knowledge Graph) |
     | Serena memory: vendor-daisyui-5 | DELETE (now KG entity VendorDaisyui5) |
     ```
   - Wait for user approval before deleting anything
   - Delete approved items (files via `rm`, Serena memories via `delete_memory`)
   - **Never delete `.serena/` itself or `.serena/project.yml`** — Serena is still used for symbol tools

### On an existing project (`/webstack update`)

1. **Check CLAUDE.md required sections:**
   - Read `CLAUDE.md` if it exists
   - Check for `## Vendor Knowledge` heading — if missing, append it
   - If old `## Vendor Memory Loading` or `## Serena Memory Protocol` exists, offer to replace with `## Vendor Knowledge`
   - Show user what was added/changed

2. **Detect stack** — same as init: read `package.json`, check file structure

3. **For each applicable template**, read both sources:

   For `target: rules`:
   - Template: `~/.claude/skills/webstack/core/{name}.md`
   - Deployed: `.claude/rules/core/{name}.md` (may not exist)

   For `target: graph`:
   - Template: `~/.claude/skills/webstack/vendor/{name}.md`
   - Deployed: `open_nodes(["Vendor{PascalCaseName}"])` — check if entity exists, read `version:` observation

4. **Parse frontmatter** from template files:
   ```yaml
   ---
   version: 1.0.0
   applies: daisyui@5
   target: graph
   ---
   ```

   For KG entities, extract the `version:` observation from the entity's observations array.

5. **Compare versions** and categorize each template:

   | Template version | Deployed version | Action |
   |------------------|------------------|--------|
   | 1.1.0 | 1.0.0 | **UPDATE** — show "1.0.0 → 1.1.0" |
   | 1.0.0 | 1.0.0 | **SKIP** — versions match |
   | 1.0.0 | (entity missing) | **CREATE** — new |
   | (any) | (no version observation) | **REPLACE** — legacy entity |

6. **Detect project-specific observations** in existing KG entities:
   - Observations that are NOT part of the standard set (version, applies, tags, domain, source, content)
   - These are project-specific additions (gotchas, known issues) — preserve them

7. **Propose changes to the user** in a table:
   ```
   | Template | Target | Action | Version | Notes |
   |----------|--------|--------|---------|-------|
   | core/tooling | rules | UPDATE | 1.3.0 → 1.4.0 | |
   | vendor/daisyui-5 | graph | UPDATE | 1.0.0 → 1.1.0 | 2 extra observations preserved |
   | vendor/tailwind-4 | graph | SKIP | 1.1.0 = 1.1.0 | |
   | core/e2e-testing | rules | SKIP | — | playwright not installed |
   ```

8. **Wait for user approval**

9. **Deploy updates based on `target` field:**

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

10. **Update config files** if changed:
    - Compare `~/.claude/skills/webstack/core/playwright-mcp.config.json` with `.claude/playwright-mcp.config.json`
    - If skill version is newer, update project config

11. **Cleanup legacy artifacts:**
    - Check for old Serena memory structures (see init step 9 for full list)
    - Check for stale KG entities: `vendor_doc` entities whose `source:` template no longer exists in the boilerplate
    - Check for orphaned rule files: `.claude/rules/core/*.md` files that don't match any current template
    - Propose cleanup table to user, wait for approval, then execute

### Migration: existing Serena memory projects

On `/webstack update`, detect and offer migration from old deployment targets:

**Old `.serena/memories/core/*` structure:**
1. Check if `.serena/memories/core/tooling.md` (or similar) exists
2. Propose migration:
   ```
   Detected old deployment structure (.serena/memories/core/*).
   Migrating to .claude/rules/core/ + Knowledge Graph.

   | Old location | New location | Action |
   |-------------|-------------|--------|
   | .serena/memories/core/tooling.md | .claude/rules/core/tooling.md | MIGRATE |
   | .serena/memories/vendor/daisyui-5.md | KG entity: VendorDaisyui5 | MIGRATE |
   | .serena/memories/_index.md | (removed) | DELETE |
   | .serena/memories/issues/open.md | KG entities (bug_resolution) | MIGRATE |
   ```
3. Wait for approval, then execute migration

**Flat Serena memory structure (vendor-*):**
1. Check if Serena `list_memories` returns any `vendor-*` entries
2. Propose migration:
   ```
   Detected flat Serena vendor memories.
   Migrating to Knowledge Graph entities.

   | Serena memory | KG entity | Action |
   |--------------|-----------|--------|
   | vendor-daisyui-5 | VendorDaisyui5 | MIGRATE |
   | vendor-react-router-7-routing | VendorReactRouter7Routing | MIGRATE |
   ```
3. For each memory: `read_memory` → parse content → `create_entities` with taxonomy
4. After migration, inform user they can remove old Serena memories via `delete_memory`

**CLAUDE.md sections:**
- Replace old `## Serena Memory Protocol` with `## Vendor Knowledge`
- Replace old `## Vendor Memory Loading` with `## Vendor Knowledge`

### Template Versioning

Each template file has frontmatter:

```yaml
---
version: 1.0.0
applies: daisyui@5
target: graph
tags: [daisyui, ui, components]
---
```

| Field | Purpose |
|-------|---------|
| `version` | Semantic version — bump when template content changes |
| `applies` | Condition for when template applies to a project |
| `target` | Deployment target: `rules` or `graph` |
| `priority` | Optional. `high` = load/process first. Omit for normal priority |
| `tags` | Searchable keywords for the template |

**Applies conditions:**

Check both `dependencies` and `devDependencies` in `package.json`. Strip version prefixes (`^`, `~`, `>=`, `=`) before comparing.

| Pattern | Matches when... |
|---------|-----------------|
| `Always` | Always applies |
| `react` | `react` in dependencies or devDependencies |
| `react-i18next` | `react-i18next` in dependencies or devDependencies |
| `daisyui@5` | `daisyui` installed, version starts with `5.` |
| `react-router@7.9.0+` | `react-router` installed, version >= 7.9.0 (numeric semver comparison, same major only) |
| `playwright \| "@playwright/test"` | Either package in dependencies or devDependencies (OR) |
| `.forgejo/workflows \| .gitea/workflows` | Either directory exists in project root (OR) |
| `react-router \| next \| remix` | Any of these packages in dependencies or devDependencies (OR) |
| `remix-i18next & react-router@7` | Both conditions must match (AND) |

**Operators:**
| Operator | Syntax | Meaning |
|----------|--------|---------|
| `\|` (OR) | `a \| b` | At least one condition matches |
| `&` (AND) | `a & b` | All conditions must match |
| `@N` | `pkg@5` | Package version starts with `N.` (major match) |
| `@X.Y.Z+` | `pkg@7.9.0+` | Package version >= X.Y.Z within same major (numeric semver, not string comparison) |

**If version cannot be parsed**, skip the template and warn the user.

**Target deployment rules:**
| Target | Deploy to | Discovery |
|--------|-----------|-----------|
| `rules` | `.claude/rules/core/{name}.md` | Auto-discovered by Claude Code |
| `graph` | KG entity `Vendor{PascalCaseName}` | `search_nodes` + `open_nodes` |

**Version comparison rules:**
- Parse version from YAML frontmatter (first `---` block)
- If deployed version has no frontmatter → treat as legacy, always update
- If versions match → skip unless user forces update
- Always preserve frontmatter when deploying

### When to Bump Template Versions

When editing templates in the boilerplate, bump the version:

| Change type | Version bump | Example |
|-------------|--------------|---------|
| Fix typo, clarify wording | PATCH | 1.0.0 → 1.0.1 |
| Add new section, expand content | MINOR | 1.0.0 → 1.1.0 |
| Restructure, breaking changes | MAJOR | 1.0.0 → 2.0.0 |

**After editing a template:**
1. Update the `version` in frontmatter
2. Test with `/webstack update` on a project
3. Verify the version diff shows correctly

### Version awareness

For vendor entities, always check the installed version in `package.json`. A `VendorDaisyui5` entity is wrong for a project on DaisyUI 4. When the version doesn't match a template, skip it and tell the user — they may want to create version-specific knowledge manually.

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
| `vendor/forgejo-actions.md` | `VendorForgejoActions` | cicd |
| `vendor/dokploy-monorepo-cicd.md` | `VendorDokployMonorepoCicd` | cicd |

For subdirectory files, the directory name + filename are joined in PascalCase.

### Domain mapping

Group vendor entities by domain for the CLAUDE.md loading table:

| Domain | Entities | Search query |
|--------|----------|-------------|
| routing | `VendorReactRouter7*` | `search_nodes("domain: routing")` |
| styling | `VendorDaisyui5`, `VendorTailwind4` | `search_nodes("domain: styling")` |
| backend | `VendorPayloadCms3`, `VendorPayloadRestClient` | `search_nodes("domain: backend")` |
| auth | `VendorOryHydra` | `search_nodes("domain: auth")` |
| i18n | `VendorReactRouter7I18n` | `search_nodes("domain: i18n")` |
| cicd | `VendorForgejoActions`, `VendorDokployMonorepoCicd` | `search_nodes("domain: cicd")` |
| tooling | `VendorRemarkFrontmatterSchema` | `search_nodes("domain: tooling")` |

## Automatic Updates During Work

These happen outside of this skill — they are standing instructions for how conventions evolve during normal development. Include these rules in the project's `CLAUDE.md`:

- **Vendor gotchas:** When you discover a version-specific gotcha, API difference, or undocumented behavior — `add_observations` to the relevant `vendor_doc` entity in the Knowledge Graph
- **New bugs:** When you encounter a bug or workaround — create a Knowledge Graph entity with type `bug_resolution` including symptom, root cause, and fix/workaround
- **Resolved bugs:** When fixing a known bug — update the Knowledge Graph entity's observations with the resolution
- **Architecture decisions:** When making a significant decision — create a Knowledge Graph entity with type `architecture_decision` including what was decided, why, and alternatives rejected
- **Session progress:** Use Claude Code's auto memory (`MEMORY.md`) for session notes and next steps

## Contributing Back to the Boilerplate

**Pitfalls and postmortems that are generalizable (not project-specific) should be contributed back to this skill** so all projects benefit.

When you discover something that would help other projects:
1. **Vendor issues:** Add to `vendor/{library}.md` in the boilerplate under "Known Issues"
2. **General patterns:** Update the relevant `core/*.md` template
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

The skill scaffolds or updates CLAUDE.md with these essential sections:

```markdown
# CLAUDE.md

Project-specific configuration. Core conventions are in `.claude/rules/core/` (auto-loaded).
This file contains **project overrides** and **architecture context**.

## Commands

\`\`\`bash
# Add project-specific commands here
yarn build        # Build the project
yarn check        # Run all checks
\`\`\`

See `.claude/rules/core/tooling.md` for full workflow rules.

## Architecture

<!-- User adds project-specific architecture here -->

## Rules

Core conventions are in `.claude/rules/core/` (auto-loaded by Claude Code). Add **project-specific overrides** below:

### Project-Specific
<!-- User adds project-specific rules here -->

## Vendor Knowledge

Vendor docs are stored as Knowledge Graph entities (type: `vendor_doc`).
Load them by domain before starting work using `search_nodes`.

<!-- GENERATED: The skill populates this table based on which vendor entities were deployed. -->
| Task domain | Search query | Entities |
|-------------|-------------|----------|
<!-- Add rows here for each deployed domain. Example:
| Routing | `search_nodes("domain: routing")` | VendorReactRouter7* |
| Styling | `search_nodes("domain: styling")` | VendorDaisyui5, VendorTailwind4 |
-->

**Session start:** `search_nodes` for topics related to current task.

### When to skip vendor loading
- Simple questions/clarifications (no code changes)
- User explicitly says "skip vendor docs"
- Task doesn't touch the vendor's domain

### Knowledge management
- Vendor gotchas discovered → `add_observations` to the relevant `vendor_doc` entity
- Bugs discovered → `create_entities` with type `bug_resolution`
- Architecture decisions → `create_entities` with type `architecture_decision`
- Session progress → Claude Code auto memory (`MEMORY.md`)
- New project rules → add to CLAUDE.md, not the Knowledge Graph
```

### Init: Create CLAUDE.md

On `/webstack init`, if no CLAUDE.md exists:
1. Create CLAUDE.md with the bootstrap template above (includes Vendor Knowledge)
2. Tell the user to fill in the Architecture and Project-Specific sections

If CLAUDE.md exists but is missing required sections:
1. Check for `## Vendor Knowledge` heading — if missing, append the Vendor Knowledge section
2. Show the user what was added

### Update: Ensure Required Sections Exist

On `/webstack update`, check CLAUDE.md for the vendor knowledge section:

**Vendor Knowledge section:**
1. Search for `## Vendor Knowledge` heading
2. If missing, append the section
3. If old `## Serena Memory Protocol` or `## Vendor Memory Loading` exists, offer to replace with `## Vendor Knowledge`
4. If old `## MCP Tools:` section exists inline, offer to remove it (now auto-loaded via `.claude/rules/core/mcp-tools.md`)

**Never overwrite** existing project-specific content (Commands, Architecture, Rules).
