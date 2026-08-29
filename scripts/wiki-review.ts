#!/usr/bin/env node
// purpose: report which project wiki pages need a review, a rewrite, or retirement.
// Project knowledge decays. A pitfall gets fixed upstream, the code it scoped to
// moves, or two pages drift into saying the same thing. This finds those pages.
// core/knowledge-base § Review and retire defines what to do with each verdict.
//
// Usage: node wiki-review.ts [--json] [--age-days N] [--root DIR]
// Exit code is 0 always. This reports; a person decides.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const args = process.argv.slice(2)

function pick(flag: string): string | null {
  const i = args.indexOf(flag)
  return i >= 0 ? (args[i + 1] ?? null) : null
}

const asJson = args.includes('--json')
const AGE_DAYS = Number(pick('--age-days') ?? 180)
const ROOT = pick('--root') ?? process.cwd()
const WIKI = join(ROOT, '.claude/rules/project')

type Page = {
  file: string
  rel: string
  title: string | null
  type: string | null
  status: string
  created: string | null
  reviewed: string | null
  verified: string | null
  supersededBy: string | null
  tripTasks: string[]
  defect: string | null
  proof: string | null
  proofWaiver: string | null
  paths: string[]
  tags: string[]
  lines: number
  body: string
}
type Flag = [kind: string, why: string]

function walk(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (e.endsWith('.md')) out.push(p)
  }
  return out
}

