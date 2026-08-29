// version: 1.3.0
// Runs `yarn check` after a code edit, resolving the nearest workspace in a monorepo.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { write } from './core/state.mjs'
import type { HookInput } from './core/hook-types.ts'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, basename, join } from 'node:path'

const input = JSON.parse(await readStdin()) as HookInput
const file = input.tool_input?.file_path

if (!file) pass()

// Skip non-code files
const skipExts = ['.md', '.json', '.yml', '.yaml', '.toml', '.txt', '.lock', '.css', '.scss']
if (skipExts.some((ext) => file.endsWith(ext)) || file.includes('.env')) pass()

// Walk up to find nearest package.json with a "check" script
let dir = dirname(file)
let workspace = null
while (dir !== '/' && dir !== '.') {
  const pkg = join(dir, 'package.json')
  if (existsSync(pkg)) {
    try {
      const scripts = JSON.parse(readFileSync(pkg, 'utf8')).scripts || {}
      if (scripts.check) {
        workspace = dir
        break
      }
    } catch {}
  }
  dir = dirname(dir)
}

if (!workspace) pass()

// Detect the package manager from the workspace lockfile (skill targets yarn/bun/pnpm/npm projects)
const pm =
  existsSync(join(workspace, 'bun.lock')) || existsSync(join(workspace, 'bun.lockb'))
    ? 'bun'
    : existsSync(join(workspace, 'pnpm-lock.yaml'))
      ? 'pnpm'
      : existsSync(join(workspace, 'yarn.lock'))
        ? 'yarn'
        : existsSync(join(workspace, 'package-lock.json'))
          ? 'npm'
          : 'yarn' // default for legacy projects with no lockfile detected

try {
  execSync(`${pm} run check`, { cwd: workspace, timeout: 120_000, stdio: 'pipe' })
  write('last-check-result', 'pass')
} catch (error) {
  write('last-check-result', 'fail')
  // execSync throws an Error carrying the child's captured streams.
  const e = error as { stdout?: Buffer; stderr?: Buffer }
  const output = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
  inject('PostToolUse', `${pm} run check failed in ${basename(workspace)}/:\n\n${output}`)
}

pass()
