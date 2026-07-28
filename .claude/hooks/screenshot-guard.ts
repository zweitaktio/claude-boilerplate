// version: 2.0.0
// Keeps browser artifacts small AND inside the configured output directory.
//
// DENIES a `filename` that is absolute, contains a path separator, or is a bare `.`/`..`,
// because playwright-mcp resolves it as path.resolve(outputDir, filename): an absolute path
// discards outputDir entirely and `../` climbs out of it. That is how screenshots end up
// loose in the repo working tree despite a correct --output-dir.
// Verified against playwright-mcp 0.0.78 (playwright-core/lib/coreBundle.js, outputFile()).
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'
import type { HookInput } from './core/hook-types.ts'

// Every playwright-mcp tool whose `filename` is resolved against outputDir.
const FILENAME_TOOLS = new Set([
  'mcp__playwright__browser_take_screenshot',
  'mcp__playwright__browser_pdf_save',
  'mcp__playwright__browser_storage_state',
])

const { tool_name, tool_input } = JSON.parse(await readStdin()) as HookInput

const filename = typeof tool_input?.filename === 'string' ? tool_input.filename.trim() : ''

// --- hard gate: the filename must be a bare basename ---
if (filename !== '' && (tool_name === undefined || FILENAME_TOOLS.has(tool_name))) {
  const isAbsolute = filename.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filename)
  const hasSeparator = filename.includes('/') || filename.includes('\\')
  const isDots = /^\.+$/.test(filename)

  if (isAbsolute || hasSeparator || isDots) {
    const suggestion = filename.split(/[\\/]/).findLast(Boolean) ?? ''
    deny(
      'PreToolUse',
      `filename must be a bare file name, not a path — got "${filename}".\n\n` +
        `playwright-mcp resolves it as path.resolve(outputDir, filename), so an absolute path ` +
        `replaces the output directory and "../" escapes it. The file would land outside ` +
        `.claude/screenshots and clutter the working tree.\n\n` +
        `Use: filename: "${isDots || suggestion === '' ? 'screenshot.jpeg' : suggestion}"\n` +
        `The output directory comes from --output-dir in .mcp.json; never override it per call.`,
    )
  }
}

// --- soft nudge: PNG screenshots are needlessly large in context ---
if (tool_name === undefined || tool_name === 'mcp__playwright__browser_take_screenshot') {
  const type = typeof tool_input?.type === 'string' ? tool_input.type : 'png'
  if (type !== 'jpeg') {
    inject(
      'PreToolUse',
      'Set type: "jpeg" for screenshots — PNG is unnecessarily large.\n(core/process/mcp-tools.md § Playwright MCP)',
    )
  }
}

pass()
