#!/usr/bin/env node
// purpose: report near-duplicate prose between rule files that load together.
// core/writing-rules § Never State One Instruction Twice defines the rule.
// Two files share a loading context when one file can match both `paths:` globs.
// Duplication only costs there, so this reports only those pairs.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

// This script lives in <repo>/scripts/ here and in <project>/.claude/scripts/ once
// deployed. The deployed layout needs one extra level up. Without it the root is
// .claude/, the scan finds no rule file, and the tool reports a clean pass.
function derivedRoot(): string {
  const own = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
  const parent = dirname(own)
  return basename(parent) === '.claude' ? dirname(parent) : parent
}

// All three review tools take the same --root flag, so they can be pointed at a
// target project from the skill checkout.
function pickRoot(envVar: string): string {
  const i = process.argv.indexOf('--root')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1] as string
  return process.env[envVar] ?? derivedRoot()
}

const ROOT = pickRoot('DUPE_ROOT')
const IS_SKILL_REPO = existsSync(join(ROOT, 'manifest.json')) && existsSync(join(ROOT, 'core'))
// .claude/rules/project is always included: every project page co-loads with any
// other whose glob also matches. .claude/rules/*.md at the skill repo root is NOT
// — there it mirrors core/ on purpose, because core/ never loads in that repo.
const DIRS = IS_SKILL_REPO
  ? ['core', 'vendor', 'agents', '.claude/rules/project']
  : ['.claude/rules']
const FILES = IS_SKILL_REPO ? ['references/bootstrap-template.md'] : []
const THRESHOLD = Number(process.env.DUPE_THRESHOLD ?? 0.3)
const MIN_WORDS = 12

type Item = { file: string; line: number; globs: string[] | null; sh: Set<string>; body: string }

function walk(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(join(ROOT, dir))
  } catch {
    return out
  }
  for (const e of entries) {
    const rel = join(dir, e)
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel))
    else if (e.endsWith('.md')) out.push(rel)
  }
  return out
}

function frontmatter(text: string): string {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text)
  return m?.[1] ?? ''
}

// null means "no paths:", which is an always-loaded rule.
function pathsOf(text: string): string[] | null {
  const fm = frontmatter(text)
  const inline = /^paths:\s*\[(.*?)\]/m.exec(fm)
  if (inline?.[1] !== undefined) {
    return inline[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
  }
  const block = /^paths:\s*\n((?:[ \t]*-[ \t]*.*\n?)+)/m.exec(fm)
  if (block?.[1] !== undefined) {
    return block[1]
      .trim()
      .split('\n')
      .map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim().replace(/^["']|["']$/g, ''))
  }
  return null
}

// Always-loaded files share a context with everything. Otherwise a shared glob is
// the signal. This is deliberately conservative: it under-reports rather than
// flooding on files that only might co-load.
function coLoad(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) return true
  return a.some((g) => b.includes(g))
}

function blocks(text: string): Array<[number, string]> {
  const out: Array<[number, string]> = []
  let cur: string[] = []
  let start = 0
  let inFm = false
  let inFence = false
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const s = (lines[i] ?? '').trim()
    if (i === 0 && s === '---') {
      inFm = true
      continue
    }
    if (inFm) {
      if (s === '---') inFm = false
      continue
    }
    if (s.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (!s || s.startsWith('#') || s.startsWith('|')) {
      if (cur.length) out.push([start, cur.join(' ')])
      cur = []
      continue
    }
    if (!cur.length) start = i + 1
    cur.push(s)
  }
  if (cur.length) out.push([start, cur.join(' ')])
  return out
}

const words = (t: string): string[] =>
  t
    .replace(/`[^`]*`/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)

const shingles = (ws: string[], n = 4): Set<string> => {
  const s = new Set<string>()
  for (let i = 0; i + n <= ws.length; i++) s.add(ws.slice(i, i + n).join(' '))
  return s
}

const targets = [...DIRS.flatMap(walk), ...FILES]

// A scan over zero files is a failure to run, never a pass. Report the root that
// produced it, so a wrong root is visible instead of silent.
if (targets.length === 0) {
  console.error(`DUPES: no files to check under ${ROOT}`)
  console.error(`  searched: ${DIRS.join(', ')}`)
  console.error(`  Pass --root <project> or set DUPE_ROOT.`)
  process.exit(2)
}

const items: Item[] = []
for (const file of targets) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const globs = pathsOf(text)
  for (const [line, body] of blocks(text)) {
    const ws = words(body)
    if (ws.length < MIN_WORDS) continue
    items.push({ file, line, globs, sh: shingles(ws), body })
  }
}

const hits: Array<{ jac: number; a: Item; b: Item }> = []
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    const a = items[i]
    const b = items[j]
    if (!a || !b) continue
    if (a.file === b.file) continue
    if (!coLoad(a.globs, b.globs)) continue
    let inter = 0
    for (const s of a.sh) if (b.sh.has(s)) inter++
    if (inter < 3) continue
    const jac = inter / (a.sh.size + b.sh.size - inter)
    if (jac >= THRESHOLD) hits.push({ jac, a, b })
  }
}
hits.sort((x, y) => y.jac - x.jac)

for (const { jac, a, b } of hits) {
  console.log(`[${jac.toFixed(2)}] ${a.file}:${a.line}  <->  ${b.file}:${b.line}`)
  console.log(`      ${a.body.slice(0, 100)}`)
  console.log(`      ${b.body.slice(0, 100)}\n`)
}
console.log(
  `DUPES: ${hits.length} near-duplicate blocks between files that load together ` +
    `(threshold ${THRESHOLD}, ${targets.length} files) — root ${ROOT}`,
)
console.log('Merge, extract, or keep — see core/writing-rules § Never State One Instruction Twice.')

process.exit(hits.length > 0 ? 1 : 0)
