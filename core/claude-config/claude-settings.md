---
version: 1.3.0
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
      "Bash(jq:*)",
      "Bash(curl:*)",
      "Bash(gh:*)",
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
- MCP tool **permissions** → project `.claude/settings.json` (team-shared, checked into git)
- Plugin **installations** → user scope (per developer, `claude plugin install`)
- MCP server **installations** → user scope for generic servers (`memory`, `context7`); project scope for project-specific servers (`playwright`, `payload`)

## Adding MCP Permissions

For MCP tools, add to the allow list in project `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__context7__*",
      "mcp__playwright__*",
      "mcp__memory__*",
      "mcp__plugin_context-mode_context-mode__*"
    ]
  }
}
```

For Payload projects, also add `"mcp__payload__*"` to the allow list.
