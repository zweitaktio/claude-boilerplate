import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name } = JSON.parse(await readStdin())

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
