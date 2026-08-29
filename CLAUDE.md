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
| `agents/` | — | `.claude/agents/` in target project | Available as subagent types |

A rule with no `paths:` frontmatter is auto-loaded every turn; a rule with `paths:` loads only when you
touch a matching file. That one key is the whole mechanism. Project knowledge is Markdown under
`.claude/rules/project/`, found by auto-load or `wiki.sh find`.

`manifest.json` is the authority on what deploys where. The inventories in SKILL.md are generated from
disk by `scripts/gen-inventory.sh` — edit the templates, then run `gen-inventory.sh --write`, never
hand-edit the tables between `<!-- generated:… -->` markers.

### Frontmatter Schema

Every `.md` template (except SKILL.md and README.md) has this frontmatter:

```yaml
---
version: 1.0.0          # semver — bump on every content change
applies: daisyui@5      # condition for when this template applies
target: rules            # deployment target — always `rules`
priority: high           # optional — high = load/process first
paths:                   # optional — omit and the rule loads every turn
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

### Vendor Docs

Vendor docs deploy as path-scoped rule files, path preserved, one file per topic. The file is the source
of truth — there is nothing to register anywhere:

- `vendor/daisyui-5.md` → `.claude/rules/vendor/daisyui-5.md`
- `vendor/react-router-8/routing.md` → `.claude/rules/vendor/react-router-8/routing.md`
- `vendor/playwright.md` → `.claude/rules/vendor/playwright.md` (domain: testing; scoped to `**/e2e/**`, `**/*.spec.ts`, `**/playwright.config.ts`)

Each declares `domain:` and `paths:` frontmatter and auto-loads when you open a file in its domain.

## Editing Templates

When modifying any template:

1. Edit the content
2. Bump the `version` in frontmatter (patch for wording fixes, minor for new sections, major for restructuring)
3. Test with `/webstack update` on a project to verify the version diff shows correctly

Changes are tracked two ways: `version` in frontmatter (primary) and git SHA stored in `.claude/webstack.sha` in target projects (safety net). On `/webstack update`, templates that changed in git but weren't version-bumped are flagged as `REVIEW`. On `/webstack init`, the current HEAD SHA is recorded after deployment.

When adding a new template:

1. Create the `.md` file in `core/` or `vendor/` with the required frontmatter fields
2. Set the correct `applies` condition and `target`
3. Decide always-loaded or path-scoped — add `paths:` if scoped. Prefer scoped; always-loaded rules are
   already over the byte budget
4. Run `scripts/gen-inventory.sh --write` so SKILL.md's tables pick it up
5. Verify the `applies` condition resolves: `scripts/evaluate-applies.sh <a-real-project>`. A condition
   that matches nothing deploys nothing, silently

## Scripts

Scripts in `scripts/` are part of the skill and run on developer machines. They must be compatible with both macOS (Bash 3.2, BSD coreutils) and Linux (Bash 4+, GNU coreutils). Avoid GNU-only flags, bashisms above 3.2, and Linux-only paths.

## Key Files

- **SKILL.md** — Source of truth for skill operation: invocation logic, init/update flows, layout, CLAUDE.md bootstrap template
- **manifest.json** — What deploys where, and how updates are compared. Authority for the layout table
- **scripts/gen-inventory.sh** — Regenerates SKILL.md's rule/budget/hook tables from disk
- **references/maintenance.md** — The 13-step `/webstack maintenance` specification
- **core/process/tooling.md** — Core always-loaded template (commands, verification, tool discipline, agent behavior)
- **core/process/scripting.md** — Script requirements and shell compatibility (path-scoped to `scripts/**`, `**/*.sh`)
- **core/claude-config/claude-md.md** — Conventions for CLAUDE.md files deployed to target projects
