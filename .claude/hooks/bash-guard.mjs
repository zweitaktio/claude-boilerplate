// version: 1.1.0
import { readStdin } from './core/stdin.mjs'
import { deny, inject, pass } from './core/output.mjs'

const { tool_input } = JSON.parse(await readStdin())
const command = tool_input?.command ?? ''
const trimmed = command.trimStart()
const warnings = []

function block(msg) { deny('PreToolUse', msg) }
function warn(msg) { warnings.push(msg) }

// --- Secret / credential leak checks ---
const SECRET_PATTERN = /\$(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|DATABASE_URL|DB_URL|AUTH|CREDENTIAL)/i
const SECRET_GUIDANCE = 'Do not pass secrets via variable expansion — create a wrapper script that reads from .env internally.'
const cleaned = command.replace(/\\\$/g, '')
if (SECRET_PATTERN.test(cleaned)) block(`Command expands a secret/credential variable. ${SECRET_GUIDANCE}`)

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
// Count only shell-level pipes; ignore | inside quotes (grep "a\|b" alternation, jq '..|..' filters).
const shellLevel = command.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '')
const pipeCount = (shellLevel.match(/\|/g) || []).length
if (pipeCount >= 3) block('No piped processing chains (3+ pipes) — create a script file instead. (tooling.md § Never Run Inline)')

// --- Git safety: block ---
if (/(^|\s)--no-verify(\s|$)/.test(trimmed)) block('Never skip pre-commit hooks (--no-verify). (tooling.md § Commit Rules)')
if (/^git\s+push\s+.*--force\b/.test(trimmed)) block('git push --force is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')
if (/^git\s+push\s+-f\b/.test(trimmed)) block('git push -f is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')
if (/^git\s+reset\s+--hard\b/.test(trimmed)) block('git reset --hard is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')
if (/^git\s+clean\s+-f/.test(trimmed)) block('git clean -f is destructive — confirm with user first. (tooling.md § Never Do Without Explicit Request)')
if (/^git\s+stash\b/.test(trimmed)) block('git stash affects shared branch state — other agents may be working on this branch. (tooling.md § Shared Branch Safety)')
if (/^git\s+revert\b/.test(trimmed)) block('git revert rewrites branch history — other agents may be working on this branch. Confirm with user first. (tooling.md § Shared Branch Safety)')

// --- Git safety: warn ---
if (/^git\s+checkout\b/.test(trimmed) && !/^git\s+checkout\s+-b\b/.test(trimmed)) {
  warn('git checkout can discard changes. Confirm with user before proceeding. (tooling.md § Never Do Without Explicit Request)')
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
if (/\bdeclare\s+-A\b/.test(trimmed)) block('declare -A (associative arrays) requires Bash 4+ — not available on macOS 3.2. (tooling.md § Shell Scripts)')
if (/\b(readarray|mapfile)\b/.test(trimmed)) block('readarray/mapfile requires Bash 4+ — not available on macOS 3.2. (tooling.md § Shell Scripts)')
if (/\bcoproc\b/.test(trimmed)) block('coproc requires Bash 4+ — not available on macOS 3.2. (tooling.md § Shell Scripts)')
if (/\|\&/.test(command)) block('|& (pipe stderr) requires Bash 4+ — not available on macOS 3.2. Use 2>&1 | instead. (tooling.md § Shell Scripts)')
if (/\$\{[^}]+(,,|^^)\}/.test(command)) block('${var,,}/${var^^} (case conversion) requires Bash 4+ — not available on macOS 3.2. Use tr instead. (tooling.md § Shell Scripts)')

// --- Payload-specific ---
if (/payload-api\.sh/.test(trimmed)) {
  block('Never run payload-api.sh — use the Payload MCP plugin (mcp__payload__*). (payload-api.md)')
}
if (/payload-token\.sh/.test(trimmed)) block('payload-token.sh has been superseded by the Payload MCP plugin. (payload-api.md)')
if (/\bcurl\b.*\/api\//.test(trimmed) && /\-X\s*(POST|PATCH|DELETE|PUT)/.test(trimmed)) {
  block('Prohibited: curl to /api/ with write methods — use the Payload MCP plugin (mcp__payload__*). (payload-api.md)')
}

// --- Emit accumulated warnings ---
if (warnings.length) inject('PreToolUse', warnings.join('\n\n'))
pass()
