# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A Claude Code Skill (`webstack`) — not a runnable application. It distributes web development conventions to target projects via `/webstack init` and `/webstack update`. There is no package.json, no build system, no tests, no dependencies. Every file is a markdown template with YAML frontmatter.

Install globally via symlink:

```bash
ln -s /path/to/claude-boilerplate ~/.claude/skills/webstack
```

`SKILL.md` is the orchestration entrypoint — read by Claude Code when users invoke the skill in a target project.

**The layout, the frontmatter schema and the key files are in `.claude/rules/skill-architecture.md`.**
That rule loads on its own when you open a template, a script, `SKILL.md` or `manifest.json`.

## Editing Templates

When modifying any template:

1. Edit the content
2. Bump the `version` in frontmatter (patch for wording fixes, minor for new sections, major for restructuring)
3. Test with `/webstack update` on a project to verify the version diff shows correctly

An unbumped change ships silently. Changes are tracked two ways: `version` in frontmatter (primary) and git SHA stored in `.claude/webstack.sha` in target projects (safety net). On `/webstack update`, templates that changed in git but weren't version-bumped are flagged as `REVIEW`. On `/webstack init`, the current HEAD SHA is recorded after deployment.

When adding a new template:

1. Create the `.md` file in `core/` or `vendor/` with the required frontmatter fields
2. Set the correct `applies` condition and `target`
3. Decide always-loaded or path-scoped — add `paths:` if scoped. Prefer scoped; always-loaded rules are
   already over the byte budget
4. Run `scripts/gen-inventory.sh --write` so SKILL.md's tables pick it up
5. Verify the `applies` condition resolves: `scripts/evaluate-applies.sh <a-real-project>`. A condition
   that matches nothing deploys nothing, silently

Never hand-edit the tables between `<!-- generated:… -->` markers in SKILL.md. Run
`scripts/gen-inventory.sh --write` instead.

## Scripts

Scripts in `scripts/` are part of the skill and run on developer machines. They must be compatible with both macOS (Bash 3.2, BSD coreutils) and Linux (Bash 4+, GNU coreutils). Avoid GNU-only flags, bashisms above 3.2, and Linux-only paths.
