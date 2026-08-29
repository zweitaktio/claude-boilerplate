---
version: 5.1.1
applies: Always
target: rules
paths:
  - ".claude/**"
  - "**/*mcp*"
  - "**/*playwright*"
  - "**/.cbmignore"
tags: [mcp, context-mode, playwright, codebase-memory, configuration, setup]
---

# MCP Server & Plugin Setup

Installation and configuration reference for MCP servers and plugins.
For **tool usage rules**, see `core/mcp-tools` (auto-loaded from `.claude/rules/core/mcp-tools.md`).

## Documentation

| Server / Plugin | Docs | Notes |
|-----------------|------|-------|
| Playwright | [GitHub](https://github.com/microsoft/playwright-mcp) | Browser automation |
| context-mode | [GitHub](https://github.com/claude-context-mode/context-mode) | Large output handling (plugin) |
| codebase-memory-mcp | [GitHub](https://github.com/DeusData/codebase-memory-mcp) | Structural code discovery (global npm binary, project-scoped data) |

## Setup Commands

```bash
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

## codebase-memory-mcp (structural code discovery)

The binary installs globally. Everything else stays inside the project.

### 1. Verify the global npm package

```bash
~/.claude/skills/webstack/scripts/preflight.sh      # reports codebase-memory-mcp availability
codebase-memory-mcp --version                       # expect 0.10.8 or later
npm install -g codebase-memory-mcp                  # if it is missing
```

**Never run `codebase-memory-mcp install`.** That command writes MCP entries, skills, hooks and
instruction files into 43 global agent surfaces, including `~/.claude.json` and `~/.claude/skills/`.
The npm `postinstall` only downloads and checksum-verifies the native binary, so npm is the safe path.

A global npm binary lives under the active nvm node version. A node switch hides it, and you must
reinstall with `npm install -g codebase-memory-mcp`.

### 2. Register the server in the project `.mcp.json`

**Both env paths must be absolute**, for the same reason the Playwright `--output-dir` must be — the
server resolves a relative path against its own working directory, not against `.mcp.json`.

```jsonc
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "type": "stdio",
      "command": "codebase-memory-mcp",
      "args": [],
      "env": {
        "CBM_CACHE_DIR": "<project-root>/.cbm",
        "CBM_ALLOWED_ROOT": "<project-root>"
      }
    }
  }
}
```

`CBM_CACHE_DIR` holds the graph database and the server's own settings (`_config.db`). Keep it inside
the repo and add `.cbm` to `.gitignore`. The default root `~/.cache/codebase-memory-mcp` puts index
data outside the project, so always set this.

### 3. Add `.cbmignore` at the repo root

`.cbmignore` layers on top of `.gitignore`. It excludes files that are tracked but add no structure
to the graph — generated types, generated import maps, build caches, translation catalogs, and the
Markdown rule corpora.

```
# Generated but tracked
**/payload-types.ts
**/importMap.js

# Build caches and generated routes
frontend/.react-router/

# Large Markdown with no code structure
.claude/rules/
.claude/docs/
```

### One account, one cache root at a time

**A hand-run `config` or `cli` command must carry the project's `CBM_CACHE_DIR`.** Without it the
command reads and writes the default account cache, and the change never reaches the MCP server.

```bash
CBM_CACHE_DIR="$PWD/.cbm" codebase-memory-mcp cli get_architecture '{}'
```

**One account uses one canonical cache root at a time.** The daemon rejects a second project with a
different `CBM_CACHE_DIR` while a session on the first project is live. The error names both cache
hashes. Close the other project's sessions before you index this one.

## Scope Model

| Tool | Scope | Reason |
|------|-------|--------|
| context-mode | **user** | Plugin, user is the default scope |
| Playwright (`playwright`) | **project** | Uses project-local `--config .claude/playwright-mcp.config.json` |
| Payload (`payload`) | **project** | HTTP transport to project-specific Payload backend URL |
| codebase-memory-mcp | **project** | Binary is global; `CBM_CACHE_DIR` and `CBM_ALLOWED_ROOT` are project-absolute |

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

`playwright` (and optionally `payload`) shows at project scope. The context-mode plugin should show as installed.

A `memory` server may appear at user scope on an older machine. Webstack retired it. Project knowledge is Markdown under `.claude/rules/project/`. Remove it with `claude mcp remove memory`.

## Retired: Context7

Webstack used the `context7` MCP server for library documentation. It is retired.

In practice the model reached for it rarely, and its index lags the library. The lookup rule now reads
the official source at the installed version tag — see `core/mcp-tools` § Library Doc Lookup.

Remove it from a project that still has it:

```bash
claude mcp remove context7
```
