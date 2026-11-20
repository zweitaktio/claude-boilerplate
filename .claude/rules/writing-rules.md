---
version: 2.1.0
applies: Always
target: rules
priority: high
tags: [rules, writing, compliance]
---

# Writing Rules — project overlay

`core/claude-config/writing-rules.md` is the authority. It holds the compliance hierarchy, forced
artifacts, the escalation path, rule sizing, the Simplified Technical English requirement, the
duplication rule and the common mistakes. Read it there. Never restate it here, and never let the two
files disagree.

This file holds only what applies to this repository.

## This repository is the rule set

Every template you edit deploys to another project. A defect here reaches every target on the next
`/webstack update`. Three consequences follow.

- **A cross-reference must use the deployed path.** `core/{subdir}/` deploys to
  `.claude/rules/core/{name}.md`. Write `core/knowledge-base`, never `core/process/knowledge-base`. The
  second form resolves here and fails in every target project.
- **`SKILL.md` and `references/maintenance.md` are the exception.** They stay in this repository, so the
  source path is correct in them.
- **Bump the `version` in frontmatter on every content change.** Use patch for wording, minor for a new
  section, and major for a restructure. An unbumped change ships silently.

## Run the checks before you commit

| Command | What it proves |
|---------|----------------|
| `node scripts/ste-check.ts` | No arrow chain, no hedge, no sentence over 25 words. Exits non-zero on a violation |
| `node scripts/ste-check.ts --filler` | Lists rule 11 candidates. Judge each with the deletion test |
| `node scripts/dupe-check.ts` | No repeated instruction between two files that load together |
| `node scripts/wiki-review.ts` | Which project pages to retire, fix, merge or review |
| `./scripts/gen-inventory.sh --check` | The SKILL.md tables match the templates on disk, and the body is under 500 lines |
| `./scripts/context-budget.sh` | The always-loaded byte cost. It parses frontmatter, so trust it |
| `cd .claude/hooks && bun run check` | The hooks and `scripts/*.ts` typecheck, lint and format |

All three review tools take `--root <dir>`, so you can run them against a target project from this
checkout. Without the flag each tool resolves the root from its own location, and it prints that root
in the summary line. Read that line. `ste-check.ts` and `dupe-check.ts` exit 2 when they find no file,
because a scan over zero files is a failed run and never a pass.

**Never detect `paths:` with a plain grep over a whole file.** A fenced frontmatter example contains a
`paths:` line, and the grep then reports an always-loaded file as path-scoped. That error hid
`core/knowledge-base` from the always-loaded count for months.

## `.claude/rules/` here is a mirror, not a duplicate

This repository does not deploy its own `core/` templates, so only `.claude/rules/*.md` loads here.
`interaction.md` and `fetching.md` therefore repeat content from `core/interaction` and `core/tooling`
on purpose. A pointer would resolve to a file that never loads.

**Edit both sides together.** The mirror is the one place where the duplication rule in
`core/writing-rules` does not apply.

## Count the emphasis budget across the whole set

The budget is 3 to 5 markers across the **whole always-loaded set**, not per file. Count them before you
add one. Search for `**CRITICAL` and `**IMPORTANT` in every `core/` template whose frontmatter has no
`paths:` key.

Adding a marker means you remove one somewhere else.
