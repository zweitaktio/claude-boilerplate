---
version: 3.1.0
applies: Always
target: rules
paths:
  - ".claude/**"
  - "**/*mcp*"
  - "**/*playwright*"
tags: [mcp, typescript-lsp, context-mode, context7, playwright, configuration, setup]
---

# MCP Server & Plugin Setup

Installation and configuration reference for MCP servers and plugins.
For **tool usage rules**, see `core/process/mcp-tools` (auto-loaded from `.claude/rules/core/mcp-tools.md`).

## Documentation

| Server / Plugin | Docs | Notes |
|-----------------|------|-------|
| Context7 | [GitHub](https://github.com/upstash/context7) | Library doc lookup |
| Playwright | [GitHub](https://github.com/microsoft/playwright-mcp) | Browser automation |
| typescript-lsp | [Marketplace](https://code.claude.com/docs/en/discover-plugins) | Code intelligence (plugin) |
| context-mode | [GitHub](https://github.com/claude-context-mode/context-mode) | Large output handling (plugin) |

## Setup Commands

```bash
# Context7 — library documentation lookup
# API key optional but recommended for higher rate limits (get at context7.com/dashboard)
claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp

# Playwright — browser automation, screenshots, testing
# Uses config file for sane defaults (popups disabled, HTTPS errors ignored, etc.)
claude mcp add playwright --scope project -- npx @playwright/mcp@latest --config .claude/playwright-mcp.config.json
```

## Plugin Setup

```bash
# typescript-lsp — code intelligence (go-to-definition, find references, diagnostics)
# Requires typescript-language-server binary in $PATH: npm i -g typescript-language-server typescript
claude plugin install typescript-lsp --scope project

# context-mode — sandbox execution for large outputs, context budget management
claude plugin install context-mode@claude-context-mode --scope project
```

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

All servers should show with `scope: project`. Both plugins should show as installed.
