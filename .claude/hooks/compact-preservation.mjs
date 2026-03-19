// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

await readStdin()

inject('PreCompact',
  `Preserve these in the compaction summary:\n` +
  `- Requirements gathered from the user (functional, non-functional, scope boundaries)\n` +
  `- Decisions made and their rationale (why approach A over B)\n` +
  `- Risks identified and mitigation choices\n` +
  `- Current task state (what is done, what is in progress, what is blocked)\n` +
  `- File paths modified and why each was changed\n` +
  `- Errors encountered and how they were resolved\n` +
  `- Key user preferences or constraints stated during the session`)
