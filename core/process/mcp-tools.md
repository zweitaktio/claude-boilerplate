---
version: 3.3.0
applies: Always
target: rules
priority: high
tags: [mcp, context7, knowledge-graph, tools, workflow]
---

# MCP Tools & Plugins

## Library Doc Lookup — every time, not optional

Before writing or modifying code that uses a library, run **all three** lookups. This is not conditional — do all three every time, regardless of task complexity.

### 1. Read `package.json` for the exact installed version

The version determines which API is correct. Never assume you know the version.

### 2. Check the Knowledge Graph for project-specific docs and pitfalls

Run ALL of these — do not skip any:

```
search_nodes("domain: <domain>")   → open_nodes on EVERY result
search_nodes("<library name>")     → open_nodes on EVERY result
search_nodes("Pitfall")            → open_nodes on EVERY result
```

`search_nodes` returns entity names only — you MUST call `open_nodes` to read the actual content. Skipping `open_nodes` means you never loaded the docs.

KG contains curated vendor docs, project pitfalls, and bug resolutions — authoritative for this project. A PreToolUse hook blocks code edits until KG reads are detected. Always follow up with step 3 for API details.

### 3. Look up the API docs — Context7 + web search, in parallel

Always run both, even if KG returned results. KG has project context; these have API details.

```
# Context7 — version-specific API signatures and code examples
resolve-library-id("<package-name>")  → query-docs(id, topic: "<what you need>")

# Web search — official docs, changelogs, migration guides
WebSearch("<library> <version> <topic> docs")
```

Use the **specific version** in both queries — `"daisyui 5 form patterns"` not `"daisyui form patterns"`.

### Repeat before writing code that uses a different library

Run the three steps again when you: switch to a different library, hit an unexpected error, or call an API you haven't verified this session. When errors don't make sense, check KG for pitfalls first: `search_nodes("Pitfall")` + `search_nodes("<library>")`.

---

## Knowledge Graph

The KG stores vendor docs, project decisions, and bug resolutions as named entities with typed relations. Data lives in `.memory/graph.jsonl`.

**Read:** `search_nodes` (search names, types, observations) → `open_nodes` (retrieve by name) → `read_graph` (dump all — use sparingly)

**Write:** `create_entities` (new nodes) · `add_observations` (append facts) · `create_relations` (directed edges)

**Delete:** `delete_entities` · `delete_observations` · `delete_relations`

### Entity conventions

**Names:** PascalCase — `VendorDaisyui5`, `AuthStrategy`, `HydrationMismatchBug`

| Type | Purpose | Example |
|------|---------|---------|
| `vendor_doc` | Library/framework reference (seeded by skill) | `VendorDaisyui5`, `VendorReactRouter7Routing` |
| `architecture_decision` | Why approach X was chosen over Y | `AuthStrategy` |
| `bug_resolution` | Symptom → root cause → fix | `HydrationMismatchOnDateFormat` |
| `convention` | Project patterns and rules | `FormValidationPattern` |

**Relations:** `depends_on`, `replaced_by`, `requires`, `configures`, `integrates_with`

Vendor docs are KG-only — they are not files in the project. Never read vendor docs from the filesystem.

### KG write triggers — record immediately, not later

The kg-discipline hook reminds you after 4+ code file edits without a KG write. Record findings while details are fresh:

| Event | Action | Format |
|-------|--------|--------|
| Bug that misled you or spanned >3 files | `create_entities` type `bug_resolution` | Symptom, Root cause, Fix, Area |
| Chose approach X over Y for a reason | `create_entities` type `architecture_decision` | Decision, Why, Rejected alternatives |
| Something failed non-obviously | `add_observations` to relevant `vendor_doc` | `"Pitfall: {what} — {why}"` |
| Found a GitHub issue explaining behavior | `add_observations` to relevant `vendor_doc` | `"GitHub: {url} — {summary}"` |
| Established a repeating pattern | `create_entities` type `convention` | Pattern, When to use, Example |

Before creating an entity, `search_nodes` first — if a near-match exists, `add_observations` instead of duplicating.

After creating any entity, `create_relations` to link it to the relevant `vendor_doc` (`depends_on` for bugs/decisions, `configures` for conventions). No orphan entities.

---

## Context7

Version-specific library documentation and code examples.

1. `resolve-library-id("<package-name>")` — get the Context7 library ID (must call first, enforced by hook)
2. `query-docs(id, topic: "<specific topic>")` — fetch docs filtered by topic

If docs look wrong or outdated, flag it — do not blindly trust.

---

## Playwright MCP (browser automation)

Screenshots use JPEG format (enforced by hook for context efficiency).

