// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read, write, clear, append, hasLine } from './core/state.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())
if (!tool_input && tool_name !== 'mcp__memory__create_entities' && tool_name !== 'mcp__memory__add_observations' && tool_name !== 'mcp__memory__create_relations') pass()

// KG write tools: reset counter
if (tool_name === 'mcp__memory__create_entities' || tool_name === 'mcp__memory__add_observations' || tool_name === 'mcp__memory__create_relations') {
  clear('kg-edits')
  clear('kg-files')
  pass()
}

// Edit|Write: track code files
const file = tool_input?.file_path ?? ''

// Skip non-code files
if (/\.(md|json|yml|yaml|toml|txt|lock|css|scss)$/.test(file) || file.includes('.env')) pass()

// Skip if already tracked this cycle
if (hasLine('kg-files', file)) pass()

// Record file and increment counter
append('kg-files', file)
const count = parseInt(read('kg-edits', '0'), 10) + 1
write('kg-edits', count.toString())

// Inject reminder at 4+ edits
if (count >= 4) {
  inject('PostToolUse', `You have edited ${count} code files without a KG write. Check:
- Resolved a non-trivial bug? -> create_entities type bug_resolution
- Found a pitfall? -> add_observations "Pitfall: {what} - {why}"
- Chose one approach over another? -> create_entities type architecture_decision
- Created an entity? -> create_relations to link it to the relevant VendorXxx entity
Record now, not later - within 2 tool calls of discovery.
(core/process/mcp-tools.md § KG write triggers)`)
}

pass()
