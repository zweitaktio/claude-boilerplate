---
paths:
  - "core/**/*.md"
  - "vendor/**/*.md"
  - "references/**/*.md"
  - "scripts/**"
  - "SKILL.md"
  - "manifest.json"
---

# Skill architecture — what deploys where

This file loads when you open a template, a script, `SKILL.md` or `manifest.json`. `CLAUDE.md` holds
the conventions that apply on every turn. This file holds the layout that only a template edit needs.

## Deployment targets

Templates deploy as rule files based on their `target` frontmatter field:

| Directory | Target | Deploys to | Discovery |
|-----------|--------|------------|-----------|
| `core/{subdir}/` | `rules` | `.claude/rules/core/{name}.md` in target project (subdir stripped) | Auto-loaded by Claude Code (always or path-scoped) |
| `vendor/` | `rules` | `.claude/rules/vendor/{path}.md` in target project (path preserved) | Path-scoped, auto-loaded when editing matching files |
| `agents/` | — | `.claude/agents/` in target project | Available as subagent types |

A rule with no `paths:` frontmatter is auto-loaded every turn. A rule with `paths:` loads only when you
touch a matching file. That one key is the whole mechanism. Project knowledge is Markdown under
`.claude/rules/project/`, found by auto-load or `wiki.sh find`.

`manifest.json` is the authority on what deploys where. The inventories in SKILL.md are generated from
disk by `scripts/gen-inventory.sh`.

## Frontmatter schema

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

## Vendor docs

Vendor docs deploy as path-scoped rule files, path preserved, one file per topic. The file is the source
of truth. There is nothing to register anywhere:

| Source | Deployed path | Scope |
|--------|---------------|-------|
| `vendor/daisyui-5.md` | `.claude/rules/vendor/daisyui-5.md` | Its own `paths:` |
| `vendor/react-router-8/routing.md` | `.claude/rules/vendor/react-router-8/routing.md` | Its own `paths:` |
| `vendor/playwright.md` | `.claude/rules/vendor/playwright.md` | `**/e2e/**`, `**/*.spec.ts`, `**/playwright.config.ts` |

Each declares `domain:` and `paths:` frontmatter and auto-loads when you open a file in its domain.

## Key files

- **SKILL.md** — Source of truth for skill operation: invocation dispatch, layout, CLAUDE.md bootstrap template
- **references/init.md** — The `/webstack init` flow, step by step
- **references/update.md** — The `/webstack update` flow, step by step
- **references/maintenance.md** — The 13-step `/webstack maintenance` specification
- **manifest.json** — What deploys where, and how updates are compared. Authority for the layout table
- **scripts/gen-inventory.sh** — Regenerates SKILL.md's rule/budget/hook tables from disk, and fails when SKILL.md passes 500 lines
- **core/process/tooling.md** — Core always-loaded template (commands, verification, tool discipline, agent behavior)
- **core/process/scripting.md** — Script requirements and shell compatibility (path-scoped to `scripts/**`, `**/*.sh`)
- **core/claude-config/claude-md.md** — Conventions for CLAUDE.md files deployed to target projects
