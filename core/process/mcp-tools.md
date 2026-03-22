---
version: 3.0.0
applies: Always
target: rules
priority: high
tags: [mcp, context7, knowledge-graph, tools, workflow]
---

# MCP Tools & Plugins

## Library Doc Lookup — do this before writing code

For every library you are about to use, look up its docs **before** writing code. Read `package.json` first to get the exact installed version — the version matters.

### Step 1: Check the Knowledge Graph

```
search_nodes("domain: <domain>")   → open_nodes on results
search_nodes("<library name>")     → open_nodes on results
```

The KG contains curated vendor docs, project-specific pitfalls, and bug resolutions seeded by the skill. If you find what you need, use it — KG is authoritative for this project.

### Step 2: If KG has no docs for the library, search the web AND Context7

Run both in parallel — they complement each other:

```
# Context7 — version-specific API docs and code examples
resolve-library-id("<package-name>")  → query-docs(id, topic: "<what you need>")

# Web search — official docs, changelogs, migration guides for the specific version
WebSearch("<library> <version> <topic> docs")
```

Context7 is good for API signatures and usage patterns. Web search catches changelogs, breaking changes, and migration guides that Context7 may miss. Use the **specific version** in both queries — `"daisyui 5 form patterns"` not `"daisyui form patterns"`.

### When to repeat the lookup

- Switching to a different library mid-task
- Hitting an error that doesn't make sense — check KG for pitfalls first: `search_nodes("Pitfall")` + `search_nodes("<library>")`
- Using an API you haven't verified this session

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

