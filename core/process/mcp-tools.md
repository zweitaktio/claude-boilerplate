---
version: 5.1.0
applies: Always
target: rules
priority: high
tags: [mcp, context7, knowledge-base, tools, workflow]
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

