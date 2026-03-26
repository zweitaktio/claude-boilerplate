// version: 5.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name } = JSON.parse(await readStdin())

if (tool_name === 'EnterPlanMode') {
  inject('PreToolUse', `Before designing your plan, complete these research steps.

Vendor docs auto-load via path-scoped rules — no manual lookup needed.

STEP 1 — IDENTIFY LIBRARIES
Read package.json to find every library the task touches and their exact versions.

STEP 2 — CHECK KG FOR PROJECT-SPECIFIC KNOWLEDGE
Run these searches for pitfalls and past decisions:
  search_nodes("bug_resolution")           → open_nodes on results
  search_nodes("Pitfall")                  → open_nodes on results
  search_nodes("architecture_decision")    → past decisions that constrain this task

STEP 3 — EXTERNAL DOCS (in parallel)
  Context7: resolve-library-id("<package>") → query-docs(id, topic: "<specific topic>")
  WebSearch: "<library> <version> <topic> docs"

STEP 4 — YOUR PLAN MUST COVER:
  - Edge cases — empty inputs, max limits, concurrent access, network failures
  - Error paths — every external call (API, DB, file I/O) needs a failure mode
  - Breaking changes — flag any changed exports, DB schema changes, or API contract changes
  - KG findings — reference specific pitfalls or bug resolutions found in step 2
  - Verification — how to confirm the implementation works end-to-end

Do NOT finalize the plan until steps 1-3 are complete.`)
}

if (tool_name === 'ExitPlanMode') {
  inject('PreToolUse', `Before presenting: re-read the user's original request. Does the plan address everything they asked for? If not, update it.`)
}

if (tool_name === 'Task') {
  inject('PreToolUse', `Before delegating, include in the task prompt:

1. VENDOR DOC CONTEXT — vendor docs auto-load for the subagent via path-scoped rules.
   If the subagent edits files matching vendor doc paths, the docs load automatically.

2. KNOWN PITFALLS — run search_nodes("bug_resolution") + search_nodes("Pitfall"),
   then paste relevant observations verbatim into the task prompt.
   Subagents cannot access the KG directly.

3. ARCHITECTURE DECISIONS — paste any architecture_decision observations that constrain the approach.`)
}

pass()
