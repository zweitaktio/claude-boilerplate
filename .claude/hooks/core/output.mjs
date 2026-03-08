function respond(hookEventName, payload) {
  const output = { hookSpecificOutput: { hookEventName, ...payload } }
  process.stdout.write(JSON.stringify(output) + '\n')
}

export function deny(hookEvent, reason) {
  respond(hookEvent, { permissionDecision: 'deny', reason })
  process.exit(0)
}

export function inject(hookEvent, context) {
  respond(hookEvent, { additionalContext: context })
  process.exit(0)
}

export function pass() {
  process.exit(0)
}
