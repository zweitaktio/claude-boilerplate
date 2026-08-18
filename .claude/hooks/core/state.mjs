import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  statSync,
  appendFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// CLAUDE_CODE_SESSION_ID is the variable Claude Code actually sets; CLAUDE_SESSION_ID never
// resolved, so every hook silently fell back to ppid. That works only because run.sh execs,
// making ppid the stable claude process — keep it as the last resort, not the primary key.
const sessionId =
  process.env.CLAUDE_CODE_SESSION_ID ?? process.env.CLAUDE_SESSION_ID ?? process.ppid ?? 'unknown'

export function statePath(name) {
  return join(tmpdir(), `claude-${name}-${sessionId}`)
}

export function read(name, fallback = null) {
  const p = statePath(name)
  return existsSync(p) ? readFileSync(p, 'utf8').trim() : fallback
}

export function write(name, value) {
  writeFileSync(statePath(name), String(value))
}

export function append(name, line) {
  appendFileSync(statePath(name), line + '\n')
}

export function clear(name) {
  try {
    unlinkSync(statePath(name))
  } catch {}
}

export function ageSeconds(name) {
  const p = statePath(name)
  if (!existsSync(p)) return Infinity
  return (Date.now() - statSync(p).mtimeMs) / 1000
}

export function readLines(name) {
  const content = read(name)
  return content ? content.split('\n').filter(Boolean) : []
}

export function hasLine(name, line) {
  return readLines(name).includes(line)
}
