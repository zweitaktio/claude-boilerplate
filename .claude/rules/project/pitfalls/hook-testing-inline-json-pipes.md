---
schema: 1
title: bash-guard blocks inline "echo JSON | run.sh hook" test commands
type: pitfall
status: active
created: 2026-07-23
paths:
  - ".claude/hooks/**"
tags: [hooks, testing, bash-guard, fixtures]
links:
  - core/process/scripting
trip-task: I have a Claude Code hook at .claude/hooks/rules-guard.ts that reads a JSON payload on stdin. Show me the exact shell command you would run to test it with a Write payload for a file named .claude/rules/x.md. Reply with the command only.
defect: (echo|printf)[^\n]*\{[^\n]*\}[^\n]*\|
proof: "none 0/8, full 8/8, claude-sonnet-5, 2026-08-29"
---

# Test hooks with fixture files, not inline JSON pipes

**Symptom:** trying to test a hook with `echo '{"tool_name":...}' | bash run.sh <hook>` (or `printf`
of escaped JSON piped into the runtime) gets denied by `bash-guard` before it runs.

**Root cause:** `bash-guard` inspects Bash commands and blocks patterns it treats as risky inline
scripting — heredocs/`printf` of complex escaped payloads piped into an interpreter look like exactly
that. The hook you're testing never executes.

**Fix:** write each test payload to a fixture file (use the scratchpad), then feed it by redirect and
invoke the runtime directly:

```bash
# fixtures written with the Write tool, one JSON object each
RT=$(command -v bun >/dev/null 2>&1 && echo bun || echo node)
$RT .claude/hooks/rules-guard.ts < scratchpad/case1.json
```

ESM relative imports (`./core/output.mjs`) resolve against the hook file, so `cwd` doesn't matter —
run from anywhere. Assert on the emitted `permissionDecision` / `additionalContext` JSON.
