// version: 3.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read, write, clear, append, hasLine } from './core/state.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

// --- Track KG writes: reset edit counter ---
if (tool_name === 'mcp__memory__create_entities' || tool_name === 'mcp__memory__add_observations' || tool_name === 'mcp__memory__create_relations') {
  clear('kg-edits')
  clear('kg-files')
  pass()
}

// --- Only process Edit|Write from here ---
if (tool_name !== 'Edit' && tool_name !== 'Write') pass()
if (!tool_input) pass()

const file = tool_input?.file_path ?? ''

// Skip non-code files and infrastructure
if (/\.(md|json|yml|yaml|toml|txt|lock|css|scss)$/.test(file) || file.includes('.env')) pass()
if (file.includes('.claude/hooks/') || file.includes('.claude/rules/') || file.includes('scripts/')) pass()

// Skip if already tracked this cycle
if (hasLine('kg-files', file)) pass()

// Record file and increment counter
append('kg-files', file)
const count = parseInt(read('kg-edits', '0'), 10) + 1
write('kg-edits', count.toString())

// PostToolUse: remind about KG writes at 4+ edits
if (count >= 4) {
  inject('PostToolUse', `You have edited ${count} code files without a KG write. Check:
- Resolved a non-trivial bug? -> create_entities type bug_resolution
- Found a pitfall? -> create_entities type bug_resolution, link to vendor via depends_on
- Chose one approach over another? -> create_entities type architecture_decision
- Created an entity? -> create_relations to link it to related entities
Record now, not later — within 2 tool calls of discovery.
(core/process/mcp-tools.md § KG write triggers)`)
}

pass()
