// version: 1.1.0
// Reminds you to record durable knowledge as a path-scoped wiki page after several code edits.
// Resets when you write a page under .claude/rules/project/. Replaces the old kg-discipline hook.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read, write, clear, append, hasLine } from './core/state.mjs'
import type { HookInput } from './core/hook-types.ts'

const { tool_name, tool_input } = JSON.parse(await readStdin()) as HookInput
if (tool_name !== 'Edit' && tool_name !== 'Write') pass()
if (!tool_input) pass()

const file = tool_input?.file_path ?? ''

// A wiki page was written → the discovery got recorded. Reset the counter and flag the session
// (completion-gate's Stop-time check reads 'wiki-written').
if (/\.claude\/rules\/project\//.test(file) || /\.claude\/docs\//.test(file)) {
  clear('wiki-edits')
  clear('wiki-files')
  write('wiki-written', '1')
  pass()
}

// Skip non-code files and infrastructure
if (/\.(md|json|yml|yaml|toml|txt|lock|css|scss)$/.test(file) || file.includes('.env')) pass()
if (file.includes('.claude/hooks/') || file.includes('.claude/rules/') || file.includes('scripts/'))
  pass()

// Skip if already counted this file this cycle
if (hasLine('wiki-files', file)) pass()

append('wiki-files', file)
const count = parseInt(read('wiki-edits', '0') ?? '0', 10) + 1
write('wiki-edits', count.toString())

if (count >= 4) {
  inject(
    'PostToolUse',
    `You have edited ${count} code files without recording knowledge. If you hit any of these, record it now — within ~2 tool calls, while it's fresh:
- A bug that misled you or spanned >3 files → .claude/scripts/wiki.sh new pitfall <slug>
- Chose one approach over another → .claude/scripts/wiki.sh new decision <slug>
- A repeating pattern to follow → .claude/scripts/wiki.sh new convention <slug>
Scope it to the narrowest paths: glob so it auto-loads exactly where it applies.
(core/process/knowledge-base.md § Writing)`,
  )
}

pass()
