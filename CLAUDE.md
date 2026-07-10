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

Templates deploy as rule files based on their `target` frontmatter field:

| Directory | Target | Deploys to | Discovery |
|-----------|--------|------------|-----------|
| `core/{subdir}/` | `rules` | `.claude/rules/core/{name}.md` in target project (subdir stripped) | Auto-loaded by Claude Code (always or path-scoped) |
| `vendor/` | `rules` | `.claude/rules/vendor/{path}.md` in target project (path preserved) | Path-scoped, auto-loaded when editing matching files |
| `issues/` | `graph` | Knowledge Graph entities (`bug_resolution` type) | Templates only — not deployed directly |

Core rules are auto-loaded each turn (some are path-scoped to reduce context). Vendor docs are path-scoped reference material that auto-load when editing files in their domain. Lightweight KG references (`vendor_doc` type) point to the rule files for discoverability via `search_nodes("domain: ...")`.

### Frontmatter Schema

Every `.md` template (except SKILL.md and README.md) has this frontmatter:

```yaml
---
version: 1.0.0          # semver — bump on every content change
applies: daisyui@5      # condition for when this template applies
target: rules            # deployment target: rules | graph (graph only for issues/)
priority: high           # optional — high = load/process first
paths:                   # optional — path-scoped rules (core/ and vendor/ templates)
  - "**/*.tsx"
tags: [daisyui, ui]      # searchable keywords
---
```

The `applies` field uses these patterns:
- `Always` — unconditional
- `react` — package name in dependencies (falls back to checking enabled plugins in `.claude/settings*.json`)
- `daisyui@5` — package version starts with `5.`
- `react-router@8.1.0+` — version >= 8.1.0
- `playwright | "@playwright/test"` — either package present

### Vendor KG References

Vendor docs deploy as path-scoped rule files. Lightweight KG entities (`vendor_doc` type) reference the deployed rule files for discoverability:

- `vendor/daisyui-5.md` → rule: `.claude/rules/vendor/daisyui-5.md`, KG: `VendorDaisyui5`
- `vendor/react-router-8/routing.md` → rule: `.claude/rules/vendor/react-router-8/routing.md`, KG: `VendorReactRouter8Routing`
- `vendor/playwright.md` → rule: `.claude/rules/vendor/playwright.md`, KG: `VendorPlaywright` (domain: testing; scoped to `**/e2e/**`, `**/*.spec.ts`, `**/playwright.config.ts`)

KG entities store only: `domain`, `rule` (path to deployed file), and `source` (path in boilerplate). Full content is in the rule file.

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

## Scripts

Scripts in `scripts/` are part of the skill and run on developer machines. They must be compatible with both macOS (Bash 3.2, BSD coreutils) and Linux (Bash 4+, GNU coreutils). Avoid GNU-only flags, bashisms above 3.2, and Linux-only paths.

## Key Files

- **SKILL.md** — Source of truth for skill operation: invocation logic, naming tables, domain mapping, CLAUDE.md bootstrap template
- **core/process/tooling.md** — Core always-loaded template (commands, verification, tool discipline, agent behavior)
- **core/process/scripting.md** — Script requirements and shell compatibility (path-scoped to `scripts/**`, `**/*.sh`)
- **core/claude-config/claude-md.md** — Conventions for CLAUDE.md files deployed to target projects
