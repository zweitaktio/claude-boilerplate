// version: 3.2.0
import { readStdin } from './core/stdin.mjs'
import { pass } from './core/output.mjs'
import { read, write, readLines } from './core/state.mjs'
import { execSync } from 'node:child_process'
import type { HookInput } from './core/hook-types.ts'

const input = JSON.parse(await readStdin()) as HookInput

// Prevent infinite loops — if we already forced a continue, let the agent stop
if (input.stop_hook_active) pass()

const message = input.last_assistant_message ?? ''
const msg = message.toLowerCase()
if (!msg) pass()

// Only force continue once per session per reason
const forced = read('completion-gate-forced') ?? ''
const forcedReasons = new Set(forced.split(',').filter(Boolean))

const run = (cmd: string): string => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return ''
  }
}

const warnings: string[] = []

// --- Check 0: Last check failed (any package manager) ---
if (!forcedReasons.has('verify')) {
  const lastCheck = read('last-check-result')
  if (lastCheck === 'fail') {
    warnings.push(
      'The last `check` (yarn/bun/pnpm/npm run check) failed. Fix errors before stopping.',
    )
  }
}

// --- Check 1: Unfinished work markers ---
if (/(?:\/\/|\/\*|#|^|\s)(TODO|FIXME|HACK|XXX)\s*[:(\-]/im.test(message)) {
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
if (!forcedReasons.has('review')) {
  const sessionFiles = new Set(readLines('session-edited-files'))
  const changed = run('git diff --name-only HEAD')
  if (changed) {
    const codeExts = /\.(ts|tsx|js|jsx|py|go|rs)$/
    const codeFiles = changed.split('\n').filter((f) => codeExts.test(f) && sessionFiles.has(f))

    if (codeFiles.length >= 2) {
      const fileList = codeFiles.slice(0, 30).join('\n')
      const affectedDirs = [...new Set(codeFiles.map((f) => f.replace(/\/[^/]*$/, '')))]
        .slice(0, 10)
        .join('\n')

      let review: string
      if (codeFiles.length < 3) {
        review =
          `${codeFiles.length} code files changed:\n${fileList}\n\n` +
          `Quick review checklist:\n` +
          `- Error handling: missing try/catch at system boundaries, unhandled promise rejections\n` +
          `- Type safety: any casts, missing null checks, unvalidated inputs\n` +
          `- SSR/hydration: if React components changed, verify no server/client mismatches\n` +
          `- Security: injection vectors, exposed secrets, auth bypasses\n` +
          `- Pattern consistency: does this follow existing patterns? Are there existing utilities that could replace new code?\n` +
          `- Behavior-change gates: every behavior change should carry an INTENT check (spec/test/code agree); every fixed defect a TWINS search for other sites.\n\n` +
          `Report findings inline — no separate document.`
      } else {
        review =
          `${codeFiles.length} code files modified across: ${affectedDirs}\n\n` +
          `Changed files:\n${fileList}\n\n` +
          `Run full post-implementation review:\n` +
          `1. Code review — security, logic errors, type safety, SSR/hydration, error handling, breaking changes to exports\n` +
          `2. Connected systems — modules importing from changed files, shared state/context, route wiring\n` +
          `3. Architecture — pattern consistency, reuse opportunities, unnecessary abstractions\n` +
          `4. Regression — signature compatibility at all call sites, removed/renamed exports\n` +
          `5. Tests — run unit and e2e suites, report failures\n` +
          `6. Behavior-change gates — every behavior change carries an INTENT check (spec/test/code agree); every fixed defect carries a TWINS search for other sites\n` +
          `7. Summary — findings by severity (CRITICAL > HIGH > MEDIUM), test results, commit readiness\n\n` +
          `Report findings by severity. State whether the change is safe to commit.`
      }

      warnings.push(review)
    }
  }
}

// --- Check 4: Knowledge recorded for substantial changes ---
// The KG failed because reminders got ignored mid-session; a Stop-time check is a stronger rung.
if (!forcedReasons.has('record')) {
  const sessionFiles = new Set(readLines('session-edited-files'))
  const changed = run('git diff --name-only HEAD')
  const codeFiles = changed
    ? changed
        .split('\n')
        .filter((f) => /\.(ts|tsx|js|jsx|py|go|rs)$/.test(f) && sessionFiles.has(f))
    : []
  // wiki-discipline sets 'wiki-written' when a page under .claude/rules/project or .claude/docs is written
  if (codeFiles.length >= 3 && read('wiki-written') === null) {
    warnings.push(
      `You changed ${codeFiles.length} code files but recorded no project knowledge this session. ` +
        `If you fixed a non-trivial bug, chose an approach over an alternative, or established a pattern, record it now:\n` +
        `  .claude/scripts/wiki.sh new <pitfall|decision|convention> <slug>\n` +
        `Scope it to the narrowest paths: glob so it auto-loads where it applies. (core/process/knowledge-base)\n` +
        `If nothing this session is worth recording, that's fine — stop.`,
    )
  }
}

if (warnings.length === 0) pass()

// Track which reasons we've forced for — avoid re-forcing the same check
const newReasons = new Set(forcedReasons)
if (warnings.some((w) => w.includes('Fix errors before stopping'))) newReasons.add('verify')
if (warnings.some((w) => w.includes('code files'))) newReasons.add('review')
if (warnings.some((w) => w.includes('markers') || w.includes('incomplete')))
  newReasons.add('quality')
if (warnings.some((w) => w.includes('recorded no project knowledge'))) newReasons.add('record')

// Don't force if all warnings are for reasons we've already forced
const hasNewReasons = [...newReasons].some((r) => !forcedReasons.has(r))
if (!hasNewReasons) pass()

write('completion-gate-forced', [...newReasons].join(','))

const feedback = `Completion gate:\n${warnings.join('\n\n')}\n\nAddress the above, then you may stop.`

process.stderr.write(feedback)
process.exit(2)