function parse(file: string): Page {
  const text = readFileSync(file, 'utf8')
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text)
  const fm = m?.[1] ?? ''
  const body = m ? text.slice(m[0].length) : text
  const scalar = (k: string): string | null => {
    const r = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm)
    return r?.[1] ? r[1].trim().replace(/^["']|["']$/g, '') : null
  }
  const list = (k: string): string[] => {
    const inline = new RegExp(`^${k}:\\s*\\[(.*?)\\]`, 'm').exec(fm)
    if (inline?.[1] !== undefined) {
      return inline[1]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
    const block = new RegExp(`^${k}:\\s*\\n((?:[ \\t]*-[ \\t]*.*\\n?)+)`, 'm').exec(fm)
    if (block?.[1] === undefined) return []
    return block[1]
      .trim()
      .split('\n')
      .map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  return {
    file,
    rel: relative(ROOT, file),
    title: scalar('title'),
    type: scalar('type'),
    status: scalar('status') ?? 'active',
    created: scalar('created'),
    reviewed: scalar('last-reviewed'),
    verified: scalar('verified-against'),
    supersededBy: scalar('superseded-by'),
    tripTasks: [...list('trip-tasks'), ...(scalar('trip-task') ? [scalar('trip-task') as string] : [])],
    defect: scalar('defect'),
    proof: scalar('proof'),
    proofWaiver: scalar('proof-waiver'),
    paths: list('paths'),
    tags: list('tags'),
    lines: body.split('\n').length,
    body,
  }
}

// Turn one glob into a RegExp. Supports **, * and ?, which is what paths: uses.
function globToRe(g: string): RegExp {
  let re = ''
  for (let i = 0; i < g.length; i++) {
    const c = g[i]
    if (c === '*') {
      if (g[i + 1] === '*') {
        re += '.*'
        i++
        if (g[i + 1] === '/') i++
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else re += (c ?? '').replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

function repoFiles(dir: string, acc: string[] = [], base: string = ROOT): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const e of entries) {
    if (e === '.git' || e === 'node_modules') continue
    const p = join(dir, e)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) repoFiles(p, acc, base)
    else acc.push(relative(base, p))
  }
  return acc
}

const pages = walk(WIKI).map(parse)
if (!pages.length) {
  console.log(`No project wiki pages under ${relative(ROOT, WIKI)}/`)
  process.exit(0)
}

const files = repoFiles(ROOT)
const today = new Date()
const daysSince = (d: string | null): number | null =>
  d ? Math.floor((today.getTime() - new Date(d).getTime()) / 86400000) : null

// Installed package versions, for the verified-against check.
let deps: Record<string, string> = {}
const pkg = join(ROOT, 'package.json')
if (existsSync(pkg)) {
  try {
    const j = JSON.parse(readFileSync(pkg, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    deps = { ...j.dependencies, ...j.devDependencies }
  } catch {
    /* a malformed package.json is not this script's problem */
  }
}

const findings: Array<{ page: Page; flags: Flag[] }> = []
for (const p of pages) {
  const flags: Flag[] = []

  // 1. The code this page scopes to is gone. The strongest obsolescence signal.
  if (p.paths.length) {
    const res = p.paths.map(globToRe)
    const hit = files.some((f) => res.some((re) => re.test(f)))
    if (!hit) flags.push(['ORPHANED', `no file matches ${p.paths.join(', ')}`])
  } else {
    flags.push(['NO-PATHS', 'the page always loads and taxes every turn'])
  }

  // 2. The version it was verified against is behind what is installed.
  if (p.verified) {
    const at = p.verified.lastIndexOf('@')
    const name = at > 0 ? p.verified.slice(0, at) : p.verified
    const ver = at > 0 ? p.verified.slice(at + 1) : ''
    const installed = deps[name]
    if (installed && ver) {
      const majorOf = (v: string): number => Number(String(v).replace(/^\D*/, '').split('.')[0])
      if (majorOf(installed) > majorOf(ver)) {
        flags.push(['STALE-VERSION', `verified against ${p.verified}, installed is ${installed}`])
      }
    }
  }

  // 3. Nobody has looked at it in a long time.
  const age = daysSince(p.reviewed ?? p.created)
  if (age !== null && age > AGE_DAYS) {
    flags.push(['UNREVIEWED', `${age} days since ${p.reviewed ? 'last review' : 'creation'}`])
  }

  // 4. It outgrew the page cap and belongs in .claude/docs/.
  const cap = p.type === 'domain-map' ? 25 : 40
  if (p.lines > cap) flags.push(['OVERSIZED', `${p.lines} lines, cap is ${cap}`])

  // 5. A pitfall or decision claims to change behaviour, and nobody measured it.
  if ((p.type === 'pitfall' || p.type === 'decision') && !p.proofWaiver) {
    if (p.tripTasks.length === 0 || !p.defect) {
      flags.push(['NO-TRIP-TASK', 'no trip-tasks or defect, so the page cannot be measured'])
    } else if (p.tripTasks.length < 2) {
      flags.push(['ONE-TASK', 'only one trip-task. One task can leak the answer and hide a real effect'])
    } else if (!p.proof || /^unproven$/i.test(p.proof)) {
      flags.push(['UNPROVEN', 'has a trip-task, but nobody ran it. Run pitfall-eval.ts'])
    } else if (/none\s+(\d+)\/(\d+)[\s\S]*full\s+(\d+)\/(\d+)/.test(p.proof)) {
      const m = /none\s+(\d+)\/(\d+)[\s\S]*full\s+(\d+)\/(\d+)/.exec(p.proof)
      const noneRate = Number(m?.[1]) / Number(m?.[2])
      const fullRate = Number(m?.[3]) / Number(m?.[4])
      if (noneRate >= fullRate) {
        flags.push(['NO-EFFECT', `proof says none ${m?.[1]}/${m?.[2]} vs full ${m?.[3]}/${m?.[4]}`])
      }
    }
  }

  // 6. It claims to be superseded but names no successor.
  if (p.status === 'superseded' && !p.supersededBy) {
    flags.push(['DANGLING', 'status is superseded with no superseded-by'])
  }

  if (flags.length) findings.push({ page: p, flags })
}

// 6. Two pages that say the same thing. Every project page co-loads with any
// other whose glob also matches, so overlap here is real duplication.
const words = (t: string): string[] =>
  t
    .replace(/`[^`]*`/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
const shingle = (ws: string[], n = 4): Set<string> => {
  const s = new Set<string>()
  for (let i = 0; i + n <= ws.length; i++) s.add(ws.slice(i, i + n).join(' '))
  return s
}
const dupes: Array<{ jac: number; a: string; b: string }> = []
const sh = pages.map((p) => ({ p, s: shingle(words(p.body)) }))
for (let i = 0; i < sh.length; i++) {
  for (let j = i + 1; j < sh.length; j++) {
    const x = sh[i]
    const y = sh[j]
    if (!x || !y) continue
    let inter = 0
    for (const t of x.s) if (y.s.has(t)) inter++
    if (inter < 3) continue
    const jac = inter / (x.s.size + y.s.size - inter)
    if (jac >= 0.25) dupes.push({ jac, a: x.p.rel, b: y.p.rel })
  }
}

const verdict = (flags: Flag[]): string => {
  const k = flags.map((f) => f[0])
  if (k.includes('ORPHANED') || k.includes('STALE-VERSION') || k.includes('NO-EFFECT')) return 'RETIRE?'
  if (k.includes('DANGLING') || k.includes('NO-PATHS') || k.includes('NO-TRIP-TASK')) return 'FIX'
  if (k.includes('ONE-TASK')) return 'PROVE'
  if (k.includes('UNPROVEN')) return 'PROVE'
  return 'REVIEW'
}

if (asJson) {
  console.log(JSON.stringify({ pages: pages.length, findings, dupes }, null, 2))
  process.exit(0)
}

console.log(`Project wiki: ${pages.length} pages under ${relative(ROOT, WIKI)}/\n`)
if (!findings.length && !dupes.length) {
  console.log('Every page is scoped, sized, current and distinct. Nothing to do.')
  process.exit(0)
}
for (const { page, flags } of findings) {
  console.log(`${verdict(flags)}  ${page.rel}`)
  console.log(`        ${page.title ?? '(no title)'}`)
  for (const [k, why] of flags) console.log(`        - ${k}: ${why}`)
  console.log()
}
for (const d of dupes) {
  console.log(`MERGE   ${d.a}`)
  console.log(`        ${d.b}`)
  console.log(`        - DUPLICATE: ${(d.jac * 100).toFixed(0)}% shared prose\n`)
}
console.log('PROVE   — run `node .claude/scripts/pitfall-eval.ts --case <slug> --n 8`, then write proof:.')
console.log('RETIRE? — check the fix landed upstream, then set status: archived with a reason.')
console.log('MERGE   — see core/writing-rules § Never State One Instruction Twice.')
console.log('REVIEW  — re-verify the fact, then set last-reviewed to today.')
console.log('core/knowledge-base § Review and retire holds the full procedure.')
