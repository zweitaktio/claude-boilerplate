---
version: 5.0.0
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
# Context7 — project-scoped
# API key optional but recommended for higher rate limits (get at context7.com/dashboard)
claude mcp add context7 --scope project -- npx -y @upstash/context7-mcp

# Playwright — PROJECT-SCOPED. Both paths MUST be absolute, and the version MUST be pinned.
# See "The output directory must be absolute" below for why relative paths silently misroute.
claude mcp add playwright --scope project -- npx @playwright/mcp@0.0.78 \
  --config "$PWD/.claude/playwright-mcp.config.json" \
  --output-dir "$PWD/.claude/screenshots"
```

## Plugin Setup

```bash
# context-mode — user-scoped (default)
claude plugin install context-mode@context-mode
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
| Context7 (`context7`) | **project** | Set up per-project during `/webstack init` |
| context-mode | **user** | Plugin, user is the default scope |
| Playwright (`playwright`) | **project** | Uses project-local `--config .claude/playwright-mcp.config.json` |
| Payload (`payload`) | **project** | HTTP transport to project-specific Payload backend URL |

User-scoped tools are installed once per developer. Project-scoped tools use project-local configuration and are set up during `/webstack init`.

## Playwright Config File

**This config replaces any existing Playwright MCP config** in the project. On `/webstack init` or `/webstack update`, the skill copies its config to `.claude/playwright-mcp.config.json`, overwriting what's there. Project-specific tweaks should be made after deployment.

### The output directory must be absolute, and must live in `.mcp.json`

**Never set `outputDir` in the config file.** playwright-mcp resolves it with
`path.resolve(config.outputDir)` — against the **server process's cwd**, not against the config
file's directory (`resolveConfigPaths()` only rewrites `initPage`/`initScript`). A relative value
therefore lands wherever Claude Code happened to be launched from. The *default* is anchored to the
client workspace root, so a relative `outputDir` is **less** reliable than setting none at all.

Set it per project as an **absolute** `--output-dir` in `.mcp.json`. CLI beats the config file (merge
order is `defaults → file → env → CLI`), and `.mcp.json` is not skill-managed, so it survives the
`/webstack update` that overwrites `.claude/playwright-mcp.config.json`.

```bash
claude mcp remove playwright
claude mcp add playwright --scope project -- npx @playwright/mcp@0.0.78 \
  --config /abs/path/to/project/.claude/playwright-mcp.config.json \
  --output-dir /abs/path/to/project/.claude/screenshots
```

**Pin the version.** With `@latest`, output-path behaviour changes under you between sessions.

Screenshots land in `.claude/screenshots/` — add it to `.gitignore`.

**A per-call `filename` overrides all of this.** `outputFile()` is
`path.resolve(outputDir, filename)`, so an absolute `filename` discards `outputDir` and `../` climbs
out of it. `screenshot-guard` denies both; never pass a path as `filename`, only a bare basename.

**A malformed config file is silently ignored** — `loadConfig` falls back to INI parsing and then to
defaults without raising. Validate with `jq -e . .claude/playwright-mcp.config.json` after editing.

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
| `--config` | `--config /abs/…/.claude/playwright-mcp.config.json` | Load config file |
| `--output-dir` | `--output-dir /abs/…/.claude/screenshots` | Where artifacts are written. **Must be absolute** — see above |
| `--headless` | `--headless` | No visible browser (CI/testing) |
| `--browser` | `--browser firefox` | Browser: chrome, firefox, webkit, msedge |
| `--caps` | `--caps vision,pdf` | Enable: vision, pdf, testing, tracing |
| `--console-level` | `--console-level debug` | Log level: error, warning, info, debug |

## Verification

```bash
claude mcp list
claude plugin list
```

`context7` and `playwright` (and optionally `payload`) show at project scope. The context-mode plugin should show as installed.

A `memory` server may appear at user scope on older machines. It is a general-purpose Knowledge Graph server that webstack no longer uses — project knowledge is Markdown under `.claude/rules/project/`. Leaving it installed is harmless; nothing here depends on it.
