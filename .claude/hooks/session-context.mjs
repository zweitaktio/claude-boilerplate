// version: 2.0.0
// Injects branch, recent commits, uncommitted changes and wiki counts at session start.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { execSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

await readStdin()

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? '.'
const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return ''
  }
}

// --- git context ---
let gitContext = ''
try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' })
  const branch = run('git branch --show-current')
  const recent = run('git log --oneline -5')
  const status = run('git status --short')
  if (branch) gitContext += `\nBranch: ${branch}`
  if (recent) gitContext += `\n\nRecent commits:\n${recent}`
  if (status) gitContext += `\n\nUncommitted changes:\n${status}`
} catch {
  /* not a git repo */
}

// --- project knowledge wiki summary (makes the wiki present at session start) ---
const countMd = (dir) => {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'index.md' && f !== 'INDEX.md')
      .length
  } catch {
    return 0
  }
}
const countDocs = (dir) => {
  try {
    let n = 0
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n += countMd(join(dir, e.name))
      else if (e.name.endsWith('.md') && e.name !== 'INDEX.md') n += 1
    }
    return n
  } catch {
    return 0
  }
}
let wikiContext = ''
const projRules = join(projectDir, '.claude', 'rules', 'project')
if (existsSync(projRules)) {
  const pit = countMd(join(projRules, 'pitfalls'))
  const con = countMd(join(projRules, 'conventions'))
  const dec = countMd(join(projRules, 'decisions'))
  const docs = countDocs(join(projectDir, '.claude', 'docs'))
  if (pit + con + dec + docs > 0) {
    wikiContext =
      `\n\n## Project knowledge wiki\n` +
      `${pit} pitfalls, ${con} conventions` +
      (dec ? `, ${dec} decisions` : '') +
      ` auto-load by path when you open matching files` +
      (docs ? `; ${docs} on-demand docs in .claude/docs/ (index: .claude/docs/INDEX.md)` : '') +
      `.\n` +
      `Relevant pitfalls arrive on their own when you read files — you don't query for them. ` +
      `For an unfamiliar area, run \`.claude/scripts/wiki.sh find "<topic>"\`. ` +
      `Record new bugs/decisions/patterns with \`.claude/scripts/wiki.sh new <type> <slug>\` (core/process/knowledge-base).`
  }
}

if (!gitContext && !wikiContext) pass()

inject('SessionStart', '## Session context' + gitContext + wikiContext)
