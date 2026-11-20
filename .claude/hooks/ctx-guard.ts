// version: 1.3.0
// Applies the graph-first lookup policy to the context-mode sandbox.
// The sandbox runs the same shell as the Bash tool, so a grep on source reaches the model
// through a path that bash-guard never sees. A script in another language gets its own check.
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'
import {
  cwdHint,
  GRAPH_DEGRADED,
  graphPolicyViolation,
  graphUnavailableReason,
  sandboxFileViolation,
  sandboxReadViolation,
} from './core/graph-policy.ts'
import type { HookInput } from './core/hook-types.ts'

const input = JSON.parse(await readStdin()) as HookInput
const toolInput = input.tool_input ?? {}

const SHELL = new Set(['bash', 'sh', 'shell', 'zsh'])

// ctx_execute carries one command. ctx_batch_execute carries a list.
const commands: string[] = []
let script = ''
const batch = toolInput.commands
if (Array.isArray(batch)) {
  for (const entry of batch) {
    const command = (entry as { command?: unknown })?.command
    if (typeof command === 'string') commands.push(command)
  }
} else if (typeof toolInput.code === 'string') {
  if (SHELL.has(String(toolInput.language ?? '').toLowerCase())) commands.push(toolInput.code)
  else script = toolInput.code
}

// The sandbox reports no working directory, so fall back to the hook's own cwd.
const graphDown = graphUnavailableReason()
const violations = [
  ...commands.map((command) =>
    graphPolicyViolation(command, cwdHint(command) || (input.cwd ?? '')),
  ),
  sandboxReadViolation(script, input.cwd ?? ''),
  sandboxFileViolation(
    typeof toolInput.path === 'string' ? toolInput.path : '',
    script || commands.join('\n'),
    input.cwd ?? '',
  ),
]
const violation = violations.find((entry) => entry !== null)
if (violation) {
  if (graphDown) inject('PreToolUse', `${GRAPH_DEGRADED} ${graphDown}`)
  deny('PreToolUse', `${violation} (core/mcp-tools § Code discovery)`)
}

pass()
