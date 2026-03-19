// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''
const content = tool_name === 'Write' ? (tool_input?.content ?? '') : (tool_input?.new_string ?? '')
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

// Inject accumulated warnings
if (warnings.length) {
  inject('PreToolUse', warnings.join('\n\n'))
}
pass()
