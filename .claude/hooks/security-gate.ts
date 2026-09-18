// version: 1.0.0
// Injects the security checklist when you write a server, API, auth or collection file.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { hasLine, append } from './core/state.mjs'
import type { HookInput } from './core/hook-types.ts'

const { tool_name, tool_input } = JSON.parse(await readStdin()) as HookInput
if (tool_name !== 'Write' && tool_name !== 'Edit') pass()

const file = tool_input?.file_path ?? ''

// A path-scoped rule triggers on a read, never on a write, so a new auth handler reaches no rule.
// This hook covers that moment. core/security-checklist still loads when you read such a file.
const SENSITIVE =
  /\/(server|api|routes|auth|middleware|collections)\/|\.server\.(ts|tsx|js)$|\/(login|session|token|password|permission)[^/]*\.(ts|tsx|js)$/i

if (!SENSITIVE.test(file)) pass()

// Once per file per session. A burst of edits to one route should not repeat the checklist.
const key = `security-gate:${file}`
if (hasLine('security-reminded', key)) pass()
append('security-reminded', key)

inject(
  'PreToolUse',
  `SECURITY CHECK — this file handles input, auth or external data:\n` +
    `- Validate every user input at the boundary. Use an allowlist, not a denylist.\n` +
    `- Check authorisation on the server for this exact action, not only authentication.\n` +
    `- Never put a session ID, a token or a secret in a URL, a log or a client bundle.\n` +
    `- Use the ORM or CMS API. Never build raw SQL from user input.\n` +
    `- Bound every list operation with pagination or an explicit limit.\n` +
    `- Rate-limit any endpoint that sends mail, writes money or accepts a credential.\n` +
    `(core/security-checklist holds the full list and loads when you read a file like this one.)`,
)
