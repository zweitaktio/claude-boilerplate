// version: 1.0.0
// Applies the graph-first lookup policy to the context-mode sandbox.
// The sandbox runs the same shell as the Bash tool, so a grep on source reaches the model
// through a path that bash-guard never sees.
import { readStdin } from './core/stdin.mjs'
import { deny, pass } from './core/output.mjs'
import { cwdHint, graphPolicyViolation } from './core/graph-policy.ts'
import type { HookInput } from './core/hook-types.ts'

const input = JSON.parse(await readStdin()) as HookInput
const toolInput = input.tool_input ?? {}

const SHELL = new Set(['bash', 'sh', 'shell', 'zsh'])

// ctx_execute carries one command. ctx_batch_execute carries a list.
const commands: string[] = []
const batch = toolInput.commands
if (Array.isArray(batch)) {
  for (const entry of batch) {
    const command = (entry as { command?: unknown })?.command
    if (typeof command === 'string') commands.push(command)
  }
} else if (
  SHELL.has(String(toolInput.language ?? '').toLowerCase()) &&
  typeof toolInput.code === 'string'
) {
  commands.push(toolInput.code)
}

// The sandbox reports no working directory, so fall back to the hook's own cwd.
for (const command of commands) {
  const violation = graphPolicyViolation(command, cwdHint(command) || (input.cwd ?? ''))
  if (violation) deny('PreToolUse', `${violation} (core/mcp-tools § Code discovery)`)
}

pass()
