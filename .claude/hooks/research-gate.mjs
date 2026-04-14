// version: 7.0.0
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'
import { read } from './core/state.mjs'
import { existsSync } from 'fs'
import { join } from 'path'

const { tool_name } = JSON.parse(await readStdin())
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? '.'

if (tool_name === 'EnterPlanMode') {
  inject('PreToolUse', `REQUIRED before designing:
1. Library doc lookup (see core/process/mcp-tools — all 3 steps, no exceptions)
2. KG pitfall search: search_nodes("bug_resolution"), search_nodes("Pitfall"), search_nodes("architecture_decision")
3. Domain pattern research if implementing a feature (see core/process/engineering-discipline)

Do NOT finalize the plan until these are complete.`)
}

if (tool_name === 'ExitPlanMode') {
  const kgExists = existsSync(join(projectDir, '.memory', 'graph.jsonl'))
  const kgQueried = read('kg-queried') !== null

  if (kgExists && !kgQueried) {
    deny('PreToolUse', `BLOCKED: Knowledge Graph was not queried this session. Before presenting your plan, run:
  search_nodes("bug_resolution")
  search_nodes("Pitfall")
  search_nodes("architecture_decision")
Then review findings and incorporate them into the plan.
(core/process/engineering-discipline.md § Planning)`)
  }

  inject('PreToolUse', `Before presenting: re-read the user's original request. Does the plan address everything they asked for? If not, update it.`)
}

if (tool_name === 'Task') {
  inject('PreToolUse', `Before delegating, include in the task prompt:

1. VENDOR DOC CONTEXT — vendor docs auto-load for the subagent via path-scoped rules.
   If the subagent edits files matching vendor doc paths, the docs load automatically.

2. KNOWN PITFALLS — run search_nodes("bug_resolution") + search_nodes("Pitfall"),
   then paste relevant observations verbatim into the task prompt.
   Subagents cannot access the KG directly.

3. ARCHITECTURE DECISIONS — paste any architecture_decision observations that constrain the approach.

4. NO ASSUMPTIONS — tell the subagent: "If requirements are unclear or you need to make a judgment call, report back instead of guessing."`)
}

pass()
