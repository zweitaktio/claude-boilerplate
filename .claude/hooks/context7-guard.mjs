// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { write, ageSeconds } from './core/state.mjs'

const { tool_name } = JSON.parse(await readStdin())

// PostToolUse: resolve-library-id was called, record timestamp
if (tool_name === 'mcp__context7__resolve-library-id') {
  write('c7-resolved', Date.now().toString())
  pass()
}

// PreToolUse: query-docs, check if resolve was called recently
if (tool_name === 'mcp__context7__query-docs') {
  if (ageSeconds('c7-resolved') > 600) {
    inject('PreToolUse', `ALWAYS call resolve-library-id before query-docs — you need the exact library ID.
Do not guess or reuse IDs from previous sessions.
(core/process/mcp-tools.md § Context7 tool rules)`)
  }
}

pass()
