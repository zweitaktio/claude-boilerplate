# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A Claude Code Skill (`webstack`) — not a runnable application. It distributes web development conventions to target projects via `/webstack init` and `/webstack update`. There is no package.json, no build system, no tests, no dependencies. Every file is a markdown template with YAML frontmatter.

Install globally via symlink:

```bash
ln -s /path/to/claude-boilerplate ~/.claude/skills/webstack
```

`SKILL.md` is the orchestration entrypoint — read by Claude Code when users invoke the skill in a target project.

## Architecture

Templates deploy to two targets based on their `target` frontmatter field:

| Directory | Target | Deploys to | Discovery |
|-----------|--------|------------|-----------|
| `core/{subdir}/` | `rules` | `.claude/rules/core/{name}.md` in target project (subdir stripped) | Auto-loaded by Claude Code every turn |
| `vendor/` | `graph` | Knowledge Graph entities (`vendor_doc` type) | Queried via `search_nodes` + `open_nodes` |
| `issues/` | `graph` | Knowledge Graph entities (`bug_resolution` type) | Templates only — not deployed directly |

Core rules are auto-loaded each turn (some are path-scoped to reduce context). Vendor docs are large, domain-specific reference material loaded on demand.

### Frontmatter Schema

Every `.md` template (except SKILL.md and README.md) has this frontmatter:

```yaml
---
version: 1.0.0          # semver — bump on every content change
applies: daisyui@5      # condition for when this template applies
target: graph            # deployment target: rules | graph
priority: high           # optional — high = load/process first
paths:                   # optional — path-scoped rules only (core/ templates)
  - "**/*.tsx"
tags: [daisyui, ui]      # searchable keywords
---
```

The `applies` field uses these patterns:
- `Always` — unconditional
- `react` — package name in dependencies
- `daisyui@5` — package version starts with `5.`
- `react-router@7.9.0+` — version >= 7.9.0
- `playwright | "@playwright/test"` — either package present
- `.forgejo/workflows | .gitea/workflows` — either directory exists

### Vendor Entity Naming

Vendor templates become Knowledge Graph entities with `Vendor` prefix + PascalCase filename:

- `vendor/daisyui-5.md` → `VendorDaisyui5`
- `vendor/react-router-7/routing.md` → `VendorReactRouter7Routing`
- `vendor/payload-rest-client.md` → `VendorPayloadRestClient`

Entities are grouped by domain (`routing`, `styling`, `backend`, `auth`, `i18n`, `cicd`, `tooling`). Full mapping is in SKILL.md under "Domain mapping".

## Editing Templates

When modifying any template:

1. Edit the content
2. Bump the `version` in frontmatter (patch for wording fixes, minor for new sections, major for restructuring)
3. Test with `/webstack update` on a project to verify the version diff shows correctly

Changes are tracked two ways: `version` in frontmatter (primary) and git SHA stored in `.claude/webstack.sha` in target projects (safety net). On `/webstack update`, templates that changed in git but weren't version-bumped are flagged as `REVIEW`. On `/webstack init`, the current HEAD SHA is recorded after deployment.

When adding a new template:

1. Create the `.md` file in `core/` or `vendor/` with the required frontmatter fields
2. Set the correct `applies` condition and `target`
3. For vendor templates: add the entity name and domain to the naming/mapping tables in SKILL.md
4. For core templates: decide if always-loaded or path-scoped (add `paths` frontmatter if scoped)

## Key Files

- **SKILL.md** — Source of truth for skill operation: invocation logic, naming tables, domain mapping, CLAUDE.md bootstrap template
- **core/process/tooling.md** — Most frequently updated core template (commands, verification workflow, git rules, agent behavior)
- **core/claude-config/claude-md.md** — Conventions for CLAUDE.md files deployed to target projects
