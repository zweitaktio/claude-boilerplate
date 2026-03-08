import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_input } = JSON.parse(await readStdin())
const type = tool_input?.type ?? 'png'

if (type !== 'jpeg') {
  inject('PreToolUse', 'Set type: "jpeg" for screenshots — PNG is unnecessarily large.\n(core/process/mcp-tools.md § Playwright MCP)')
}

pass()
