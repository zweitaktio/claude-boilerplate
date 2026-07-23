// version: 1.2.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { write } from './core/state.mjs'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { dirname, basename, join } from 'path'

const input = JSON.parse(await readStdin())
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
  execSync(`${pm} run check`, { cwd: workspace, timeout: 120000, stdio: 'pipe' })
  write('last-check-result', 'pass')
} catch (err) {
  write('last-check-result', 'fail')
  const output = (err.stdout?.toString() || '') + (err.stderr?.toString() || '')
  inject('PostToolUse', `${pm} run check failed in ${basename(workspace)}/:\n\n${output}`)
}

pass()
