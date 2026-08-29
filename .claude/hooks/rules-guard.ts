// version: 1.1.0
// Write-time quality gate for .claude/rules/**: frontmatter, non-empty paths:, upstream-edit warning, bloat.
// Mirrors code-guard's inline approach so it needs no deployed script. Full lint
// (collisions, orphans, links) runs via scripts/wiki.sh in CI/maintenance.
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'
import type { HookInput } from './core/hook-types.ts'

const { tool_name, tool_input } = JSON.parse(await readStdin()) as HookInput
if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''
if (!file.includes('.claude/rules/')) pass()

const content = tool_name === 'Write' ? (tool_input?.content ?? '') : (tool_input?.new_string ?? '')
const warnings: string[] = []
const warn = (m: string): void => {
  warnings.push(m)
}

// --- upstream-owned rules: edits here are lost on /webstack update ---
if (/\.claude\/rules\/(core|vendor)\//.test(file)) {
  warn(
    `This file is upstream-owned (${file.replace(/.*\.claude\/rules\//, '.claude/rules/')}). ` +
      `Changes will be overwritten on the next /webstack update. Edit the boilerplate template and re-deploy, ` +
      `or put project-specific knowledge in .claude/rules/project/. (knowledge-base.md)`,
  )
}

// --- project pages: enforce the schema (strict on Write, where the whole file is present) ---
if (/\.claude\/rules\/project\//.test(file) && tool_name === 'Write') {
  const fm = frontmatter(content)

  if (/^generated:\s*true\s*$/m.test(fm ?? '')) pass() // tool-generated index/aggregate — skip

  if (fm === null) {
    deny(
      'PreToolUse',
      `A project knowledge page needs YAML frontmatter. Scaffold it with:\n` +
        `  .claude/scripts/wiki.sh new <pitfall|decision|convention|system|domain-map> <slug>\n` +
        `(knowledge-base.md § Frontmatter schema)`,
    )
  }

  if (!hasNonEmptyPaths(fm)) {
    deny(
      'PreToolUse',
      `This page has no non-empty \`paths:\`. Without it the page auto-loads on EVERY turn and taxes ` +
        `all context. Add the narrowest glob that should trigger it, e.g.\n` +
        `  paths:\n    - "**/services/meili/**"\n(knowledge-base.md § Atomicity)`,
    )
  }

  const type = (fm.match(/^type:\s*(\S+)/m) || [])[1]
  const TYPES = ['pitfall', 'decision', 'convention', 'system', 'domain-map', 'styleguide']
  if (!type || !TYPES.includes(type)) {
    warn(`type: "${type ?? ''}" is not one of ${TYPES.join(' | ')}. (knowledge-base.md)`)
  }

  // A pitfall or a decision claims to change behaviour. Measured: 2 of 3 existing
  // pitfalls changed nothing, because the model already knew them. The page must
  // name a task that trips it and a regex that catches the wrong answer.
  if (type === 'pitfall' || type === 'decision') {
    const hasField = (k: string): boolean => new RegExp(String.raw`^${k}:\s*\S`, 'm').test(fm)
    const isTodo = (k: string): boolean => new RegExp(String.raw`^${k}:\s*TODO\b`, 'm').test(fm)
    // Count real trip-tasks: a YAML list item that is not still a TODO placeholder.
    const taskBlock = /^trip-tasks:\s*\n((?:[ \t]*-[ \t]*.*\n?)+)/m.exec(fm)?.[1] ?? ''
    const tasks = taskBlock
      .split('\n')
      .map((l) =>
        l
          .replace(/^[ \t]*-[ \t]*/, '')
          .trim()
          .replaceAll(/^["']|["']$/g, ''),
      )
      .filter((s) => s.length > 0 && !/^TODO\b/.test(s))
    const missing: string[] = []
    if (tasks.length < 2) missing.push(`trip-tasks (found ${tasks.length}, need 2)`)
    if (!hasField('defect') || isTodo('defect')) missing.push('defect')
    if (missing.length > 0 && !hasField('proof-waiver')) {
      deny(
        'PreToolUse',
        `This ${type} page needs ${missing.join(' and ')} in its frontmatter.\n\n` +
          `  trip-tasks: TWO or more tasks. Each states the GOAL, never the trap.\n` +
          `             Leak test: delete the page, read the task — could a reader still\n` +
          `             avoid the defect because the TASK told them? Then it leaks.\n` +
          `  defect:    a regex matching the WRONG output (for a decision, the rejected approach)\n` +
          `  proof:     unproven — the review pass fills this in\n\n` +
          `Without them nobody can tell whether this page changes behaviour. Two of three pages ` +
          `measured here changed nothing: the model already knew the fact, and the page cost ` +
          `context for free.\n\n` +
          `If this page genuinely cannot be tested, say why:\n` +
          `  proof-waiver: <the reason no task can trip it>\n` +
          `(knowledge-base.md § Prove the page before you keep it)`,
      )
    }
  }

  for (const g of pathsGlobs(fm)) {
    if (['**', '**/*', '**/**', '*'].includes(g)) {
      warn(
        `glob "${g}" is effectively unbounded — reading any file injects this page. Scope it narrower.`,
      )
    }
  }

  const bodyLines = content.split('\n').length
  const budget = type === 'domain-map' ? 25 : 45
  if (bodyLines > budget) {
    warn(
      `page is ${bodyLines} lines (>${budget} for ${type || 'a rule'}). Keep atoms small; move long-form ` +
        `to a .claude/docs/ system doc that a domain map links to. (knowledge-base.md § Atomicity)`,
    )
  }

  warn(`After this write, run \`.claude/scripts/wiki.sh sync\` to refresh WIKI.md and backlinks.`)
}

// Single terminal emit — inject() ends the hook, so everything must go in one call.
if (warnings.length > 0) inject('PreToolUse', warnings.join('\n\n'))
pass()

// --- helpers ---
function frontmatter(text: string): string | null {
  const lines = text.split('\n')
  if ((lines[0] ?? '').trim() !== '---') return null
  const fm: string[] = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return fm.join('\n')
    fm.push(lines[i])
  }
  return null // unterminated frontmatter
}

function pathsGlobs(fm: string): string[] {
  const lines = fm.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^paths:\s*(.*)$/)
    if (!m) continue
    const inline = m[1].trim()
    if (inline.startsWith('[')) {
      for (const part of inline.replaceAll(/^\[|\]$/g, '').split(',')) {
        const v = part.trim().replaceAll(/^["']|["']$/g, '')
        if (v) out.push(v)
      }
    } else {
      for (let j = i + 1; j < lines.length; j++) {
        const item = lines[j].match(/^\s*-\s*(.+)$/)
        if (item) {
          out.push(item[1].trim().replaceAll(/^["']|["']$/g, ''))
          continue
        }
        if (/^\S/.test(lines[j])) break
      }
    }
    break
  }
  return out
}

function hasNonEmptyPaths(fm: string): boolean {
  return pathsGlobs(fm).length > 0
}
