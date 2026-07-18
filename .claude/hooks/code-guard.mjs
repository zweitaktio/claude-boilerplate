// version: 1.2.1
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'
import { append, hasLine, read, write } from './core/state.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''
const content = tool_name === 'Write' ? (tool_input?.content ?? '') : (tool_input?.new_string ?? '')
const oldContent = tool_name === 'Edit' ? (tool_input?.old_string ?? '') : ''
const warnings = []

function block(msg) { deny('PreToolUse', msg) }
function warn(msg) { warnings.push(msg) }

// === Test files (.test.tsx / .spec.tsx — block) ===
if (/\.(test|spec)\.tsx$/.test(file)) {
  block('Tests must be .test.ts, never .test.tsx — no JSX in unit tests. (unit-testing.md)')
}

// === Test files (.test.ts / .spec.ts) ===
if (/\.(test|spec)\.ts$/.test(file)) {
  if (/@testing-library/.test(content)) {
    block('No React component tests — no jsdom, no @testing-library. Use Playwright for UI testing. (unit-testing.md)')
  }
  if (/\b(getByText|getByLabel)\b/.test(content)) {
    warn('Avoid text-based selectors (getByText, getByLabel) — breaks on locale change. Use data-testid. (e2e-testing.md)')
  }

  // Weakened-check detection (Edit only): a test loosened to pass is a fraud signal.
  if (tool_name === 'Edit' && oldContent) {
    const asserts = (s) => (s.match(/\b(expect|assert)\s*\(/g) || []).length
    const disables = (s) => /\b(it|test|describe)\.skip\b|\bx(it|describe)\b|\.only\b/.test(s)
    const loose = (s) => /\btoBe(Truthy|Falsy|Defined|GreaterThan|LessThan|CloseTo)\b|expect\.any\(/.test(s)
    const mocks = (s) => /\b(vi|jest)\.mock\(|mockResolvedValue|mockReturnValue\b/.test(s)

    const nowDisabled = disables(content) && !disables(oldContent)
    const fewerAsserts = asserts(content) < asserts(oldContent)
    const nowLoose = loose(content) && !loose(oldContent)
    const nowMocked = mocks(content) && !mocks(oldContent)

    if (nowDisabled || fewerAsserts || nowLoose || nowMocked) {
      warn('This edit weakens a test — assertions removed or loosened, a test skipped/narrowed to .only, or a real call replaced by a mock. A changed test is guilty until its justification traces to the spec: confirm the spec changed, not just the test. (code-review.md)')
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
    warn('t() must use static string keys, not variables — parser can\'t extract dynamic keys. (i18n.md)')
  }
  if (/\bt\(\s*'[^']*'\s*\)/.test(content) || /\bt\(\s*"[^"]*"\s*\)/.test(content)) {
    warn('t() calls should include an English default as 2nd argument: t(\'key\', \'Default text\'). (i18n.md)')
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

// === Markdown — pass ===

// Track files edited in this session for completion-gate scoping
if (file && !hasLine('session-edited-files', file)) {
  append('session-edited-files', file)
}

// INTENT primer — once per session, on the first edit to existing (non-test) code.
// Non-blocking nudge to write the INTENT line before changing behavior.
if (tool_name === 'Edit' && /\.(ts|tsx|js|jsx|py|go|rs)$/.test(file) && !/\.(test|spec)\./.test(file) && !read('intent-reminded')) {
  write('intent-reminded', '1')
  warnings.push('Changing what this code does? Write the INTENT line first — `INTENT: code does <X>; the check expects <Y>; the spec says <Z>` — and if they disagree, that contradiction is the finding, not a thing to silently edit away. (code-change-gates.md)')
}

// Inject accumulated warnings
if (warnings.length) {
  inject('PreToolUse', warnings.join('\n\n'))
}
pass()
