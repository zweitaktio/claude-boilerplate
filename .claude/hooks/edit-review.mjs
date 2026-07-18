// version: 1.0.0
// Non-blocking self-review nudge after each code edit. Forms a review loop:
// review the change → fix inline → the fix re-triggers this hook.
// Debounced per file so a burst of edits to one file reviews once, not per keystroke.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { write, ageSeconds } from './core/state.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())
if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''

// Production code only. Tests have their own guards (weakened-test check, test-companion);
// config/markdown/json don't need this review.
if (!/\.(ts|tsx|js|jsx|py|go|rs)$/.test(file) || /\.(test|spec)\./.test(file)) pass()

// Per-file debounce: rapid successive edits to the same file are one logical change.
const key = 'editreview-' + file.replace(/[^a-zA-Z0-9]/g, '_')
if (ageSeconds(key) < 45) pass()
write(key, '1')

inject('PostToolUse',
  'Self-review this change before moving on:\n' +
  '- Bug just introduced — off-by-one, null/undefined path, wrong operator, a missing await?\n' +
  '- An input or edge case it does not handle — empty, boundary, error return, concurrent call?\n' +
  '- A caller, import site, or integration this breaks — check consumers at the module boundary?\n' +
  '- Reinvention — is there an existing util or pattern that already does this?\n' +
  'Fix inline if you find something; otherwise continue. (code-review.md)')
