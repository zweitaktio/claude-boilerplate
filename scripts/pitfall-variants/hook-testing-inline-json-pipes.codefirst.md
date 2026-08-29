# Test hooks with fixture files, not inline JSON pipes

```bash
# ❌ bash-guard blocks this before the hook runs. Inline JSON piped into an
#    interpreter reads as ad-hoc scripting, so the hook never executes.
echo '{"tool_name":"Write","tool_input":{"file_path":"x"}}' | bun .claude/hooks/rules-guard.ts

# ✅ write the payload to a fixture file, then feed it by redirect
bun .claude/hooks/rules-guard.ts < scratchpad/case1.json
```

Relative imports resolve against the hook file, so `cwd` does not matter. Assert on the emitted
`permissionDecision` or `additionalContext` JSON.
