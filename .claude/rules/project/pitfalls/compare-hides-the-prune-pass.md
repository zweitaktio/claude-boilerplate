---
schema: 1
title: sync.sh compare never previews a deletion, because the prune pass runs only under apply
type: pitfall
status: active
created: 2026-09-18
paths:
  - "scripts/sync.sh"
  - "manifest.json"
tags: [sync, prune, deploy, dry-run, deletion]
trip-tasks:
  - "Run sync.sh compare against a target project. Report every file the next apply will change."
  - "A template was removed from core/. Confirm from a dry run what a target project receives."
defect: "(CREATE|UPDATE|SKIP|AHEAD)[^P]*$"
proof: unproven
---

# `compare` never previews a deletion

**Symptom:** you remove a template from `core/`, run `sync.sh compare <target>`, and read a clean
action table. No entry mentions the removed file. You conclude that the target keeps it, or that the
deployment does nothing. The next `apply` then deletes it.

**Root cause:** the prune pass is inside `if [ "$COMMAND" = "apply" ]` in `scripts/sync.sh`. `compare`
returns before it. The pass covers `PRUNE_GROUPS="hooks hook-infra rules vendor"`, so it owns
`.claude/hooks/`, `.claude/rules/core/` and `.claude/rules/vendor/`. It deletes every file in those
directories that the manifest no longer expects.

```bash
if [ "$COMMAND" = "apply" ]; then
  PRUNE_GROUPS="hooks hook-infra rules vendor"
```

**Consequence:** two classes of file disappear with no dry-run warning. A template you deleted from
the source goes, which is correct. A file somebody hand-added to `.claude/rules/core/` or
`.claude/hooks/` also goes, which is usually not.

**Fix when you deploy:** treat a clean `compare` as evidence about writes, never about deletions.
List the target directory and compare it against the manifest yourself before you apply. Save any
local edit in `.claude/hooks/` or `.claude/rules/core/` first. `.claude/rules/project/` is never
pruned, so project wiki pages are safe.

Related: [[sync-downgrades-a-target-that-is-ahead]] — the version comparison that `AHEAD` fixed.
