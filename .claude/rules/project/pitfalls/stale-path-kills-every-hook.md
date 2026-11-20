---
schema: 1
title: A node upgrade mid-session kills every hook, and each guard then enforces nothing
type: pitfall
status: active
created: 2026-09-17
paths:
  - ".claude/hooks/run.sh"
  - ".claude/hooks/**"
tags: [hooks, nvm, path, runtime]
trip-tasks:
  - "Every Bash call reports a hook error, so find out why the session started to fail"
  - "Add a hook and confirm that it runs on this machine"
defect: "exec: node: not found|command not found: node"
proof: proven
---

# A node upgrade mid-session kills every hook

**Symptom:** every tool call reports `PreToolUse:Bash hook error`, with
`/bin/sh: node: command not found` or `run.sh: line 16: exec: node: not found`. The session keeps
working, because a non-zero hook exit is non-blocking. Each guard silently stops to enforce.

**Root cause:** Claude Code inherits `PATH` from the shell that started it. nvm writes one version
directory into `PATH` and into `NVM_BIN`. An `nvm install` removes the old directory, and both
variables then name a directory without `node`. A global npm binary can survive there, so
`codebase-memory-mcp --version` answers while `node` does not.

**Fix:** `run.sh` resolves the runtime from disk when `PATH` fails. It tries `bun` and `node` on
`PATH`, then `$BUN_INSTALL/bin/bun`, `$HOME/.bun/bin/bun`, `$NVM_BIN/node`, the newest
`$HOME/.nvm/versions/node/*/bin/node`, and last the Homebrew and system paths.

**Sort the bare version, never the path.** `sort -t. -k1.2,1n` over full paths reads the home
directory as the first field, and v9 then outranks v26. Put the version in front of the path:

```bash
ls -1d "$HOME"/.nvm/versions/node/*/bin/node |
  sed 's|.*/node/v\([^/]*\)/bin/node|\1 &|' |
  sort -t. -k1,1n -k2,2n -k3,3n | tail -1 | sed 's|^[^ ]* ||'
```

**Let a guard fail closed only where a block cannot lock the session.** From Claude Code 2.1.295, a
command hook with `"onFailure": "block"` blocks the action when it cannot start, times out or exits
with an unexpected code. A dead runtime stops every hook at once. A guard on `Bash` or `Write|Edit`
with this key then blocks every command or every edit, and the session cannot repair itself. A hook
that only injects context protects nothing when it fails, so it must never block. Only `ctx-guard` and
`screenshot-guard` meet both conditions: they deny, and they guard other tools. The guards on `Bash`
and `Write|Edit` stay fail-open and depend on the runtime lookup above.

**Test with a fake home.** Symlink the real `.nvm` into a scratch directory. Run the hook with
`HOME` there and with an empty `NVM_BIN` and `BUN_INSTALL`, or the test resolves `node` from `PATH`.

Related: [[hook-testing-inline-json-pipes]].
