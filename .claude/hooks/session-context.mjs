// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { execSync } from 'child_process'

await readStdin()

// Skip if not in a git repo
try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' })
} catch {
  pass()
}

const run = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim() } catch { return '' }
}

const branch = run('git branch --show-current')
const recent = run('git log --oneline -5')
const status = run('git status --short')

if (!branch && !recent && !status) pass()

let context = '## Session context'
if (branch) context += `\nBranch: ${branch}`
if (recent) context += `\n\nRecent commits:\n${recent}`
if (status) context += `\n\nUncommitted changes:\n${status}`

inject('SessionStart', context)
