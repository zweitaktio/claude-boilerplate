// version: 3.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name } = JSON.parse(await readStdin())

if (tool_name === 'EnterPlanMode') {
  inject('PreToolUse', `Before designing your plan:

1. RESEARCH — look up docs for every library the task touches:
   - Read package.json for installed versions
   - search_nodes("domain: <domain>") then open_nodes — KG vendor docs and pitfalls
   - search_nodes("architecture_decision") + search_nodes("bug_resolution") — past decisions and known bugs
   - If KG has no docs for a library: run Context7 (resolve-library-id → query-docs) AND WebSearch for the specific version in parallel

2. YOUR PLAN MUST COVER:
   - Edge cases — empty inputs, max limits, concurrent access, network failures
   - Error paths — every external call (API, DB, file I/O) needs a failure mode
   - Breaking changes — flag any changed exports, DB schema changes, or API contract changes
   - Verification — how to confirm the implementation works end-to-end

Do NOT finalize the plan until research is complete.`)
}

if (tool_name === 'ExitPlanMode') {
  inject('PreToolUse', `Before presenting: re-read the user's original request. Does the plan address everything they asked for? If not, update it.`)
}

if (tool_name === 'Task') {
  inject('PreToolUse', `Before delegating, include in the task prompt:
- Relevant vendor doc observations (from search_nodes then open_nodes)
- Known pitfalls for libraries the subagent will touch
- Architecture decisions that constrain the approach
Subagents cannot access the KG directly.`)
}

pass()
