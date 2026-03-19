// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

if (tool_name !== 'Bash') pass()

const command = (tool_input?.command ?? '').trim()

// Match dependency addition commands (not bare install/add with no package)
const addPatterns = [
  /^yarn\s+add\s+\S/,
  /^npm\s+install\s+\S/,
  /^npm\s+i\s+\S/,
  /^pnpm\s+add\s+\S/,
]

const isDepAdd = addPatterns.some(p => p.test(command))
if (!isDepAdd) pass()

// Extract package names (strip flags like -D, --save-dev, etc.)
const args = command.split(/\s+/).slice(2)
const packages = args.filter(a => !a.startsWith('-'))
const pkgList = packages.join(', ')

const reminders = [
  `New dependency added: ${pkgList}.`,
  '',
  'Post-install checklist:',
  '1. Check if a vendor doc exists for this package in the webstack skill (vendor/ directory). If so, verify the version matches the applies constraint.',
  '2. Run a security audit (yarn audit or npm audit) to check for known vulnerabilities.',
  '3. If this is a major library (UI, routing, state, backend), consider whether a new vendor doc template should be created.',
]

inject('PostToolUse', reminders.join('\n'))
