---
version: 2.0.0
applies: Always
target: rules
paths:
  - ".claude/**"
  - ".serena/**"
  - "**/*mcp*"
  - "**/*playwright*"
tags: [mcp, serena, context7, playwright, configuration, setup]
---

# MCP Server Setup

Installation and configuration reference for MCP servers.
For **tool usage rules**, see `core/process/mcp-tools` (auto-loaded from `.claude/rules/core/mcp-tools.md`).

## Documentation

| Server | Docs | Notes |
|--------|------|-------|
| Serena | [Configuration](https://oraios.github.io/serena/02-usage/050_configuration.html) | Contexts, modes, project setup |
| Context7 | [GitHub](https://github.com/upstash/context7) | Library doc lookup |
| Playwright | [GitHub](https://github.com/microsoft/playwright-mcp) | Browser automation |

## Setup Commands

```bash
# Serena — semantic code analysis, symbol navigation, LSP refactoring
# Uses claude-code context to avoid duplicating Claude Code's built-in tools
claude mcp add serena --scope project -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context claude-code --project $(pwd)

# Context7 — library documentation lookup
# API key optional but recommended for higher rate limits (get at context7.com/dashboard)
claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp

# Playwright — browser automation, screenshots, testing
# Uses config file for sane defaults (popups disabled, HTTPS errors ignored, etc.)
claude mcp add playwright --scope project -- npx @playwright/mcp@latest --config .claude/playwright-mcp.config.json
```

## Playwright Config File

Copy to `.claude/playwright-mcp.config.json` in your project:

```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "args": [
        "--disable-popup-blocking",
        "--disable-notifications",
        "--disable-infobars",
        "--disable-extensions",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-translate"
      ]
    },
    "contextOptions": {
      "viewport": { "width": 1280, "height": 800 },
      "ignoreHTTPSErrors": true,
      "bypassCSP": true,
      "permissions": ["clipboard-read", "clipboard-write"]
    }
  },
  "blockServiceWorkers": true,
  "timeout": {
    "action": 10000,
    "navigation": 30000
  }
}
```

## Serena Configuration

### Contexts

| Context | Use when... |
|---------|-------------|
| `claude-code` | Using Claude Code CLI — disables duplicate tools |
| `ide` | Using IDE assistants (VSCode, Cursor, Cline) |
| `desktop-app` | Using Claude Desktop — full toolset (default) |

### Modes

Modes can be added with `--mode <name>`:
- `interactive` (default) — engage with user throughout task
- `editing` (default) — enable code modification tools
- `planning` — design before implementing
- `no-onboarding` — skip project onboarding prompts

### Disabled Tools (in `.serena/project.yml`)

Non-essential tools that duplicate Claude Code built-ins are excluded.
See `core/process/mcp-tools` for the full exclusion list and rationale.

## Context7 with API Key

For higher rate limits, get a free key at [context7.com/dashboard](https://context7.com/dashboard):

```bash
claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp --api-key $CONTEXT7_API_KEY
```

## Playwright CLI Options

| Option | Example | Purpose |
|--------|---------|---------|
| `--config` | `--config .claude/playwright-mcp.config.json` | Load config file |
| `--headless` | `--headless` | No visible browser (CI/testing) |
| `--browser` | `--browser firefox` | Browser: chrome, firefox, webkit, msedge |
| `--caps` | `--caps vision,pdf` | Enable: vision, pdf, testing, tracing |
| `--console-level` | `--console-level debug` | Log level: error, warning, info, debug |

## Verification

```bash
claude mcp list
```

All servers should show with `scope: project`.
