---
version: 1.0.0
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

## Adding MCP Permissions

For MCP tools, add to the allow list:

```json
{
  "permissions": {
    "allow": [
      "mcp__context7__*",
      "mcp__playwright__*",
      "mcp__serena__*"
    ]
  }
}
```
