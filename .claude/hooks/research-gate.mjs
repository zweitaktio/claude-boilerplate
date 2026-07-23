// version: 8.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name } = JSON.parse(await readStdin())

if (tool_name === 'EnterPlanMode') {
  inject(
    'PreToolUse',
    `REQUIRED before designing:
1. Library doc lookup (see core/process/mcp-tools — all 3 steps, no exceptions)
2. Project knowledge: pitfalls/decisions for the files you'll touch auto-load as path-scoped rules.
   For areas you won't open, run: .claude/scripts/wiki.sh find "<topic>" (core/process/knowledge-base)
3. Domain pattern research if implementing a feature (see core/process/engineering-discipline)

Do NOT finalize the plan until these are complete.`,
  )
}

if (tool_name === 'ExitPlanMode') {
  inject(
    'PreToolUse',
    `Before presenting: re-read the user's original request. Does the plan address everything they asked for? If not, update it.`,
  )
}

if (tool_name === 'Task') {
  inject(
    'PreToolUse',
    `Before delegating, include in the task prompt:

1. VENDOR + PROJECT KNOWLEDGE auto-loads for the subagent via path-scoped rules — when it reads files
   matching a rule's paths:, the pitfall/convention/vendor doc loads automatically. No manual paste
   needed for the files it will edit.
2. OFF-PATH PITFALLS — for knowledge outside the files it edits, run .claude/scripts/wiki.sh find "<topic>"
   and paste the relevant pages into the task prompt.
3. CONSTRAINING DECISIONS — paste any architecture decision that limits the approach.
4. NO ASSUMPTIONS — tell the subagent: "If requirements are unclear or you need a judgment call,
   report back instead of guessing."`,
  )
}

pass()
