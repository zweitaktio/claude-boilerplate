// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { prompt } = JSON.parse(await readStdin())
if (!prompt) pass()

const lower = prompt.toLowerCase().trim()
const hints = []

// Vague / underspecified requests
const vaguePatterns = [
  /^fix (it|this|that)\.?$/,
  /^make (it|this|that) work\.?$/,
  /^(do|finish|complete) (it|this|that)\.?$/,
  /^improve (it|this|that|the code)\.?$/,
  /^(just )?handle (it|this|that)\.?$/,
  /^(can you )?(please )?(just )?(fix|do|finish|update|change) (it|this|that)\.?$/,
]
const isVague = lower.length < 15 || vaguePatterns.some(p => p.test(lower))
if (isVague) {
  hints.push(
    'This request is underspecified. Before acting, clarify with the user:\n' +
    '- What specifically needs to change?\n' +
    '- What is the expected behavior?\n' +
    '- What is currently wrong or missing?\n' +
    'Do not guess at requirements — ask.'
  )
}

// Dangerous operations
const dangerPatterns = [
  { pattern: /\b(delete all|remove all|drop (table|database|collection)|truncate)\b/, label: 'destructive data operation' },
  { pattern: /\b(force push|--force|push -f|git push.*-f)\b/, label: 'force push' },
  { pattern: /\brm -rf\b/, label: 'recursive force delete' },
  { pattern: /\b(deploy to|push to) production\b/, label: 'production deployment' },
  { pattern: /\b(reset --hard)\b/, label: 'hard reset' },
]
const dangers = dangerPatterns.filter(d => d.pattern.test(lower))
if (dangers.length > 0) {
  const ops = dangers.map(d => d.label).join(', ')
  hints.push(
    `Safety: this request involves ${ops}.\n` +
    `Before proceeding:\n` +
    `- Confirm the exact scope with the user (what gets affected?)\n` +
    `- Verify reversibility — can this be undone?\n` +
    `- Consider safer alternatives first`
  )
}

// Feature requests — nudge toward requirements engineering
const featurePattern = /\b(add|implement|build|create|introduce|set up|integrate)\b.*\b(feature|page|component|endpoint|api|form|modal|dialog|button|flow|system|service|module|hook|middleware|auth|login|signup|dashboard)\b/
if (!isVague && featurePattern.test(lower)) {
  hints.push(
    'This looks like a new feature. Before designing:\n' +
    '- Gather functional requirements (what it does, inputs, outputs, edge cases)\n' +
    '- Confirm scope boundaries (what is NOT included)\n' +
    '- Define acceptance criteria (how to verify it works)\n' +
    '(core/process/requirements-engineering.md)'
  )
}

if (hints.length === 0) pass()

inject('UserPromptSubmit', hints.join('\n\n'))
