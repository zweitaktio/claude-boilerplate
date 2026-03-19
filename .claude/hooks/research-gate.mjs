// version: 2.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name } = JSON.parse(await readStdin())

if (tool_name === 'ExitPlanMode') {
  inject('PreToolUse', `PLAN REVIEW — before requesting approval, audit your plan for:

1. Edge cases — what happens with empty inputs, max limits, concurrent users, network failures?
2. Error paths — every external call (API, DB, file I/O) needs a failure mode. Are they all covered?
3. Missing requirements — re-read the user's original request. Does the plan address everything they asked for?
4. Scope creep — does the plan include work the user didn't ask for? Remove it.
5. Feasibility — are there assumptions that haven't been validated? Flag them as risks.
6. Breaking changes — does any step change an exported interface, DB schema, or API contract?
7. Dependencies — does the plan require libraries, services, or permissions that may not be available?

If you find gaps, update the plan file before calling ExitPlanMode.
(core/process/requirements-engineering.md)`)
}

if (tool_name === 'EnterPlanMode') {
  inject('PreToolUse', `Before finalizing your plan, complete this research:

1. KG — load existing decisions and pitfalls:
   - search_nodes("architecture_decision") — past decisions
   - search_nodes("domain: <domain>") then open_nodes — vendor docs
   - search_nodes("bug_resolution") — known pitfalls
   (core/process/mcp-tools.md § KG read triggers)

2. Documentation — verify current APIs:
   - Context7: resolve-library-id then query-docs for each library
   - WebSearch: "<library> <version> breaking changes"
   (core/process/engineering-discipline.md § Verification Discipline)

Do NOT finalize the plan until steps 1-2 are complete.`)
}

if (tool_name === 'Task') {
  inject('PreToolUse', `Before delegating, include in the task prompt:
- Relevant vendor doc observations (from search_nodes then open_nodes)
- Known pitfalls for libraries the subagent will touch
- Architecture decisions that constrain the approach
Subagents cannot access the KG directly.
(core/process/mcp-tools.md § KG read triggers)`)
}

pass()
