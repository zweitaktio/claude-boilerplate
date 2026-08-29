// version: 1.4.0
// Content gate on writes (React.FC, default exports, .test.tsx, i18n, shell compat, comment length); tracks session-edited files for completion-gate.
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'
import { append, hasLine, read, write } from './core/state.mjs'
import type { HookInput } from './core/hook-types.ts'

const { tool_name, tool_input } = JSON.parse(await readStdin()) as HookInput

if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''
const content = tool_name === 'Write' ? (tool_input?.content ?? '') : (tool_input?.new_string ?? '')
const oldContent = tool_name === 'Edit' ? (tool_input?.old_string ?? '') : ''
const warnings: string[] = []

function block(msg: string): never {
  deny('PreToolUse', msg)
}
function warn(msg: string): void {
  warnings.push(msg)
}

// === Test files (.test.tsx / .spec.tsx — block) ===
if (/\.(test|spec)\.tsx$/.test(file)) {
  block('Tests must be .test.ts, never .test.tsx — no JSX in unit tests. (unit-testing.md)')
}

// === Test files (.test.ts / .spec.ts) ===
if (/\.(test|spec)\.ts$/.test(file)) {
  if (/@testing-library/.test(content)) {
    block(
      'No React component tests — no jsdom, no @testing-library. Use Playwright for UI testing. (unit-testing.md)',
    )
  }
  if (/\b(getByText|getByLabel)\b/.test(content)) {
    warn(
      'Avoid text-based selectors (getByText, getByLabel) — breaks on locale change. Use data-testid. (e2e-testing.md)',
    )
  }

  // Weakened-check detection (Edit only): a test loosened to pass is a fraud signal.
  if (tool_name === 'Edit' && oldContent) {
    const asserts = (s: string): number => (s.match(/\b(expect|assert)\s*\(/g) ?? []).length
    const isDisabled = (s: string): boolean =>
      /\b(it|test|describe)\.skip\b|\bx(it|describe)\b|\.only\b/.test(s)
    const isLoose = (s: string): boolean =>
      /\btoBe(Truthy|Falsy|Defined|GreaterThan|LessThan|CloseTo)\b|expect\.any\(/.test(s)
    const isMocked = (s: string): boolean =>
      /\b(vi|jest)\.mock\(|mockResolvedValue|mockReturnValue\b/.test(s)

    const isNowDisabled = isDisabled(content) && !isDisabled(oldContent)
    const isFewerAsserts = asserts(content) < asserts(oldContent)
    const isNowLoose = isLoose(content) && !isLoose(oldContent)
    const isNowMocked = isMocked(content) && !isMocked(oldContent)

    if (isNowDisabled || isFewerAsserts || isNowLoose || isNowMocked) {
      warn(
        'This edit weakens a test — assertions removed or loosened, a test skipped/narrowed to .only, or a real call replaced by a mock. A changed test is guilty until its justification traces to the spec: confirm the spec changed, not just the test. (code-review.md)',
      )
    }
  }
}

// === TSX / TS files ===
else if (/\.(tsx|ts)$/.test(file)) {
  if (/\bReact\.(FC|FunctionComponent)\b/.test(content)) {
    block('No React.FC — type props inline with function parameters. (react-components.md)')
  }
  if (/^\s*export\s+default\b/m.test(content) && !/\/routes\//.test(file)) {
    warn('Always use named exports. Exception: route components in routes/. (react-components.md)')
  }
  if (/t\(`/.test(content)) {
    warn('t() must use static string literals, not template literals. (i18n.md)')
  }
  if (/\bt\([A-Za-z_$]/.test(content)) {
    warn(
      "t() must use static string keys, not variables — parser can't extract dynamic keys. (i18n.md)",
    )
  }
  if (/\bt\(\s*'[^']*'\s*\)/.test(content) || /\bt\(\s*"[^"]*"\s*\)/.test(content)) {
    warn(
      "t() calls should include an English default as 2nd argument: t('key', 'Default text'). (i18n.md)",
    )
  }
}

// === Locale/translation JSON ===
else if (/\/locales\/.*\.json$/.test(file) || /\/translations\/.*\.json$/.test(file)) {
  block('Never edit JSON translation files directly — run yarn i18n:extract. (i18n.md)')
}

// === Shell scripts ===
else if (/\.sh$/.test(file)) {
  if (tool_name === 'Write' && !/^#!/m.test(content)) {
    warn('Shell script missing shebang line. Use #!/bin/bash. (scripting.md)')
  }
  if (/^#!\/usr\/bin\/env\s+bash/m.test(content)) {
    warn('Use #!/bin/bash (not #!/usr/bin/env bash). (scripting.md)')
  }
  if (/\bdeclare\s+-A\b/.test(content)) {
    block('declare -A (associative arrays) requires Bash 4+ — not on macOS 3.2. (scripting.md)')
  }
  if (/\b(readarray|mapfile)\b/.test(content)) {
    block('readarray/mapfile requires Bash 4+ — not on macOS 3.2. (scripting.md)')
  }
  if (/\bcoproc\b/.test(content)) {
    block('coproc requires Bash 4+ — not on macOS 3.2. (scripting.md)')
  }
  if (/\|\&/.test(content)) {
    warn('|& (pipe stderr) requires Bash 4+ — use 2>&1 | instead. (scripting.md)')
  }
  if (/\$\{[^}]+(,,|^^)\}/.test(content)) {
    block('${var,,}/${var^^} case conversion requires Bash 4+ — use tr instead. (scripting.md)')
  }
  if (/\breadlink\s+-f\b/.test(content)) {
    warn('readlink -f is GNU-only — use realpath or a manual loop on macOS. (scripting.md)')
  }
  if (/\bfind\s+.*-regex\b/.test(content)) {
    warn('find -regex uses GNU syntax — use -name or -path for portability. (scripting.md)')
  }
}

// === Comment length (code files) — warn ===
// Length is the only half a hook can measure. Whether a comment restates code the reader can already
// see needs judgment, so code-review.md § Comments carries that half. Warn, never block: a legitimate
// long comment exists (a licence header, a derivation), and a guard that fires wrongly gets ignored.
if (/\.(ts|tsx|js|jsx|mjs|cjs|go|rs)$/.test(file)) {
  const DIRECTIVE = /(eslint-|@ts-|ts-expect|biome-ignore|prettier-|oxlint-|istanbul |c8 |v8 )/
  const blocks = []
  let run = []
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*(?:\/\/|\*)\s?(.*)$/)
    if (m && !DIRECTIVE.test(line)) {
      run.push(m[1])
    } else {
      if (run.length > 0) blocks.push(run.join(' '))
      run = []
    }
  }
  if (run.length > 0) blocks.push(run.join(' '))

  const words = blocks.map((b) => b.split(/\s+/).filter(Boolean).length)
  const longest = words.length > 0 ? Math.max(...words) : 0

  // 75 = the 3-sentences × 25-words cap. Under it, no sentence split is needed, so no false positive
  // from a path or an abbreviation that contains a period.
  if (longest > 75) {
    warn(
      `A comment in this write runs ${longest} words. The cap is 3 sentences of at most 25 words each. Cut it to what the code cannot say, or move the explanation to a wiki page and let the comment carry the path. Write Simplified Technical English: a complete sentence, the active voice, and no metaphor. (code-review.md § Comment language and length)`,
    )
  }
}

// === Markdown — pass ===

// Track files edited in this session for completion-gate scoping
if (file && !hasLine('session-edited-files', file)) {
  append('session-edited-files', file)
}

// INTENT primer — once per session, on the first edit to existing (non-test) code.
// Non-blocking nudge to write the INTENT line before changing behavior.
if (
  tool_name === 'Edit' &&
  /\.(ts|tsx|js|jsx|py|go|rs)$/.test(file) &&
  !/\.(test|spec)\./.test(file) &&
  !read('intent-reminded')
) {
  write('intent-reminded', '1')
  warnings.push(
    'Changing what this code does? Write the INTENT line first — `INTENT: code does <X>; the check expects <Y>; the spec says <Z>` — and if they disagree, that contradiction is the finding, not a thing to silently edit away. (code-change-gates.md)',
  )
}

// Inject accumulated warnings
if (warnings.length > 0) {
  inject('PreToolUse', warnings.join('\n\n'))
}
pass()
