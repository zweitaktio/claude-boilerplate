# Test hooks with fixture files, not inline JSON pipes

`bash-guard` blocks `echo '{...}' | <interpreter> hook.ts`, so the hook never runs. Write the payload
to a fixture file and redirect it: `bun .claude/hooks/rules-guard.ts < scratchpad/case1.json`.
