// version: 4.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read } from './core/state.mjs'

const { tool_name } = JSON.parse(await readStdin())

if (tool_name === 'EnterPlanMode') {
  inject('PreToolUse', `Before designing your plan, you MUST complete ALL research steps below.

STEP 1 — IDENTIFY LIBRARIES
Read package.json to find every library the task touches and their exact versions.

STEP 2 — LOAD KNOWLEDGE GRAPH (mandatory, not optional)
Run ALL of these searches — do not skip any:
  search_nodes("domain: <domain>")        → then open_nodes on EVERY result
  search_nodes("<library-name>")           → then open_nodes on EVERY result
  search_nodes("architecture_decision")    → past decisions that constrain this task
  search_nodes("bug_resolution")           → known bugs to avoid repeating
  search_nodes("Pitfall")                  → recorded gotchas

You must call open_nodes on every entity returned — search_nodes only returns names, not content.
The KG contains version-specific patterns, breaking change warnings, and project-specific pitfalls
that WILL cause bugs if you skip this step.

STEP 3 — EXTERNAL DOCS (in parallel with step 2 results)
  Context7: resolve-library-id("<package>") → query-docs(id, topic: "<specific topic>")
  WebSearch: "<library> <version> <topic> docs"

STEP 4 — YOUR PLAN MUST COVER:
  - Edge cases — empty inputs, max limits, concurrent access, network failures
  - Error paths — every external call (API, DB, file I/O) needs a failure mode
  - Breaking changes — flag any changed exports, DB schema changes, or API contract changes
  - KG findings — reference specific pitfalls, vendor doc observations, or bug resolutions
  - Verification — how to confirm the implementation works end-to-end

Do NOT finalize the plan until steps 1-3 are complete. A plan without KG research is incomplete.`)
}

if (tool_name === 'ExitPlanMode') {
  const kgReads = read('kg-reads')
  const warning = kgReads
    ? ''
    : '\n\nWARNING: No KG reads detected this session. Did you skip search_nodes/open_nodes? Go back and complete research before presenting.'
  inject('PreToolUse', `Before presenting: re-read the user's original request. Does the plan address everything they asked for? If not, update it.${warning}`)
}

if (tool_name === 'Task') {
  inject('PreToolUse', `Before delegating, you MUST include in the task prompt:

1. VENDOR DOC CONTENT — run search_nodes + open_nodes for every library the subagent will touch,
   then paste the relevant observations directly into the task prompt. Subagents CANNOT access the KG.

2. KNOWN PITFALLS — paste any "Pitfall:" observations verbatim. Don't summarize — the exact wording matters.

3. ARCHITECTURE DECISIONS — paste any architecture_decision observations that constrain the approach.

If you haven't loaded KG content yet, do it NOW before creating this task.
A subagent working without vendor docs will write incorrect code.`)
}

pass()
