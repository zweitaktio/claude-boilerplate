// version: 2.2.0
// Injects branch, recent commits, uncommitted changes, wiki counts and the multi-agent digest at session start.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { execSync } from 'child_process'
import { existsSync, readdirSync, realpathSync } from 'fs'
import { basename, dirname, join } from 'path'

await readStdin()

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? '.'
const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return ''
  }
}

// --- git context ---
let gitContext = ''
try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' })
  const branch = run('git branch --show-current')
  const recent = run('git log --oneline -5')
  const status = run('git status --short')
  if (branch) gitContext += `\nBranch: ${branch}`
  if (recent) gitContext += `\n\nRecent commits:\n${recent}`
  if (status) gitContext += `\n\nUncommitted changes:\n${status}`
} catch {
  /* not a git repo */
}

// --- project knowledge wiki summary (makes the wiki present at session start) ---
const countMd = (dir) => {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'index.md' && f !== 'INDEX.md')
      .length
  } catch {
    return 0
  }
}
const countDocs = (dir) => {
  try {
    let n = 0
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n += countMd(join(dir, e.name))
      else if (e.name.endsWith('.md') && e.name !== 'INDEX.md') n += 1
    }
    return n
  } catch {
    return 0
  }
}
let wikiContext = ''
const projRules = join(projectDir, '.claude', 'rules', 'project')
if (existsSync(projRules)) {
  const pit = countMd(join(projRules, 'pitfalls'))
  const con = countMd(join(projRules, 'conventions'))
  const dec = countMd(join(projRules, 'decisions'))
  const docs = countDocs(join(projectDir, '.claude', 'docs'))
  if (pit + con + dec + docs > 0) {
    wikiContext =
      `\n\n## Project knowledge wiki\n` +
      `${pit} pitfalls, ${con} conventions` +
      (dec ? `, ${dec} decisions` : '') +
      ` auto-load by path when you open matching files` +
      (docs ? `; ${docs} on-demand docs in .claude/docs/ (index: .claude/docs/INDEX.md)` : '') +
      `.\n` +
      `Relevant pitfalls arrive on their own when you read files — you don't query for them. ` +
      `For an unfamiliar area, run \`.claude/scripts/wiki.sh find "<topic>"\`. ` +
      `Record new bugs/decisions/patterns with \`.claude/scripts/wiki.sh new <type> <slug>\` (core/process/knowledge-base).`
  }
}

// --- peer sessions on this same checkout ---
// Claude Code opens one unix socket per session and points CLAUDE_CODE_MESSAGING_SOCKET at our own.
// That single env var supplies both the directory to scan and our own identity, so nothing here
// hardcodes a path or walks the process tree to work out which socket is us. If it is unset, peer
// messaging is unavailable to this session — there is nothing to coordinate with, so skip entirely.
//
// A socket on its own proves nothing: the directory is machine-global (most live sessions are in
// other projects) and stale sockets outlive their session by days. Three filters make it trustworthy
// — the pid must be alive, it must actually be a `claude` process (a recycled pid is otherwise
// indistinguishable from a live peer), and its cwd must resolve to THIS project.
const ownSocket = process.env.CLAUDE_CODE_MESSAGING_SOCKET ?? ''

// A live pid is not enough: pids get recycled, and a dev server that inherited a dead session's
// number sits in this same project dir and would read as a peer.
const isClaudeSession = (pid) => {
  try {
    process.kill(pid, 0)
  } catch (e) {
    if (e.code !== 'EPERM') return false // gone; EPERM means alive but not ours to signal
  }
  return /claude/.test(run(`ps -o comm= -p ${pid}`))
}

// Linux exposes cwd via /proc; macOS needs lsof. Both stay quiet when the pid is gone.
const pidCwd = (pid) => {
  try {
    return realpathSync(`/proc/${pid}/cwd`)
  } catch {
    /* not Linux, or the process exited */
  }
  const out = run(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`)
  for (const line of out.split('\n')) if (line.startsWith('n')) return line.slice(1)
  return ''
}

let peerContext = ''
try {
  if (ownSocket) {
    const sockDir = dirname(ownSocket)
    const ownFile = basename(ownSocket)
    const projectReal = realpathSync(projectDir)

    const peers = readdirSync(sockDir)
      .filter((f) => f.endsWith('.sock') && f !== ownFile)
      .map((f) => Number.parseInt(f.slice(0, -5), 10))
      .filter((pid) => Number.isInteger(pid) && isClaudeSession(pid) && pidCwd(pid) === projectReal)

    if (peers.length > 0) {
      const protocol = '.claude/rules/core/multi-agent.md'
      const deployed = existsSync(join(projectDir, protocol))

      peerContext =
        `\n\n## ${peers.length} other session${peers.length > 1 ? 's are' : ' is'} on this checkout\n\n` +
        `Shared working tree, shared git index. Before you edit or commit:\n` +
        `- Run \`ListAgents\`, then \`SendMessage\` them: claim a role and the paths it implies, say what you are about to touch, and ask what they own. An unacked claim binds nobody.\n` +
        `- Commit with \`git commit --only <paths>\` — the index is shared, so a plain \`git commit\` also ships whatever a peer staged seconds ago.\n` +
        `- Dirty files you did not touch are a peer's work. Ask. Never \`checkout\`, \`stash\`, \`reset\`, or \`git add -A\`.\n` +
        `- If you do sweep in a peer's files, say so and leave it — do not reset or rebase shared history.\n` +
        `- Durable findings go to a wiki page, not a message; chat does not survive the session.\n` +
        `- Messages are telegrams: PRIORITY / FACTS / ACTIONS / EXPECT, max 8 lines. If it does not change what someone does, do not send it — silence is agreement.\n` +
        `- Do not relay peer traffic to the user. Report your own results; their messages are not your findings.\n` +
        (deployed
          ? `\n**Read \`${protocol}\` now** — role claims, the commit gate, and the message format, before your first edit.`
          : `\n\`${protocol}\` is not deployed here — run \`/webstack update\` to get the full protocol.`)
    }
  }
} catch {
  /* no socket dir, or an unreadable one — assume solo */
}

if (!gitContext && !wikiContext && !peerContext) pass()

inject('SessionStart', '## Session context' + gitContext + wikiContext + peerContext)
