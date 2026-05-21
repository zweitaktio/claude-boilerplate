---
version: 4.2.1
applies: Always
target: rules
paths:
  - ".claude/**"
  - "**/*mcp*"
  - "**/*playwright*"
tags: [mcp, context-mode, context7, playwright, configuration, setup]
---

# MCP Server & Plugin Setup

Installation and configuration reference for MCP servers and plugins.
For **tool usage rules**, see `core/mcp-tools` (auto-loaded from `.claude/rules/core/mcp-tools.md`).

## Documentation

| Server / Plugin | Docs | Notes |
|-----------------|------|-------|
| Context7 | [GitHub](https://github.com/upstash/context7) | Library doc lookup |
| Playwright | [GitHub](https://github.com/microsoft/playwright-mcp) | Browser automation |
| context-mode | [GitHub](https://github.com/claude-context-mode/context-mode) | Large output handling (plugin) |

## Setup Commands

```bash
# Knowledge Graph — user-scoped (one-time setup)
claude mcp add memory --scope user -- npx -y @modelcontextprotocol/server-memory

# Context7 — project-scoped
# API key optional but recommended for higher rate limits (get at context7.com/dashboard)
claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp

# Playwright — PROJECT-SCOPED (uses project-local config file)
claude mcp add playwright --scope project -- npx @playwright/mcp@latest --config .claude/playwright-mcp.config.json
```

## Plugin Setup

```bash
# context-mode — user-scoped (default)
claude plugin install context-mode@claude-context-mode
```

## Payload MCP (Payload projects)

```bash
# Payload MCP — PROJECT-SCOPED (connects to project-specific backend)
# Requires @payloadcms/plugin-mcp in the backend Payload config.
# Get an API key from the Payload admin panel under MCP API Keys, then substitute
# it for MCP-USER-API-KEY below. The plugin rejects requests without a Bearer token.
claude mcp add payload --transport http --scope project --header "Authorization: Bearer MCP-USER-API-KEY" -- http://localhost:3000/api/mcp
```

## Scope Model

| Tool | Scope | Reason |
|------|-------|--------|
| Knowledge Graph (`memory`) | **user** | Generic server, data stays in project CWD (`.memory/graph.jsonl`) |
| Context7 (`context7`) | **project** | Set up per-project during `/webstack init` |
| context-mode | **user** | Plugin, user is the default scope |
| Playwright (`playwright`) | **project** | Uses project-local `--config .claude/playwright-mcp.config.json` |
| Payload (`payload`) | **project** | HTTP transport to project-specific Payload backend URL |

User-scoped tools are installed once per developer. Project-scoped tools use project-local configuration and are set up during `/webstack init`.

## Playwright Config File

**This config replaces any existing Playwright MCP config** in the project. On `/webstack init` or `/webstack update`, the skill copies its config to `.claude/playwright-mcp.config.json`, overwriting what's there. Project-specific tweaks should be made after deployment.

If the project already has a Playwright MCP server configured with a different `--config` path, update the MCP server command to point to `.claude/playwright-mcp.config.json`:
```bash
claude mcp remove playwright
claude mcp add playwright --scope project -- npx @playwright/mcp@latest --config .claude/playwright-mcp.config.json
```

Screenshots are saved to `.claude/screenshots/` (add to `.gitignore`).

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
  "outputDir": ".claude/screenshots",
  "outputMode": "file",
  "blockServiceWorkers": true,
  "timeout": {
    "action": 10000,
    "navigation": 30000
  }
}
```

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
claude plugin list
```

MCP servers show with mixed scopes: `memory` at user scope, `context7` and `playwright` (and optionally `payload`) at project scope. The context-mode plugin should show as installed.
