import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'

const { tool_input } = JSON.parse(await readStdin())
const command = tool_input?.command ?? ''
const trimmed = command.trimStart()
const warnings = []

function block(msg) { deny('PreToolUse', msg) }
function warn(msg) { warnings.push(msg) }

const ENV_GUIDANCE = 'Either construct a command with literal values (permanently approvable) or create a wrapper script that reads from .env internally.'

// --- Env variable checks ---
if (/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+\S/.test(trimmed)) block(`Inline env var assignment before command. ${ENV_GUIDANCE}`)
if (/^env\s+[A-Za-z_]/.test(trimmed)) block(`'env' with variable assignment before command. ${ENV_GUIDANCE}`)
if (/^export\s+[A-Za-z_]/.test(trimmed)) block(`'export' mutates the shell environment. ${ENV_GUIDANCE}`)
const cleaned = command.replace(/\\\$/g, '')
if (/\$\{?[A-Za-z_]/.test(cleaned)) block(`Variable expansion makes this command non-reproducible and impossible to permanently approve. ${ENV_GUIDANCE}`)

// --- Verification commands ---
if (/^(yarn|npx|pnpm)\s+(tsc|eslint|prettier)\b/.test(trimmed)) block('Never run tsc/eslint/prettier individually — use yarn check. (tooling.md § Verification Commands)')

// --- Dev servers ---
if (/^(yarn|npm|npx|pnpm)\s+(dev|start)\b/.test(trimmed)) block('Never start dev servers — assume they are already running. (tooling.md § Dev Server Logs)')
if (/^(yarn|npm|pnpm)\s+run\s+dev\b/.test(trimmed)) block('Never start dev servers — assume they are already running. (tooling.md § Dev Server Logs)')

// --- Inline scripts ---
if (/^(python|python3)\s+-c\b/.test(trimmed)) block('No inline scripts — create a script file instead. (tooling.md § Never Run Inline)')
if (/^node\s+(-e|--eval|-p|--print)\b/.test(trimmed)) block('No inline scripts — create a script file instead. (tooling.md § Never Run Inline)')
if (/^ruby\s+-e\b/.test(trimmed)) block('No inline scripts — create a script file instead. (tooling.md § Never Run Inline)')

// --- Loops ---
if (/^\s*(for|while)\s/.test(trimmed)) block('No loops/iteration in Bash — create a script file in scripts/ instead. (tooling.md § Never Run Inline)')
if (/\bxargs\b/.test(trimmed)) block('No xargs batch operations — create a script file in scripts/ instead. (tooling.md § Never Run Inline)')

// --- Pipe chains (3+) ---
const pipeCount = (command.match(/\|/g) || []).length
if (pipeCount >= 3) block('No piped processing chains (3+ pipes) — create a script file instead. (tooling.md § Never Run Inline)')

// --- Git safety: block ---
if (/(^|\s)--no-verify(\s|$)/.test(trimmed)) block('Never skip pre-commit hooks (--no-verify). (tooling.md § Commit Rules)')
if (/^git\s+push\s+.*--force\b/.test(trimmed)) block('git push --force is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')
if (/^git\s+push\s+-f\b/.test(trimmed)) block('git push -f is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')
if (/^git\s+reset\s+--hard\b/.test(trimmed)) block('git reset --hard is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')
if (/^git\s+clean\s+-f/.test(trimmed)) block('git clean -f is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')

// --- Git safety: warn ---
if (/^git\s+checkout\b/.test(trimmed) && !/^git\s+checkout\s+-b\b/.test(trimmed)) {
  warn('git checkout can discard changes. Confirm with user before proceeding. (tooling.md § Never Do Without Explicit Request)')
}
if (/^git\s+revert\b/.test(trimmed)) {
  warn('git revert creates a new commit. Confirm with user before proceeding. (tooling.md § Never Do Without Explicit Request)')
}

// --- Commit rules ---
if (/Co-Authored-By/i.test(command)) block('Never add Co-Authored-By trailers to commits. (.claude/rules/git.md)')
if (/git\s+commit/.test(trimmed) && /\b(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(|:)/.test(command)) {
  warn('No conventional-commit prefixes (feat:, fix:, chore:, etc.) — use plain descriptive messages. (tooling.md § Commit Rules)')
}

// --- Shell compatibility ---
if (/\bgrep\s+.*-P\b/.test(trimmed)) block('grep -P (PCRE) is GNU-only, not available on macOS. Use grep -E instead. (tooling.md § Shell Scripts)')
if (/\breadlink\s+-f\b/.test(trimmed)) block('readlink -f is GNU-only, not available on macOS. Use realpath or a manual loop. (tooling.md § Shell Scripts)')
if (/\bfind\s+.*-regex\b/.test(trimmed)) block('find -regex uses GNU syntax, not portable on macOS. Use -name or -path instead. (tooling.md § Shell Scripts)')
if (/\bsed\s+-i\b/.test(trimmed) && !/\bsed\s+-i\s+''/.test(trimmed)) {
  warn("sed -i without '' arg differs on BSD/GNU. Use the Edit tool instead when possible. (tooling.md § Shell Scripts)")
}
if (/\bdeclare\s+-A\b/.test(trimmed)) block('declare -A (associative arrays) requires Bash 4+ — not available on macOS 3.2. (tooling.md § Shell Scripts)')
if (/\b(readarray|mapfile)\b/.test(trimmed)) block('readarray/mapfile requires Bash 4+ — not available on macOS 3.2. (tooling.md § Shell Scripts)')
if (/\bcoproc\b/.test(trimmed)) block('coproc requires Bash 4+ — not available on macOS 3.2. (tooling.md § Shell Scripts)')
if (/\|\&/.test(command)) block('|& (pipe stderr) requires Bash 4+ — not available on macOS 3.2. Use 2>&1 | instead. (tooling.md § Shell Scripts)')
if (/\$\{[^}]+(,,|^^)\}/.test(command)) block('${var,,}/${var^^} (case conversion) requires Bash 4+ — not available on macOS 3.2. Use tr instead. (tooling.md § Shell Scripts)')

// --- Payload-specific ---
if (/payload-api\.sh/.test(trimmed) && /\-X\s*(POST|PATCH|DELETE|PUT)/.test(trimmed)) {
  block('payload-api.sh with write methods must use context-mode. (payload-api.md § Workflow 2)')
}
if (/payload-api\.sh/.test(trimmed)) {
  block('Never run payload-api.sh via plain Bash — use context-mode tools. (payload-api.md § Workflow 1)')
}
if (/payload-token\.sh/.test(trimmed)) block('payload-token.sh has been superseded by the Payload MCP plugin. (payload-api.md)')
if (/\bcurl\b.*\/api\//.test(trimmed) && /\-X\s*(POST|PATCH|DELETE|PUT)/.test(trimmed)) {
  block('Prohibited: curl to /api/ with write methods. (payload-api.md § Workflow 2)')
}

// --- Emit accumulated warnings ---
if (warnings.length) inject('PreToolUse', warnings.join('\n\n'))
pass()
