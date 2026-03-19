// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const input = JSON.parse(await readStdin())
const msg = input.last_assistant_message ?? ''
const agentType = input.agent_type ?? 'unknown'

if (!msg) {
  inject('SubagentStop',
    `${agentType} subagent returned an empty response. ` +
    `Re-run with a more specific prompt or investigate why it produced no output.`)
}

if (msg.length < 50) {
  inject('SubagentStop',
    `${agentType} subagent returned minimal output (${msg.length} chars). ` +
    `Verify the result is sufficient — re-run with a more specific prompt if needed.`)
}

const errorPatterns = [
  /\bcould not find\b/i,
  /\bno results?\b/i,
  /\bfailed to\b/i,
  /\berror:?\s/i,
  /\bunable to\b/i,
  /\bnot found\b/i,
  /\bdoes not exist\b/i,
]

const hasErrors = errorPatterns.some(p => p.test(msg))
if (hasErrors) {
  inject('SubagentStop',
    `${agentType} subagent reported potential issues in its response. ` +
    `Review the output carefully before relying on it — the subagent may not have found what you needed.`)
}

pass()
