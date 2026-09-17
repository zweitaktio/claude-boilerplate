// version: 1.0.0
// Blocks a commit when `fallow audit` fails on the staged workspaces; passes when fallow is absent.
import { readStdin } from './core/stdin.mjs'
import { deny, pass } from './core/output.mjs'
import type { HookInput } from './core/hook-types.ts'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const { tool_name, tool_input, cwd } = JSON.parse(await readStdin()) as HookInput

if (tool_name !== 'Bash') pass()

const command = tool_input?.command ?? ''
if (!/\bgit\s+commit\b/.test(command)) pass()

const root = cwd ?? process.cwd()

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: root, timeout: 10_000, stdio: 'pipe' }).toString()
}

let gitRoot: string
try {
  gitRoot = git('rev-parse --show-toplevel').trim()
} catch {
  pass()
}

// `git commit -a` stages tracked edits at commit time, so the index alone misses them.
const willStageAll = /\bgit\s+commit\s+(-[a-zA-Z]*a|--all)\b/.test(command)
let changed: string[] = []
try {
  const staged = git('diff --cached --name-only')
  const unstaged = willStageAll ? git('diff --name-only') : ''
  changed = `${staged}\n${unstaged}`.split('\n').filter(Boolean)
} catch {
  pass()
}

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss)$/
const code = changed.filter((f) => CODE.test(f))
if (code.length === 0) pass()

// Walk up to the nearest package.json that declares fallow. A project without fallow never gates.
function workspaceFor(file: string): string | null {
  let dir = dirname(join(gitRoot, file))
  while (dir.startsWith(gitRoot)) {
    const pkg = join(dir, 'package.json')
    if (existsSync(pkg)) {
      try {
        const manifest = JSON.parse(readFileSync(pkg, 'utf8'))
        const deps = { ...manifest.dependencies, ...manifest.devDependencies }
        if (deps.fallow) return dir
      } catch {}
    }
    if (dir === gitRoot) break
    dir = dirname(dir)
  }
  return null
}

const workspaces: string[] = []
for (const file of code) {
  const ws = workspaceFor(file)
  if (ws && !workspaces.includes(ws)) workspaces.push(ws)
}
if (workspaces.length === 0) pass()

type Attribution = Record<string, number>
const failures: string[] = []

// Three workspaces at 25 seconds each stay under the 90-second hook timeout. A warm audit costs
// about one second. A cold cache that exceeds the limit lets the commit through, because a slow
// tool must never block a correct change.
for (const ws of workspaces.slice(0, 3)) {
  try {
    execSync('npx --no fallow audit --format json --quiet', {
      cwd: ws,
      timeout: 25_000,
      stdio: 'pipe',
    })
  } catch (error) {
    const e = error as { status?: number; stdout?: Buffer }
    // Exit 1 is the fail verdict. Exit 2 is a fallow error and a missing binary exits otherwise.
    // Neither of those blocks a commit, because a broken tool is not a code defect.
    if (e.status !== 1) continue
    let detail = 'fail verdict'
    try {
      const report = JSON.parse(e.stdout?.toString() ?? '{}')
      const attribution = (report.attribution ?? {}) as Attribution
      const counts = Object.entries(attribution)
        .filter(([key, value]) => key.endsWith('_introduced') && value > 0)
        .map(([key, value]) => `${value} ${key.replace('_introduced', '').replace('_', ' ')}`)
      if (counts.length > 0) detail = `introduced ${counts.join(', ')}`
    } catch {}
    failures.push(`${relative(gitRoot, ws) || '.'}: ${detail}`)
  }
}

if (failures.length > 0) {
  deny(
    'PreToolUse',
    [
      `fallow audit failed — ${failures.join('; ')}.`,
      'Inspect it with `npx fallow audit --format json --quiet` in that workspace.',
      'Fix the finding before you commit.',
      'A correct and unfixable finding takes `// fallow-ignore-next-line <issue-type>` plus the reason.',
      '(core/code-change-gates § Deletion and dead code)',
    ].join('\n'),
  )
}

pass()
