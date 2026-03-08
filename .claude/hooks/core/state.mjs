import { readFileSync, writeFileSync, unlinkSync, existsSync, statSync, appendFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const sessionId = process.env.CLAUDE_SESSION_ID ?? process.ppid ?? 'unknown'

export function statePath(name) {
  return join(tmpdir(), `claude-${name}-${sessionId}`)
}

export function read(name, fallback = null) {
  const p = statePath(name)
  return existsSync(p) ? readFileSync(p, 'utf-8').trim() : fallback
}

export function write(name, value) {
  writeFileSync(statePath(name), String(value))
}

export function append(name, line) {
  appendFileSync(statePath(name), line + '\n')
}

export function clear(name) {
  try { unlinkSync(statePath(name)) } catch {}
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
