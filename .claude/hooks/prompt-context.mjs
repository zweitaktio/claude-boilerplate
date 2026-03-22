// version: 2.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { readLines } from './core/state.mjs'
import { execSync } from 'child_process'

const { prompt } = JSON.parse(await readStdin())
if (!prompt) pass()

const lower = prompt.toLowerCase().trim()

// --- "review" keyword: full code review on session-changed files ---
if (/^review\.?$/i.test(lower)) {
  const run = (cmd) => {
    try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim() } catch { return '' }
  }

  const sessionFiles = new Set(readLines('session-edited-files'))
  const changed = run('git diff --name-only HEAD')
  const codeExts = /\.(ts|tsx|js|jsx|mjs|py|go|rs|scala)$/
  const codeFiles = changed
    ? changed.split('\n').filter(f => codeExts.test(f) && sessionFiles.has(f))
    : []

  if (codeFiles.length === 0) {
    inject('UserPromptSubmit', 'No code files changed in this session to review.')
  }

  const fileList = codeFiles.slice(0, 30).join('\n')
  inject('UserPromptSubmit',
    `CODE REVIEW — ${codeFiles.length} files changed this session:\n${fileList}\n\n` +
    `Run a full review on these files. For each file, check:\n` +
    `1. Security — injection vectors, exposed secrets, auth bypasses, input validation at boundaries\n` +
    `2. Correctness — logic errors, edge cases, off-by-ones, null/undefined paths, error handling\n` +
    `3. Type safety — \`as\` casts suppressing real errors, \`any\` leaking, missing null checks\n` +
    `4. SSR/hydration — if React components: server/client mismatches, client-only code in render\n` +
    `5. Architecture — pattern consistency with existing code, reuse opportunities, unnecessary abstractions\n` +
    `6. Breaking changes — changed exports, modified function signatures, removed/renamed public APIs\n` +
    `7. Convention adherence — check against active rules (component patterns, i18n, testing, error responses)\n\n` +
    `Report findings by severity (CRITICAL > HIGH > MEDIUM). Skip LOW.\n` +
    `State whether the changes are safe to commit.`)
}

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
