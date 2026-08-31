---
version: 5.2.2
applies: Always
target: rules
priority: high
tags: [mcp, docs-lookup, codebase-memory, code-discovery, knowledge-base, tools, workflow]
---

# MCP Tools & Plugins

## Library Doc Lookup — every time, not optional

**CRITICAL:** Before writing or modifying code that uses a library, run **all three** lookups. Do all three every time, regardless of task complexity.

### 1. Read `package.json` for the exact installed version

The version determines which API is correct. Never assume you know the version.

### 2. Vendor docs + project pitfalls

**Vendor docs** auto-load as path-scoped rules from `.claude/rules/vendor/`. You need no manual lookup.
They load when you read a file that matches their path patterns. Each vendor doc holds a
`## Documentation` section with the verified source URL and the GitHub repository. Use that section as
the source list for step 3.

**Project pitfalls and decisions** auto-load the same way. For an area you will not open, run
`.claude/scripts/wiki.sh find "<topic>"`. See § Project knowledge below.

### 3. Read the official source for the installed version

**Go to the source the library publishes, at the version the project runs.** A documentation site shows
the latest release. Your project rarely runs the latest release, and that gap is what a wrong API call
is made of.

Take the source list from the auto-loaded vendor doc. Never guess a URL.

Fetch with `ctx_fetch_and_index`, then `ctx_search`. Never fetch a documentation page with `curl`,
because the whole page then lands in context (`core/tooling` § curl).

**Source order. Stop at the first one that answers the question.**

| Order | Source | Why it ranks here |
|-------|--------|-------------------|
| 1 | The GitHub repository **at the installed tag**: `https://github.com/<org>/<repo>/tree/v<version>/docs` | Version-exact. The docs match the code you run |
| 2 | The release notes for that tag: `https://github.com/<org>/<repo>/releases/tag/v<version>` | The fastest answer when the behaviour changed between versions |
| 3 | The official documentation site | Current and readable. Confirm it covers your version |
| 4 | `WebSearch("<library> <version> <topic>")` | The fallback when the three above do not answer |

```
# Version-exact, from the repository the library publishes
ctx_fetch_and_index(url: "https://raw.githubusercontent.com/remix-run/react-router/v8.1.0/docs/start/framework/route-module.md",
                    source: "RR8 route modules")
ctx_search(queries: ["clientLoader hydration"])
```

**Name the version in every query.** Search `"daisyui 5 form patterns"`, never `"daisyui form patterns"`.

**A source that contradicts the installed version is wrong, not authoritative.** Say so, and use the
tag.

### Repeat before writing code that uses a different library

Run the steps again when you: switch to a different library, hit an unexpected error, or call an API you haven't verified this session. When errors don't make sense, check for a recorded pitfall first: `.claude/scripts/wiki.sh find "<symptom>"`.

---

## Code discovery — which tool

**Reach for the graph first when you look for code.** Grep matches lines. It cannot tell a definition
from a mention, it cannot follow a call, and it dumps raw bytes into your context.

| Task | Tool |
|------|------|
| Locate a symbol — a function, a class, a route | **`search_graph`** with a `name_pattern` and a `label` |
| Find the callers or the callees of a symbol | **`trace_path`** with a `function_name`, a `project` and a `direction` |
| Read the exact source of a symbol you located | **`get_code_snippet`** |
| Orient yourself in an unfamiliar area | **`get_architecture`** |
| Ask a multi-hop structural question | **`query_graph`** (Cypher) |
| Find a literal string, a config value, a comment marker, a `TODO` | **Grep** — text the graph does not model |

The tool is `trace_path`, not `trace_call_path`. Verified against codebase-memory-mcp 0.10.8:
`codebase-memory-mcp cli trace_call_path --help` answers `unknown tool`. The package's own bundled
README names `trace_call_path` and is wrong, so check the binary, never the README. Full tool list and
config: `core/mcp-servers` § codebase-memory-mcp.

Use the `--help` form to test a tool name. The deprecated raw-JSON form
(`cli trace_call_path '{}'`) accepts the wrong name and reports a missing argument instead. That
answer looks like a pass and is a false negative. The `tools/list` response over stdio is the
authority.

**Scope every query to the workspace you own.** Pass `file_pattern` in a monorepo. Without it a query
returns matches from a sibling package you did not mean to touch, and a short identifier collides
across workspaces.

**Grep is the fallback, not the alternative.** Use Grep for literal text, for a file type the graph
does not index, and in a project that has not registered the server yet. Check `.mcp.json`.

---

## Project knowledge

Project decisions, bug resolutions and conventions live in path-scoped Markdown under
`.claude/rules/project/`. They auto-load when you read the files they concern.
Full read/write rules, the tiered model, and the frontmatter schema are in `core/knowledge-base`.

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

