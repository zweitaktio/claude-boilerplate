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

// A reader counts at the start of a shell command: after a newline, `;`, `&`, `||`, `(` or
// `xargs` and its flags. A pipe is left out, because `cmd | grep x` and `cmd |& tail` filter
// output and read no file. A flag such as `-n 1` or `-I {}` may carry one value.
const XARGS = String.raw`\bxargs(\s+-\S+(\s+[^-\s]\S*)?)*\s+`
const SEGMENT = String.raw`(^|[;\n(]\s*|(?<!\|)&\s*|\|\|\s*|${XARGS})`

const READERS = [
  {
    pattern: new RegExp(String.raw`${SEGMENT}(grep|rg|ag|ack)(\s|$)`),
    reason: 'Text-searching source with grep/rg.',
  },
  {
    // git takes global options before the subcommand: `-C dir`, `-c key=value`, `--no-pager`.
    pattern: new RegExp(
      String.raw`${SEGMENT}git\s+(-[cC]\s+\S+\s+|--?[\w-]+(=\S+)?\s+)*grep(\s|$)`,
    ),
    reason: 'Text-searching source with git grep.',
  },
  {
    pattern: new RegExp(String.raw`${SEGMENT}(cat|head|tail|less|more|bat)(\s|$)`),
    reason: 'Reading source through a shell pager.',
  },
  {
    pattern: new RegExp(String.raw`${SEGMENT}sed\s+-n\b`),
    reason: 'Reading source line ranges with sed.',
  },
]

// File reads in the sandbox languages that are not a shell.
const CODE_READERS =
  /\b(readFileSync|readFile|readdirSync|readdir|createReadStream|read_text|read_bytes|File\.read|Bun\.file)\s*\(|(^|[^.\w])open\s*\(/

function isExempt(text: string): boolean {
  if (/#\s*graph-miss:\s*\S/.test(text)) return true
  return /(\.claude\/|node_modules|\.logs|\bscripts\/)/.test(text)
}

/** True when the text names source code: a code extension, or a workspace directory. */
function isCodeTarget(text: string, cwd: string): boolean {
  // The extension must end a file name. `console.log(` is a call, not a log file.
  const isNonCodeTarget =
    /(package\.json|\.(md|jsonc?|ya?ml|env|lock|log|css|txt|sql)(?=$|[\s'"`,;:)\]}]))/.test(text)
  const hasCodeExt = /\.(ts|tsx|js|jsx|mjs|cjs)\b/.test(text)
  // A bare workspace directory counts only when nothing non-code is named, so that
  // `grep '"react"' frontend/package.json` stays allowed.
  const hasDirs = DIRS.length > 0
  const isInWorkspace = hasDirs && new RegExp(`/(${DIRS})(/|$)`).test(cwd)
  const isCodeDir = hasDirs && new RegExp(String.raw`\b(${DIRS})/`).test(text)
  return hasCodeExt || ((isCodeDir || isInWorkspace) && !isNonCodeTarget)
}

// Calls that start a shell process from a script in another language.
const PROCESS_CALLS =
  /\b(exec|execSync|execFile|execFileSync|spawn|spawnSync|system|popen|check_output|check_call|Popen|capture2e?|capture3)\s*\(|\bsubprocess\.(run|call)\s*\(|\$`/

const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g

function readerReason(text: string): string | null {
  for (const reader of READERS) {
    if (reader.pattern.test(text)) return reader.reason
  }
  return null
}

function violation(reason: string): string {
  return `${reason} ${GRAPH_TOOLS} ${GRAPH_SCOPE} ${GRAPH_HATCH}`
}

/** Returns a deny reason, or null when the command may run. */
export function graphPolicyViolation(command: string, cwd: string): string | null {
  if (command.length === 0 || isExempt(command) || !isCodeTarget(command, cwd)) return null
  const reason = readerReason(command)
  return reason ? violation(reason) : null
}

/**
 * The policy for sandbox code in a language that is not a shell. A script that reads files and
 * names a workspace directory or a code extension reads source that the graph answers.
 */
export function sandboxReadViolation(code: string, cwd: string): string | null {
  if (code.length === 0 || isExempt(code) || !isCodeTarget(code, cwd)) return null
  if (CODE_READERS.test(code)) return violation('Reading source with a sandbox script.')
  if (!PROCESS_CALLS.test(code)) return null
  // Each string literal starts a line, so the reader check sees `grep -rn x` in one literal and
  // the argument list `['cat', 'app/root.tsx']` as `cat` followed by its argument.
  const literals = [...code.matchAll(STRING_LITERAL)].map((match) => match[2])
  const reason = readerReason(literals.join('\n'))
  return reason ? violation(`${reason} The script starts it as a shell process.`) : null
}

/** ctx_execute_file loads a file into the script as FILE_CONTENT, so the path is the read. */
export function sandboxFileViolation(path: string, code: string, cwd: string): string | null {
  if (path.length === 0 || isExempt(path) || isExempt(code)) return null
  if (!isCodeTarget(path, cwd)) return null
  return violation('Reading source into a sandbox script.')
}

/** The sandbox carries no working directory, so a leading `cd <path>` is the only hint. */
export function cwdHint(command: string): string {
  return /^\s*cd\s+(\S+)/.exec(command)?.[1] ?? ''
}
