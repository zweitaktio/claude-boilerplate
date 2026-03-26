// version: 2.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read, write, clear, append, hasLine } from './core/state.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

// --- Track KG reads (search_nodes, open_nodes) ---
if (tool_name === 'mcp__memory__search_nodes' || tool_name === 'mcp__memory__open_nodes') {
  append('kg-reads', tool_name)
  pass()
}

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

// --- PreToolUse: block first code edit if KG was never read ---
const kgReads = read('kg-reads')
if (!kgReads) {
  inject('PreToolUse', `STOP — you are about to edit code without consulting the Knowledge Graph.

Before writing ANY code, you MUST run these searches:
1. search_nodes("domain: <domain>") — load vendor docs for libraries this code touches
2. search_nodes("<library name>") — targeted lookup for the specific library
3. open_nodes on ALL results — read the actual content, not just names

This is not optional. The KG contains version-specific patterns, pitfalls, and bug resolutions
that prevent you from writing incorrect code. Do this NOW, then retry the edit.
(core/process/mcp-tools.md § Library Doc Lookup)`)
}

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
- Found a pitfall? -> add_observations "Pitfall: {what} - {why}"
- Chose one approach over another? -> create_entities type architecture_decision
- Created an entity? -> create_relations to link it to the relevant VendorXxx entity
Record now, not later — within 2 tool calls of discovery.
(core/process/mcp-tools.md § KG write triggers)`)
}

pass()
