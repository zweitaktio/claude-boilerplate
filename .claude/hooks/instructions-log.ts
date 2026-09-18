// version: 1.0.0
// Records every CLAUDE.md and .claude/rules/*.md load to a per-session log, for the context budget review.
import { readStdin } from './core/stdin.mjs'
import { append } from './core/state.mjs'
import { pass } from './core/output.mjs'
import type { HookInput } from './core/hook-types.ts'

const input = JSON.parse(await readStdin()) as HookInput

// InstructionsLoaded carries no decision control, so this hook only observes. A path-scoped rule
// that never appears in the log never reached the model. That absence is the measurement.
append(
  'instructions',
  JSON.stringify({
    at: new Date().toISOString(),
    file: input.file_path ?? '',
    scope: input.memory_type ?? '',
    reason: input.load_reason ?? '',
    globs: input.globs ?? [],
    trigger: input.trigger_file_path ?? '',
    parent: input.parent_file_path ?? '',
  }),
)

pass()
