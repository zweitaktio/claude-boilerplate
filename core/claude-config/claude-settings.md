---
version: 1.7.0
applies: Always
target: rules
paths:
  - ".claude/**"
  - "CLAUDE.md"
tags: [configuration, settings, permissions, hooks]
---

# Claude Code Settings

## Recommended `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(cd:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Bash(rg:*)",
      "Bash(mkdir:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(rm:*)",
      "Bash(touch:*)",
      "Bash(ln:*)",
      "Bash(chmod:*)",
      "Bash(pwd)",
      "Bash(which:*)",
      "Bash(echo:*)",
      "Bash(date:*)",
      "Bash(sort:*)",
      "Bash(uniq:*)",
      "Bash(diff:*)",
      "Bash(git:*)",
      "Bash(yarn:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(python:*)",
      "Bash(python3:*)",
      "Bash(jq:*)",
      "Bash(curl:*)",
      "Bash(gh:*)",
      "Bash(docker:*)",
      "Bash(docker compose:*)",
      "Bash(sbt:*)",
      "WebSearch"
    ],
    "deny": []
  }
}
```

## What This Enables

### File Operations (no approval needed)
- `ls`, `cat`, `head`, `tail`, `wc` — read files and directories
- `find`, `grep`, `rg` — search files
- `mkdir`, `cp`, `mv`, `rm`, `touch` — file management

### Development Tools (no approval needed)
- `git` — all git operations
- `yarn`, `npm`, `npx` — package management and scripts
- `node` — run Node.js
- `jq` — JSON processing
- `curl` — HTTP requests
- `gh` — GitHub CLI

### Search (no approval needed)
- `WebSearch` — web searches for documentation, solutions, etc.

## Project-Level vs User-Level

- **Project settings**: `.claude/settings.json` in repo root — shared with team
- **User settings**: `~/.claude/settings.json` — personal defaults

Project settings override user settings for that project.

**What goes where:**

| Item | Scope | Reason |
|------|-------|--------|
| MCP tool **permissions** | Project `.claude/settings.json` | The team shares them through git |
| Plugin **installations** | User scope | Each developer installs with `claude plugin install` |
| **Project-specific** MCP servers, such as `playwright` and `payload` | Project scope | Only this project uses them |

**A headless run can drop every project rule.** Claude Code skips the project rules in
`.claude/rules/` when you exclude `project` from `--setting-sources`. From v2.1.211 this also covers
the path-scoped rules and the rules in a nested `.claude/rules/` directory. An earlier version loaded
those anyway. A CI job or an SDK run that sets `--setting-sources` must name `project`, or the deployed
conventions never reach the agent.

**A hook that fails lets the action through.** A command hook that cannot start, times out or exits
with an unexpected code is non-blocking. Add `"onFailure": "block"` to a guard that must refuse when it
fails. Claude Code 2.1.295 or later reads the key. Never set it on a hook that only injects context,
because it then blocks the tool and protects nothing. Never set it on a guard for `Bash`, `Write` or
`Edit`. A broken runtime stops every hook at once, and the session then cannot run a command or edit a
file to repair it.

## Adding MCP Permissions

An allow rule matches only the server it names. Write `mcp__<server>__*` with the whole normalized
server name. From Claude Code 2.1.299, `mcp__a` no longer allows a server named `a__b`.

For MCP tools, add to the allow list in project `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__claude-in-chrome__*",
      "mcp__playwright__*",
      "mcp__plugin_context-mode_context-mode__*"
    ]
  }
}
```

For Payload projects, also add `"mcp__payload__*"` to the allow list.

## Capping Subagent Spend

Claude Opus 5 delegates to subagents more readily than earlier models. Delegation pays off on an
independent, sizeable track of work. It multiplies cost and time on a small task.

`core/tooling` § Delegating to a subagent states the criteria. Set a deterministic cap as well, because
a criterion is advisory and a cap is not.

```json
{
  "env": {
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1",
    "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS": "3"
  }
}
```

- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` stops a subagent from spawning its own subagents. Set it to `1`
  unless a workflow needs nesting.
- `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` caps how many run at once.
- Both need Claude Code 2.1.217 or later.

Three frontmatter keys in `.claude/agents/*.md` also limit what a subagent costs:

| Key | Effect | Version |
|-----|--------|---------|
| `omitClaudeMd: true` | The subagent runs without the user, project and local `CLAUDE.md` files. Managed policy files still load | 2.1.271 |
| `autoCompactWindow` | The subagent compacts earlier than the main conversation | 2.1.296 |
| `experimental.cacheTtl` | The prompt cache TTL for this agent, `"5m"` or `"1h"`. A subagent TTL setting overrides it | 2.1.248 |

Use `omitClaudeMd` only for an agent that needs no project convention. A subagent without `CLAUDE.md`
does not know the commands and the architecture of the project.

Claude Code adds its own delegation instruction on Opus 5 only under the `claude_code` system prompt
preset. A custom or omitted system prompt gets no such instruction, so the rule and the cap carry the
work.
