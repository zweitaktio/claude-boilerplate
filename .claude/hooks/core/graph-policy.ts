// Decides whether a shell command reads source code that the code graph should answer.
// bash-guard applies this policy to the Bash tool. ctx-guard applies it to the context-mode
// sandbox, which runs the same shell but never reaches the Bash hook.
import { read } from './state.mjs'

// The tool is trace_path. Verified against codebase-memory-mcp 0.10.8: `cli trace_call_path`
// answers "unknown tool". The package's own README names trace_call_path and is wrong.
export const GRAPH_TOOLS =
  'Use codebase-memory-mcp: search_graph (locate a symbol), trace_path (callers/callees), get_code_snippet (exact source), query_graph (multi-hop patterns), get_architecture (orientation).'

export const GRAPH_HATCH =
  'If the graph genuinely cannot answer it — literal strings, non-code files, uncovered paths — re-run the same command with `# graph-miss: <reason>` appended.'

export const GRAPH_SCOPE =
  'In a monorepo, pass file_pattern to search_graph so a name that exists in several workspaces returns only the one you own.'

// session-context.ts checks the graph preconditions at SessionStart and writes this flag when one
// fails. A session that cannot reach the graph must still read its own code, so each guard warns
// instead of denies while the flag is set.
export const GRAPH_STATE = 'graph-unavailable'

export const GRAPH_DEGRADED =
  'The code graph is unavailable this session, so this shell read is allowed. Keep it narrow, and name the graph failure in your answer:'

/** Returns the SessionStart failure reason, or null when every precondition holds. */
export function graphUnavailableReason(): string | null {
  return read(GRAPH_STATE)
}

// Workspace directories that hold source. The layout is project-specific, so a project
// overrides the list with WEBSTACK_CODE_DIRS as pipe-separated names. Entries are filtered
// to word characters, because the list is interpolated into a regular expression.
const CODE_DIRS = (process.env.WEBSTACK_CODE_DIRS ?? 'backend|frontend|services|apps|packages')
  .split('|')
  .map((part) => part.trim())
  .filter((part) => /^[\w.-]+$/.test(part))

const DIRS = CODE_DIRS.join('|')

const READERS = [
  { pattern: /(^|[;&]\s*)(grep|rg|ag|ack)\s/, reason: 'Text-searching source with grep/rg.' },
  {
    pattern: /(^|[;&]\s*)(cat|head|tail|less|more|bat)\s/,
    reason: 'Reading source through a shell pager.',
  },
  { pattern: /(^|[;&]\s*)sed\s+-n\b/, reason: 'Reading source line ranges with sed.' },
]

/** Returns a deny reason, or null when the command may run. */
export function graphPolicyViolation(command: string, cwd: string): string | null {
  if (command.length === 0) return null
  if (/#\s*graph-miss:\s*\S/.test(command)) return null
  if (/^(git|yarn|npm|npx|pnpm|docker|jq)\b/.test(command.trim())) return null
  if (/(\.claude\/|node_modules|\.logs|\bscripts\/)/.test(command)) return null

  const isNonCodeTarget = /(package\.json|\.(md|jsonc?|ya?ml|env|lock|log|css|txt|sql)\b)/.test(
    command,
  )
  const hasCodeExt = /\.(ts|tsx|js|jsx|mjs|cjs)\b/.test(command)
  // A bare workspace directory counts only when nothing non-code is named, so that
  // `grep '"react"' frontend/package.json` stays allowed.
  const hasDirs = DIRS.length > 0
  const isInWorkspace = hasDirs && new RegExp(`/(${DIRS})(/|$)`).test(cwd)
  const isCodeDir = hasDirs && new RegExp(String.raw`\b(${DIRS})/`).test(command)
  const isCodeTarget = hasCodeExt || ((isCodeDir || isInWorkspace) && !isNonCodeTarget)
  if (!isCodeTarget) return null

  for (const reader of READERS) {
    if (reader.pattern.test(command)) {
      return `${reader.reason} ${GRAPH_TOOLS} ${GRAPH_SCOPE} ${GRAPH_HATCH}`
    }
  }
  return null
}

/** The sandbox carries no working directory, so a leading `cd <path>` is the only hint. */
export function cwdHint(command: string): string {
  return /^\s*cd\s+(\S+)/.exec(command)?.[1] ?? ''
}
