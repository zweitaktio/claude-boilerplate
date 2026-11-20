function respond(hookEventName, payload) {
  const output = { hookSpecificOutput: { hookEventName, ...payload } }
  process.stdout.write(JSON.stringify(output) + '\n')
}

// Claude Code reads permissionDecisionReason. Any other key drops the text, and the model sees
// only "Blocked by hook" (https://code.claude.com/docs/en/hooks, PreToolUse decision control).
export function deny(hookEvent, reason) {
  respond(hookEvent, { permissionDecision: 'deny', permissionDecisionReason: reason })
  process.exit(0)
}

export function inject(hookEvent, context) {
  respond(hookEvent, { additionalContext: context })
  process.exit(0)
}

export function pass() {
  process.exit(0)
}
