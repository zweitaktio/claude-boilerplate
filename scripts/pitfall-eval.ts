#!/usr/bin/env node
// purpose: measure whether a pitfall page changes behaviour, and whether a shorter
// version changes it as much. Each case runs three arms: none, full, and a variant.
// The `none` arm is what makes the result meaningful. A page that does not beat it
// is worth zero bytes. `references/pitfall-compression.md` holds the method.
//
// Usage:
//   node scripts/pitfall-eval.ts --list
//   node scripts/pitfall-eval.ts --case bash-subshell-counter-loss --n 5
//   node scripts/pitfall-eval.ts --all --n 5 --model claude-sonnet-5
//   node scripts/pitfall-eval.ts --case <id> --dry-run   # print the prompts, call nothing

import { readFileSync, existsSync, readdirSync, statSync, appendFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

const SELF = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
// --root points the run at another project. --spec supplies cases for pages that
// carry no trip-tasks yet, which is how a corpus gets sampled before it is edited.
const rootArg = process.argv.indexOf('--root')
const specArg = process.argv.indexOf('--spec')
const ROOT = rootArg >= 0 ? (process.argv[rootArg + 1] ?? SELF) : SELF
const SPEC = specArg >= 0 ? (process.argv[specArg + 1] ?? '') : join(SELF, 'scripts/pitfall-eval-cases.json')
const PITFALLS = join(ROOT, '.claude/rules/project/pitfalls')
const VARIANTS = join(SELF, 'scripts/pitfall-variants')

type Case = {
  id: string
  /** Tasks that trip the defect. Two or more: one task can leak the answer and hide a real effect. */
  tasks: string[]
  /** Matches the defect in the generated output. A match is a FAIL. */
  defect: string
  /** Regex flags for `defect`. Default 'm'. Use '' when the pattern anchors with ^. */
  defectFlags?: string
  /** Optional: the output must also contain this, or the run is void (off-task). */
  onTask?: string
}

const argv = process.argv.slice(2)
const flag = (name: string): string | null => {
  const i = argv.indexOf(name)
  return i >= 0 ? (argv[i + 1] ?? null) : null
}
const has = (name: string): boolean => argv.includes(name)

const N = Number(flag('--n') ?? 5)
const MODEL = flag('--model') ?? 'claude-sonnet-5'
const DRY = has('--dry-run')
const SAVE = has('--save')  // raw answers to scripts/pitfall-eval-runs.log, for diagnosis

// Cases come from the pages themselves. The page's own trip-task and defect are the
// source of truth, so nothing can drift from the page it describes. SPEC is an
// optional fallback for a repo whose pages predate the fields.
function casesFromPages(): Case[] {
  const out: Case[] = []
  const walkDir = (dir: string): string[] => {
    const acc: string[] = []
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return acc
    }
    for (const e of entries) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) acc.push(...walkDir(p))
      else if (e.endsWith('.md')) acc.push(p)
    }
    return acc
  }
  for (const file of walkDir(PITFALLS)) {
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(file, 'utf8'))?.[1] ?? ''
    const get = (k: string): string | null =>
      new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm)?.[1]?.trim().replace(/^["']|["']$/g, '') ?? null
    const list = (k: string): string[] => {
      const block = new RegExp(`^${k}:\\s*\\n((?:[ \\t]*-[ \\t]*.*\\n?)+)`, 'm').exec(fm)
      if (!block?.[1]) return []
      return block[1]
        .trim()
        .split('\n')
        .map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim().replace(/^["']|["']$/g, ''))
        .filter((s) => s.length > 0 && !/^TODO\b/.test(s))
    }
    const tasks = list('trip-tasks')
    const single = get('trip-task')
    if (single && !/^TODO\b/.test(single)) tasks.push(single)
    const defect = get('defect')
    if (tasks.length === 0 || !defect || /^TODO\b/.test(defect)) continue
    const id = file.slice(file.lastIndexOf('/') + 1, -3)
    out.push({
      id,
      tasks,
      defect,
      // `defect-flags: ""` is a deliberate empty string, and an empty string is
      // falsy. Test for null, or the override is dropped and 'm' leaks back in.
      ...(get('defect-flags') === null ? {} : { defectFlags: get('defect-flags') as string }),
      ...(get('on-task') === null ? {} : { onTask: get('on-task') as string }),
    })
  }
  return out
}

const fromPages = casesFromPages()
const fromSpec: Case[] = SPEC && existsSync(SPEC) ? (JSON.parse(readFileSync(SPEC, 'utf8')) as Case[]) : []
// A page-defined case wins over a spec entry with the same id.
const cases: Case[] = [
  ...fromPages,
  ...fromSpec.filter((s) => !fromPages.some((p) => p.id === s.id)),
]

function variantsFor(id: string): string[] {
  if (!existsSync(VARIANTS)) return []
  return readdirSync(VARIANTS)
    .filter((f) => f.startsWith(id + '.') && f.endsWith('.md'))
    .map((f) => f.slice(id.length + 1, -3))
}

function pageText(id: string, arm: string): string {
  if (arm === 'none') return ''
  const file =
    arm === 'full' ? join(PITFALLS, `${id}.md`) : join(VARIANTS, `${id}.${arm}.md`)
  const raw = readFileSync(file, 'utf8')
  // Strip frontmatter: the model sees the body, which is what auto-load injects.
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

// A rough token proxy. Absolute value does not matter; the ratio between arms does.
const tokens = (s: string): number => Math.ceil(s.length / 4)

// The eval must not inherit this repo's own hooks and rules. Without isolation a
// hook rewrites the answer and the run measures the harness, not the page.
// `--restricted` drops the code-running tools and ignores user, project and local
// settings. The empty cwd keeps CLAUDE.md and .claude/ out of reach.
const SANDBOX = mkdtempSync(join(tmpdir(), 'pitfall-eval-'))

function runOnce(task: string, page: string): string {
  const args = ['-p', task, '--model', MODEL, '--restricted']
  if (page) args.push('--append-system-prompt', page)
  try {
    return execFileSync('claude', args, {
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: SANDBOX,
    })
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string }
    return (e.stdout ?? '') + (e.stderr ?? '')
  }
}

type Result = {
  arm: string
  bytes: number
  tokens: number
  /** Pass count per task, in the order the page lists them. */
  perTask: number[]
  pass: number
  void_: number
  n: number
}

function evaluate(c: Case, arms: string[]): Result[] {
  const defect = new RegExp(c.defect, c.defectFlags ?? 'm')
  const onTask = c.onTask ? new RegExp(c.onTask, 'm') : null
  const out: Result[] = []
  for (const arm of arms) {
    const page = pageText(c.id, arm)
    const perTask: number[] = []
    let pass = 0
    let void_ = 0
    for (const [ti, task] of c.tasks.entries()) {
      let taskPass = 0
      for (let i = 0; i < N; i++) {
        const answer = runOnce(task, page)
        if (SAVE) {
          appendFileSync(
            join(SELF, 'scripts/pitfall-eval-runs.log'),
            `\n═══ ${c.id} | arm=${arm} | task=${ti + 1} | run=${i + 1}\n${answer}\n`,
          )
        }
        if (onTask && !onTask.test(answer)) {
          void_++
          continue
        }
        if (!defect.test(answer)) {
          taskPass++
          pass++
        }
      }
      perTask.push(taskPass)
    }
    out.push({
      arm,
      bytes: page.length,
      tokens: tokens(page),
      perTask,
      pass,
      void_,
      n: N * c.tasks.length,
    })
  }
  return out
}

if (has('--list')) {
  console.log(`${cases.length} cases, read from the pages' trip-task fields:\n`)
  for (const c of cases) {
    const v = variantsFor(c.id)
    console.log(`  ${c.id}`)
    console.log(`      arms: none, full${v.length ? ', ' + v.join(', ') : ''}`)
    console.log(`      tasks: ${c.tasks.length}${c.tasks.length < 2 ? '  <- needs a second task' : ''}`)
    for (const [i, task] of c.tasks.entries()) {
      console.log(`        ${i + 1}. ${task.slice(0, 84)}`)
    }
  }
  process.exit(0)
}

const selected = has('--all')
  ? cases
  : cases.filter((c) => c.id === flag('--case'))

if (!selected.length) {
  console.error('No case selected. Use --list, --case <id>, or --all.')
  process.exit(2)
}

for (const c of selected) {
  const arms = ['none', 'full', ...variantsFor(c.id)]

  if (DRY) {
    console.log(`\n═══ ${c.id}  (dry run, nothing called)`)
    console.log(`defect: /${c.defect}/`)
    for (const [i, task] of c.tasks.entries()) console.log(`task ${i + 1}: ${task}`)
    for (const arm of arms) {
      const p = pageText(c.id, arm)
      console.log(`  ${arm.padEnd(12)} ${String(p.length).padStart(5)} B  ~${tokens(p)} tok`)
    }
    continue
  }

  console.log(`\n═══ ${c.id}   model=${MODEL}  n=${N}`)
  const results = evaluate(c, arms)
  const full = results.find((r) => r.arm === 'full')
  const taskCols = c.tasks.map((_, i) => `t${i + 1}`.padStart(6)).join('')
  console.log(
    `${'arm'.padEnd(12)}${'bytes'.padStart(7)}${'~tok'.padStart(6)}${taskCols}${'total'.padStart(8)}${'void'.padStart(6)}  ${'vs full'}`,
  )
  for (const r of results) {
    const cols = r.perTask.map((p) => `${p}/${N}`.padStart(6)).join('')
    const rate = `${r.pass}/${r.n - r.void_ || r.n}`
    const saved =
      full && r.arm !== 'full' && full.tokens > 0
        ? `${Math.round((1 - r.tokens / full.tokens) * 100)}% fewer tokens`
        : ''
    console.log(
      `${r.arm.padEnd(12)}${String(r.bytes).padStart(7)}${String(r.tokens).padStart(6)}${cols}${rate.padStart(8)}${String(r.void_).padStart(6)}  ${saved}`,
    )
  }
  // A task that passes without the page while a sibling fails is the leak signature:
  // it names the trap, so the answer needs no page. core/knowledge-base § What a trip-task must be.
  const noneArm = results.find((r) => r.arm === 'none')
  if (noneArm && c.tasks.length > 1) {
    const perfect = noneArm.perTask.map((p, i) => (p === N ? i + 1 : 0)).filter(Boolean)
    if (perfect.length > 0 && perfect.length < c.tasks.length) {
      console.log(
        `\n  LEAK CHECK: task ${perfect.join(', ')} passed without the page while another failed.`,
      )
      console.log('  Re-read it: a task that names the trap cannot measure whether the page teaches it.')
    }
  }
  const none = results.find((r) => r.arm === 'none')
  if (none && full && none.pass >= full.pass) {
    console.log(
      `\n  DELETION CANDIDATE: the page did not beat no-page (${none.pass} vs ${full.pass}).`,
    )
    console.log('  Compressing a page that changes nothing saves nothing. See core/knowledge-base.')
  }
}
