#!/usr/bin/env node
// purpose: report Simplified Technical English violations in rule templates.
// core/interaction § Scope puts rule files inside the STE rule. This checks the
// three violations a machine can see: arrow chains, hedges, and long sentences.
// Run `node scripts/ste-check.ts` to list them, `--count` for totals only.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

// All three review tools take the same --root flag, so they can be pointed at a
// target project from the skill checkout.
function pickRoot(envVar: string): string {
  const i = process.argv.indexOf('--root')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1] as string
  return process.env[envVar] ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '')
}

// Two layouts. In the webstack skill repository the templates live in core/ and
// vendor/. In a target project they are deployed under .claude/rules/, where only
// project/ is yours to edit. Detect which one we are in.
const ROOT = pickRoot('STE_ROOT')
const IS_SKILL_REPO = existsSync(join(ROOT, 'manifest.json')) && existsSync(join(ROOT, 'core'))
const DIRS = IS_SKILL_REPO
  ? ['core', 'vendor', '.claude/rules', 'agents']
  : ['.claude/rules/project']
const FILES = IS_SKILL_REPO ? ['references/bootstrap-template.md'] : []

const ARROW = /(→|(?<![-<=])->(?!>)|=>)/
const HEDGE =
  /\b(basically|under the hood|it seems|seems like|probably|perhaps|arguably|somewhat|a bit of|kind of|sort of|fairly|pretty much|more or less|to some extent|might be|could be|tends to|generally speaking)\b/i
const MAX_WORDS = 25

// Rule 11 candidates. This list gates nothing: the rule is a deletion test, not a
// word ban. "just" meaning "only" earns its place; "simply" that softens does not.
// `--filler` lists candidates for a human to judge. `always` and `never` are
// excluded, because a rule needs them.
const FILLER =
  /\b(simply|just|actually|really|very|quite|essentially|basically|literally|truly|certainly|definitely|clearly|obviously|naturally|indeed|particularly|especially|extremely|highly|slightly|relatively|typically|usually|often|normally|generally|commonly|frequently|occasionally|sometimes|easily|properly|appropriately|effectively|efficiently)\b/gi

// A line that quotes a violation on purpose. The rule needs the example.
const ALLOW = /ste-check-ignore/

type Kind = 'arrow' | 'hedge' | 'long'
type Finding = { file: string; line: number; kind: string; text: string }
type FillerHit = { file: string; line: number; word: string; text: string }

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
    const st = statSync(join(ROOT, rel))
    if (st.isDirectory()) out.push(...walk(rel))
    else if (e.endsWith('.md')) out.push(rel)
  }
  return out
}

// Yield prose lines only. Frontmatter, fences, tables and headings are exempt.
function prose(text: string): Array<[number, string]> {
  const out: Array<[number, string]> = []
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
    if (inFence || !s || s.startsWith('|') || s.startsWith('#')) continue
    out.push([i + 1, s])
  }
  return out
}

const targets = [...DIRS.flatMap(walk), ...FILES]
const findings: Finding[] = []
const fillerHits: FillerHit[] = []

for (const file of targets) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  for (const [line, raw] of prose(text)) {
    if (ALLOW.test(raw)) continue
    const clean = raw.replace(/`[^`]*`/g, 'X')
    for (const m of clean.matchAll(FILLER)) {
      fillerHits.push({ file, line, word: m[0].toLowerCase(), text: raw })
    }
    if (ARROW.test(clean)) findings.push({ file, line, kind: 'arrow', text: raw })
    if (HEDGE.test(clean)) findings.push({ file, line, kind: 'hedge', text: raw })
    const body = clean.replace(/^[-*\d.>[\] ]+/, '')
    for (const sent of body.split(/(?<=[.!?])\s+/)) {
      const words = sent.split(/\s+/).filter(Boolean).length
      if (words > MAX_WORDS) {
        findings.push({ file, line, kind: `long(${words}w)`, text: raw })
        break
      }
    }
  }
}

const countOnly = process.argv.includes('--count')
const totals: Record<Kind, number> = { arrow: 0, hedge: 0, long: 0 }
for (const f of findings) {
  const k: Kind = f.kind.startsWith('long') ? 'long' : (f.kind as Kind)
  totals[k]++
}

if (!countOnly) {
  for (const f of findings) {
    console.log(`${relative('.', f.file)}:${f.line}  ${f.kind}  ${f.text.slice(0, 110)}`)
  }
  if (findings.length) console.log('')
}

console.log(
  `STE: ${findings.length} violations across ${targets.length} files ` +
    `(arrows=${totals.arrow} hedges=${totals.hedge} long=${totals.long})`,
)
console.log('Mark a deliberate quoted example with an ste-check-ignore comment.')

// Rule 11 is a judgment call, so it advises and never gates.
if (process.argv.includes('--filler')) {
  console.log(`\nRule 11 candidates (${fillerHits.length}) — apply the deletion test to each:`)
  console.log('Delete the word. Re-read the sentence. Keep it only if the meaning changed.\n')
  for (const h of fillerHits) {
    console.log(`${h.file}:${h.line}  [${h.word}]  ${h.text.slice(0, 100)}`)
  }
} else {
  console.log(`Rule 11: ${fillerHits.length} candidates. Run --filler to review them.`)
}

process.exit(findings.length > 0 ? 1 : 0)
