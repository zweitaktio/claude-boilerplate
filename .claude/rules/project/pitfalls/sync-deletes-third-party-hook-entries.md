---
schema: 1
title: The settings merge deleted every hook entry another tool installed
type: pitfall
status: active
created: 2026-09-17
paths:
  - "scripts/sync.sh"
  - ".claude/settings.json"
tags: [sync, settings, hooks, merge]
trip-tasks:
  - "Install a third-party commit gate in a target project, then run the next /webstack update"
  - "Add a hook that a tool other than webstack owns to a target .claude/settings.json"
defect: "includes\\(\"\\.claude/hooks/\"\\)"
proof: unproven
---

# The settings merge deleted every hook entry another tool installed

`run_settings_merge` in `scripts/sync.sh` rebuilds each hook event that the source declares. It keeps
a target entry only when the entry carries no webstack hook command. The old test was
`cmd.includes(".claude/hooks/")`, which matches **any** file in that directory, not only the files the
skill ships.

`fallow agent install` writes `.claude/hooks/fallow-gate.sh` and a PreToolUse entry for it. The source
settings file declares `PreToolUse`, so the merge rebuilt that event and dropped the entry. The next
`/webstack update` removed a working commit gate, and the JSON report said `MERGE` with no warning.

**Fix:** decide ownership by the referenced filename, not by the directory.

```js
const m = cmd.match(/\.claude\/hooks\/([A-Za-z0-9._-]+)/)
return shipped.size === 0 || shipped.has(m[1])   // shipped = readdir of the skill's .claude/hooks
```

Every webstack entry invokes the `run.sh` dispatcher, and the skill ships `run.sh`. A retired hook
still names `run.sh`, so it is still dropped. A foreign script is not in the shipped set, so it
survives.

**Test a merge change against a fixture target, never against a real project.** Write a target
`settings.json` that holds one foreign entry, one retired webstack entry and one project entry. Then
run `sync.sh apply <fixture> --group settings` and read all three outcomes.

Related: [[sync-downgrades-a-target-that-is-ahead]] — the other way sync.sh damaged a target.
