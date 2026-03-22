// version: 2.1.0
import { readStdin } from './core/stdin.mjs'
import { pass } from './core/output.mjs'
import { read, write, readLines, hasLine, append } from './core/state.mjs'
import { execSync } from 'child_process'

const input = JSON.parse(await readStdin())

// Prevent infinite loops — if we already forced a continue, let the agent stop
if (input.stop_hook_active) pass()

const msg = (input.last_assistant_message ?? '').toLowerCase()
if (!msg) pass()

// Only force continue once per session per reason
const forced = read('completion-gate-forced') ?? ''
const forcedReasons = new Set(forced.split(',').filter(Boolean))

const run = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim() } catch { return '' }
}

const warnings = []

// --- Check 1: Unfinished work markers ---
if (/(?:\/\/|\/\*|#|^|\s)(TODO|FIXME|HACK|XXX)\s*[:(\-]/mi.test(input.last_assistant_message)) {
  warnings.push('Unfinished markers (TODO/FIXME/HACK) detected in your response')
}

// --- Check 2: Incomplete work signals ---
const incompletePatterns = [
  /i wasn'?t able to/,
  /i couldn'?t (complete|finish|resolve)/,
  /i'?ll need to/,
  /i was unable to/,
  /this still needs/,
  /remains to be (done|fixed|implemented)/,
  /not yet (implemented|complete|working)/,
]
for (const pattern of incompletePatterns) {
  if (pattern.test(msg)) {
    warnings.push('Your response indicates work is incomplete')
    break
  }
}

// --- Check 3: Code review for multi-file changes ---
// This is the single source of truth for code review triggering.
// The TaskCompleted hooks (post-plan-review, post-feature-review) are removed
// to avoid duplication — this Stop hook covers all cases regardless of task usage.
if (!forcedReasons.has('review')) {
  const sessionFiles = new Set(readLines('session-edited-files'))
  const changed = run('git diff --name-only HEAD')
  if (changed) {
    const codeExts = /\.(ts|tsx|js|jsx|py|go|rs)$/
    const codeFiles = changed.split('\n').filter(f => codeExts.test(f) && sessionFiles.has(f))

    if (codeFiles.length >= 2) {
      const fileList = codeFiles.slice(0, 30).join('\n')
      const affectedDirs = [...new Set(codeFiles.map(f => f.replace(/\/[^/]*$/, '')))].slice(0, 10).join('\n')

      let review
      if (codeFiles.length < 3) {
        review = `${codeFiles.length} code files changed:\n${fileList}\n\n` +
          `Quick review checklist:\n` +
          `- Error handling: missing try/catch at system boundaries, unhandled promise rejections\n` +
          `- Type safety: any casts, missing null checks, unvalidated inputs\n` +
          `- SSR/hydration: if React components changed, verify no server/client mismatches\n` +
          `- Security: injection vectors, exposed secrets, auth bypasses\n` +
          `- Pattern consistency: does this follow existing patterns? Are there existing utilities that could replace new code?\n\n` +
          `Report findings inline — no separate document.`
      } else {
        review = `${codeFiles.length} code files modified across: ${affectedDirs}\n\n` +
          `Changed files:\n${fileList}\n\n` +
          `Run full post-implementation review:\n` +
          `1. Code review — security, logic errors, type safety, SSR/hydration, error handling, breaking changes to exports\n` +
          `2. Connected systems — modules importing from changed files, shared state/context, route wiring\n` +
          `3. Architecture — pattern consistency, reuse opportunities, unnecessary abstractions\n` +
          `4. Regression — signature compatibility at all call sites, removed/renamed exports\n` +
          `5. Tests — run unit and e2e suites, report failures\n` +
          `6. Summary — findings by severity (CRITICAL > HIGH > MEDIUM), test results, commit readiness\n\n` +
          `Report findings by severity. State whether the change is safe to commit.`
      }

      warnings.push(review)
    }
  }
}

if (warnings.length === 0) pass()

// Track which reasons we've forced for — avoid re-forcing the same check
const newReasons = new Set(forcedReasons)
if (warnings.some(w => w.includes('code files'))) newReasons.add('review')
if (warnings.some(w => w.includes('markers') || w.includes('incomplete'))) newReasons.add('quality')

// Don't force if all warnings are for reasons we've already forced
const hasNewReasons = [...newReasons].some(r => !forcedReasons.has(r))
if (!hasNewReasons) pass()

write('completion-gate-forced', [...newReasons].join(','))

const feedback = `Completion gate:\n${warnings.join('\n\n')}\n\n` +
  `Address the above, then you may stop.`

process.stderr.write(feedback)
process.exit(2)
