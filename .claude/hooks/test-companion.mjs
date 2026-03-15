import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { hasLine, append } from './core/state.mjs'
import { existsSync } from 'fs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''

// Only act on TypeScript source files
if (!/\.(ts|tsx)$/.test(file)) pass()

// Skip test files themselves
if (/\.(test|spec)\.(ts|tsx)$/.test(file)) pass()

// Skip non-testable files: routes, types, config, locales, declarations
if (/\/(routes|types|config|locales|translations)\//.test(file)) pass()
if (/\.d\.ts$/.test(file)) pass()

// Skip index/barrel files
if (/\/index\.(ts|tsx)$/.test(file)) pass()

// Derive expected colocated test path: foo.ts → foo.test.ts, foo.tsx → foo.test.ts
const testPath = file.replace(/\.(tsx?)$/, '.test.ts')

// Avoid repeating the same reminder within a session
if (hasLine('test-companion-reminded', file)) pass()

if (!existsSync(testPath)) {
  append('test-companion-reminded', file)
  inject('PostToolUse', `No unit test found for ${file}. Expected: ${testPath}. Every pure function requires a unit test — tests must be .test.ts (never .test.tsx). (unit-testing.md)`)
}

pass()
