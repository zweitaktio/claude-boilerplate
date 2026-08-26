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
