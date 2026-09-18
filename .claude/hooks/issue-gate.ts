// version: 1.0.0
// Points at the issue-tracking skill when you run a gh issue command.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { hasLine, append } from './core/state.mjs'
import type { HookInput } from './core/hook-types.ts'

const { tool_name, tool_input } = JSON.parse(await readStdin()) as HookInput
if (tool_name !== 'Bash') pass()

const command = tool_input?.command ?? ''
if (!/\bgh\s+issue\b/.test(command)) pass()

// A skill loads when Claude judges the description relevant, which is not deterministic. This hook
// names the skill at the one moment it certainly applies.
if (hasLine('issue-reminded', 'issue-gate')) pass()
append('issue-reminded', 'issue-gate')

inject(
  'PreToolUse',
  `ISSUE TRACKER — read the issue-tracking skill before you write or close an issue.\n` +
    `- Fix it now instead of filing it, unless the work is Complex. Complex means it touches more\n` +
    `  than 3 files, or it needs a decision you cannot make alone.\n` +
    `- An issue body carries Context, Scope (In and Out) and a Definition of Done.\n` +
    `- The Definition of Done is the acceptance criteria. Make every item testable.\n` +
    `- Close an issue only after you verify each item of its Definition of Done.`,
)
