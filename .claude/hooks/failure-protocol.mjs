// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read, write, ageSeconds } from './core/state.mjs'

const { tool_name } = JSON.parse(await readStdin())

// Time-based decay: reset counter if last failure was >5 min ago
const age = ageSeconds('failure-count')
const prevCount = age > 300 ? 0 : parseInt(read('failure-count') ?? '0')
const count = prevCount + 1
write('failure-count', String(count))

if (count < 2) pass()

if (count === 2) {
  inject('PostToolUseFailure',
    `2 consecutive tool failures (last: ${tool_name}). Before retrying:\n` +
    `- Read the error message literally — does your diagnosis match what it actually says?\n` +
    `- Is the root cause where you think it is, or are you pattern-matching to expectations?\n` +
    `- Try the smallest possible change to isolate the issue.`
  )
}

inject('PostToolUseFailure',
  `${count} consecutive tool failures. STOP the current approach.\n\n` +
  `Failure protocol (engineering-discipline.md § Failure Protocol):\n` +
  `1. Document what was tried and what failed\n` +
  `2. Reassess — is the diagnosis correct? Is there a simpler explanation?\n` +
  `3. Try a fundamentally different approach\n` +
  `4. If stuck, ask the user for guidance\n\n` +
  `Do NOT retry the same approach again.`
)
