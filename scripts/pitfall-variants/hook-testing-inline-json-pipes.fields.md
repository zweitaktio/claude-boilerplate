# Test hooks with fixture files, not inline JSON pipes

| | |
|---|---|
| **Never** | `echo '{...}' \| bun hook.ts` — `bash-guard` blocks it and the hook never runs |
| **Always** | `bun .claude/hooks/rules-guard.ts < scratchpad/case1.json` |
| **Why** | Inline JSON piped into an interpreter reads as ad-hoc scripting |
| **cwd** | Does not matter. Relative imports resolve against the hook file |
| **Assert on** | The emitted `permissionDecision` or `additionalContext` JSON |
