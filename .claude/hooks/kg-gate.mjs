// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { pass } from './core/output.mjs'
import { write } from './core/state.mjs'

const { tool_name } = JSON.parse(await readStdin())

// PostToolUse: search_nodes was called, record it
if (tool_name === 'mcp__memory__search_nodes') {
  write('kg-queried', Date.now().toString())
}

pass()
