---
schema: 1
title: sync.sh treated any version difference as UPDATE and downgraded targets
type: pitfall
status: active
created: 2026-08-26
paths:
  - "scripts/sync.sh"
  - "manifest.json"
tags: [sync, versioning, semver, deployment, data-loss, backporting]
trip-task: Write a bash function `determine_action` that takes a source version and a target version as semver strings and echoes what a deploy tool should do. Echo SKIP when they match, and decide the rest. Reply with the function only, in one bash code block.
defect: ^(?![\s\S]*(AHEAD|newer|gt |-gt|sort -V|semver))[\s\S]*else[\s\S]*UPDATE
defect-flags: ""
on-task: determine_action
proof: "none 8/8, full 8/8, claude-sonnet-5, 2026-08-29"
---

# sync.sh treated any version difference as UPDATE and downgraded targets

**Symptom:** a project improved a deployed hook or rule locally and bumped its version. The next
`sync.sh apply` overwrote it with the older boilerplate copy, with no warning. `compare` had
announced it as an ordinary `UPDATE`.

**Root cause:** `determine_action` compared versions for equality only:

```bash
elif [ "$src_ver" = "$tgt_ver" ]; then
  ...
else
  echo "UPDATE"     # fires when the TARGET is newer too
fi
```

A target on `1.3.0` against a source on `1.2.0` took the `else` branch. `compare` printed
`1.3.0->1.2.0`. `from` is the target and `to` is the source, so that arrow points backwards.

**Fix:** compare the versions numerically and emit a distinct `AHEAD` action that no deploy branch
accepts. `semver_newer` in `sync.sh` does it, and deliberately does not require a matching major
(unlike `semver_gte` in `evaluate-applies.sh`).

```bash
elif semver_newer "$tgt_ver" "$src_ver"; then
  echo "AHEAD"
```

`AHEAD` is a backport signal, not a skip. Carry the target's copy back — see
`core/process/backporting.md`. Never bump the source version to win the comparison: that discards the
target's content and keeps its number.

Related: [[manifest-glob-matches-dotfiles]] — the other way sync.sh damages a target it should not own.
