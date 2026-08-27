---
version: 5.2.0
applies: Always
target: rules
priority: high
tags: [mcp, context7, codebase-memory, code-discovery, knowledge-base, tools, workflow]
---

# MCP Tools & Plugins

## Library Doc Lookup — every time, not optional

**CRITICAL:** Before writing or modifying code that uses a library, run **all three** lookups. Do all three every time, regardless of task complexity.

### 1. Read `package.json` for the exact installed version

The version determines which API is correct. Never assume you know the version.

### 2. Vendor docs + project pitfalls

**Vendor docs** auto-load as path-scoped rules from `.claude/rules/vendor/` — no manual lookup needed. They load automatically when you read files matching their path patterns. Each vendor doc has a `## Documentation` section with verified source URLs, GitHub repos, and Context7 library IDs — use these as the primary sources for API lookups in step 3.

**Project-specific pitfalls and decisions** are path-scoped Markdown under `.claude/rules/project/` — they auto-load when you read the files they concern, so you rarely have to look. For an area you won't open, run `.claude/scripts/wiki.sh find "<topic>"`. There is no Knowledge Graph to query. See `core/process/knowledge-base`.

### 3. Look up the API docs — Context7 + web search, in parallel

Always run both. Vendor rules have project context; these have current API details.

**Use the `## Documentation` section in the auto-loaded vendor doc** as your source list — it has the verified URLs, GitHub repos, and Context7 library IDs for each library. Don't guess at library IDs or doc URLs.

```
# Context7 — use the library ID from the vendor doc's Documentation table
resolve-library-id("<package-name>")  → query-docs(id, topic: "<what you need>")

# Web search — use the official docs URL from the vendor doc's Documentation table
WebSearch("<library> <version> <topic> site:<docs-url>")
```

Use the **specific version** in both queries — `"daisyui 5 form patterns"` not `"daisyui form patterns"`.

### Repeat before writing code that uses a different library

Run the steps again when you: switch to a different library, hit an unexpected error, or call an API you haven't verified this session. When errors don't make sense, check for a recorded pitfall first: `.claude/scripts/wiki.sh find "<symptom>"`.

---

## Code discovery — which tool

**Reach for the graph first when you look for code.** Grep matches lines. It cannot tell a definition
from a mention, it cannot follow a call, and it dumps raw bytes into your context.

| Task | Tool |
|------|------|
| Locate a symbol — a function, a class, a route | **`search_graph`** with a `name_pattern` and a `label` |
| Find the callers or the callees of a symbol | **`trace_call_path`** with a `function_name` and a `direction` |
| Read the exact source of a symbol you located | **`get_code_snippet`** |
| Orient yourself in an unfamiliar area | **`get_architecture`** |
| Ask a multi-hop structural question | **`query_graph`** (Cypher) |
| Find a literal string, a config value, a comment marker, a `TODO` | **Grep** — text the graph does not model |

The tool is `trace_call_path`, not `trace_path`. Full tool list and config:
`core/claude-config/mcp-servers` § codebase-memory-mcp.

**Scope every query to the workspace you own.** Pass `file_pattern` in a monorepo. Without it a query
returns matches from a sibling package you did not mean to touch, and a short identifier collides
across workspaces.

**Grep is the fallback, not the alternative.** Use Grep for literal text, for a file type the graph
does not index, and in a project that has not registered the server yet. Check `.mcp.json`.

---

## Project knowledge

Project decisions, bug resolutions, and conventions live in path-scoped Markdown under
`.claude/rules/project/`, not a Knowledge Graph. They auto-load when you read the files they concern.
Full read/write rules, the tiered model, and the frontmatter schema are in `core/process/knowledge-base`.

---

## Context7

Version-specific library documentation and code examples.

1. `resolve-library-id("<package-name>")` — get the Context7 library ID (must call first, enforced by hook)
2. `query-docs(id, topic: "<specific topic>")` — fetch docs filtered by topic

If docs look wrong or outdated, flag it — do not blindly trust.

---

## Browser automation — which tool

| Task | Tool |
|------|------|
| Driving or verifying the running UI by hand | **Claude in Chrome** — invoke the `claude-in-chrome` skill first, then batch the `mcp__claude-in-chrome__*` tools you need into **one** `ToolSearch` call |
| Scripted E2E specs, and rescuing a wedged Chrome tab | **Playwright MCP** |

Claude in Chrome is the default for interactive verification; Playwright MCP is the fallback and the
tool for committed specs. Full driving rules and the traps that cost the most time — never drive by
coordinates, ref clicks that dispatch nothing, the native value setter, measuring after every action —
are in `core/browser-verification`, which auto-loads on component and route files.

Playwright MCP screenshots use JPEG format (enforced by hook for context efficiency).

