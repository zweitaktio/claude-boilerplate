---
schema: 1
title: manifest include globs match dotfiles, so config files ship as payload
type: pitfall
status: active
created: 2026-07-28
paths:
  - "manifest.json"
  - "scripts/sync.sh"
  - ".claude/hooks/**"
tags: [manifest, sync, glob, dotfiles, deployment]
---

# manifest include globs match dotfiles, so config files ship as payload

**Symptom:** a file you added purely for this repo's own toolchain turns up deployed in every target
project, and `sync.sh compare` reports it as `REPLACE` forever — the action never clears no matter how
many times you apply.

**Root cause:** two behaviours compounding.

1. `enumerate_files` resolves includes with `find -name '*.mjs'`. Unlike shell globbing, `find -name`
   **does** match leading dots, so `.prettierrc.mjs` satisfied the `hooks` group's `*.mjs`.
2. That group uses `comment` versioning, which reads a `// version:` line. A config file has none, so
   `determine_action` takes the `[ -z "$tgt_ver" ]` branch and returns `REPLACE` every run.

The perpetual `REPLACE` is the tell: it means "no version marker in target", which for a group keyed
on version markers means the file does not belong to that group.

**Fix:** add an `exclude` to the group. `enumerate_files` supports it and anchors each entry as
`/(pattern)$`:

```json
{
  "name": "hooks",
  "include": ["*.mjs", "*.ts"],
  "exclude": [".prettierrc.mjs"],
  "versioning": "comment"
}
```

Excluding it also drops it from the prune pass's expected list, so the next apply deletes the stale
copy from every target automatically.

**Before adding any non-hook file to `.claude/hooks/`:** it ships unless excluded. `package.json` and
`tsconfig.json` are safe only because they match neither `*.mjs` nor `*.ts` — a future
`eslint.config.mjs` would ship.

Related: [[grep-in-command-substitution-aborts]].
