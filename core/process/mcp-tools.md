---
version: 4.2.0
applies: Always
target: rules
priority: high
tags: [mcp, context7, knowledge-graph, tools, workflow]
---

# MCP Tools & Plugins

## Library Doc Lookup — every time, not optional

**CRITICAL:** Before writing or modifying code that uses a library, run **all three** lookups. Do all three every time, regardless of task complexity.

### 1. Read `package.json` for the exact installed version

The version determines which API is correct. Never assume you know the version.

### 2. Vendor docs + KG pitfalls

**Vendor docs** auto-load as path-scoped rules from `.claude/rules/vendor/` — no manual lookup needed. They load automatically when you edit files matching their path patterns. Each vendor doc has a `## Documentation` section with verified source URLs, GitHub repos, and Context7 library IDs — use these as the primary sources for API lookups in step 3.

**IMPORTANT:** Project-specific pitfalls and decisions are in the Knowledge Graph. Check these before writing code:

```
search_nodes("bug_resolution")         → open_nodes on results
search_nodes("Pitfall")                → open_nodes on results
search_nodes("architecture_decision")  → open_nodes on results
```

To discover which vendor docs exist for a domain: `search_nodes("domain: <domain>")` — these are lightweight references pointing to the auto-loaded rule files.

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

Run the steps again when you: switch to a different library, hit an unexpected error, or call an API you haven't verified this session. When errors don't make sense, check KG for pitfalls first: `search_nodes("Pitfall")`.

---

## Knowledge Graph

The KG stores project decisions, bug resolutions, and lightweight vendor references as named entities with typed relations. Data lives in `.memory/graph.jsonl`.

**Read:** `search_nodes` (search names, types, observations) → `open_nodes` (retrieve by name) → `read_graph` (dump all — use sparingly)

**Write:** `create_entities` (new nodes) · `add_observations` (append facts) · `create_relations` (directed edges)

**Delete:** `delete_entities` · `delete_observations` · `delete_relations`

### Entity conventions

**Names:** PascalCase — `VendorDaisyui5`, `AuthStrategy`, `HydrationMismatchBug`

| Type | Purpose | Example |
|------|---------|---------|
| `vendor_doc` | Lightweight reference to auto-loaded vendor rule | `VendorDaisyui5` → `rule: .claude/rules/vendor/daisyui-5.md` |
| `architecture_decision` | Why approach X was chosen over Y | `AuthStrategy` |
| `bug_resolution` | Symptom → root cause → fix | `HydrationMismatchOnDateFormat` |
| `convention` | Project patterns and rules | `FormValidationPattern` |

**Relations:** `depends_on`, `replaced_by`, `requires`, `configures`, `integrates_with`

Vendor doc content lives in `.claude/rules/vendor/` (auto-loaded by path). KG `vendor_doc` entities are lightweight references with domain tags for discoverability.

### KG write triggers — record immediately, not later

The kg-discipline hook reminds you after 4+ code file edits without a KG write. Record findings while details are fresh:

| Event | Action | Format |
|-------|--------|--------|
| Bug that misled you or spanned >3 files | `create_entities` type `bug_resolution` | Symptom, Root cause, Fix, Area |
| Chose approach X over Y for a reason | `create_entities` type `architecture_decision` | Decision, Why, Rejected alternatives |
| Something failed non-obviously | `create_entities` type `bug_resolution` | Link to vendor via `depends_on` relation |
| Found a GitHub issue explaining behavior | `create_entities` type `bug_resolution` | `"GitHub: {url} — {summary}"` |
| Established a repeating pattern | `create_entities` type `convention` | Pattern, When to use, Example |

Before creating an entity, `search_nodes` first — if a near-match exists, `add_observations` instead of duplicating.

After creating any entity, `create_relations` to link it to the relevant `vendor_doc` reference (`depends_on` for bugs/decisions, `configures` for conventions). No orphan entities.

---

## Context7

Version-specific library documentation and code examples.

1. `resolve-library-id("<package-name>")` — get the Context7 library ID (must call first, enforced by hook)
2. `query-docs(id, topic: "<specific topic>")` — fetch docs filtered by topic

If docs look wrong or outdated, flag it — do not blindly trust.

---

## Playwright MCP (browser automation)

Screenshots use JPEG format (enforced by hook for context efficiency).

