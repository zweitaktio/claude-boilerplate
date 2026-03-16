---
version: 2.4.0
applies: Always
target: rules
priority: high
tags: [mcp, context7, knowledge-graph, tools, workflow]
---

# MCP Tools & Plugins

## Where to get information

| You need... | Use | NOT |
|-------------|-----|-----|
| Library conventions, pitfalls, known bugs | KG `search_nodes` → `open_nodes` | Reading files, grepping docs, guessing |
| Current API signatures, function params | Context7 `resolve-library-id` → `query-docs` | Outdated memory, guessing from types |
| Session progress & next steps | Claude Code auto memory (`MEMORY.md`) | KG (wrong tool for ephemeral state) |

**KG is authoritative** for vendor/library information — it contains curated, project-specific docs seeded by the skill. If KG and Context7 disagree, trust KG. Context7 supplements with version-specific API details the KG may not cover.

**Vendor docs live in the KG only.** They are not deployed as files in the project. Never try to read vendor documentation from the filesystem — use `search_nodes` → `open_nodes`.

---

## Knowledge Graph (cross-session persistent context)

The knowledge graph stores vendor documentation, project decisions, architectural context, and bug resolutions
as named entities with typed relations. Data lives in `.memory/graph.jsonl` (human-readable, portable JSONL).

**Write operations:**
- `create_entities` — create nodes: `{name, entityType, observations[]}`
- `create_relations` — directed edges: `{from, to, relationType}`
- `add_observations` — append facts to existing entities

**Delete/correct operations:**
- `delete_entities` — remove entities and all their relations
- `delete_observations` — remove specific observations from an entity
- `delete_relations` — remove specific relations

**Read operations:**
- `search_nodes` — search across entity names, types, and observations
- `open_nodes` — retrieve specific entities by name
- `read_graph` — dump the entire graph (use sparingly on large graphs)

### Entity conventions

**Names:** PascalCase descriptive identifiers — `VendorDaisyui5`, `AuthStrategy`, `HydrationMismatchBug`

**Entity types:**

| Type | Purpose | Example |
|------|---------|---------|
| `vendor_doc` | Curated library/framework reference docs (seeded by skill) | `VendorDaisyui5`, `VendorReactRouter7Routing` |
| `architecture_decision` | Why a specific approach was chosen over alternatives | `AuthStrategy`, `StateManagementApproach` |
| `bug_resolution` | Symptom, root cause, fix for non-trivial bugs | `HydrationMismatchOnDateFormat` |
| `convention` | Project patterns and rules | `FormValidationPattern` |
| `dependency` | External service or library dependency notes | `StripeIntegration` |

**Vendor doc observations** (seeded by the skill):
- `"version: 1.1.0"` — template version for update comparison
- `"applies: daisyui@5"` — stack condition
- `"tags: daisyui, ui, components"` — searchable keywords
- `"domain: styling"` — loading group (routing, styling, backend, auth, i18n, cicd, tooling)
- `"source: vendor/daisyui-5.md"` — template source path
- Full markdown content body (without frontmatter)

**Relations** (active voice): `depends_on`, `replaced_by`, `requires`, `configures`, `integrates_with`

### KG read triggers — check before you act

| When you... | Query | Why |
|-------------|-------|-----|
| Start a task in any domain | `search_nodes("domain: <domain>")` then `open_nodes` | Load vendor docs for libraries you'll touch |
| Begin planning a task | `search_nodes("architecture_decision")` + domain search | Load past decisions and pitfalls before writing code |
| Switch domains mid-task | `search_nodes("domain: <new domain>")` then `open_nodes` | Each domain has its own pitfalls and patterns |
| Hit an error in library code | `search_nodes("Pitfall")` + `search_nodes("<library name>")` | Someone may have already solved this |
| Something "should work" but doesn't | `open_nodes(["Vendor<Library>"])` and read pitfall observations | Check for recorded quirks before debugging blind |
| Plan an approach for a non-trivial task | `search_nodes("bug_resolution")` + domain search | Avoid repeating known mistakes |
| Work outside a domain rule's scope | `search_nodes("<primary keyword>")` | Find relevant context (auth, forms, payments, etc.) |

Domain-specific rules (`react-components`, `i18n`, `ssr-hydration`, etc.) include additional `open_nodes` / `search_nodes` triggers — follow those when those rules are active.

### KG write triggers — record immediately, not later

The kg-discipline hook reminds you after 4+ code file edits without a KG write. Record findings while details are fresh:

| Event | Action | Format |
|-------|--------|--------|
| Resolved a bug that misled you or spanned >3 files | `create_entities` type `bug_resolution` | Symptom, Root cause, Fix, Area |
| Chose approach X over Y for a reason | `create_entities` type `architecture_decision` | Decision, Why, Rejected alternatives |
| Tried something that failed non-obviously | `add_observations` to relevant `vendor_doc` | `"Pitfall: {what} — {why}"` |
| Found a GitHub issue explaining behavior you hit | `add_observations` to relevant `vendor_doc` | `"GitHub: {url} — {summary}"` |
| Found a doc snippet that unblocked you | `add_observations` to relevant `vendor_doc` | `"Docs: {key finding} (source: {url})"` |
| Established a repeating pattern | `create_entities` type `convention` | Pattern, When to use, Example |

Before creating any entity, run `search_nodes` first — if a near-match exists, `add_observations` instead of duplicating.

If no `vendor_doc` entity exists for the library, create a minimal one: name `Vendor{PascalCaseName}`, type `vendor_doc`, first observation = the finding.

### Relate new entities — no orphans

After creating a `bug_resolution`, `architecture_decision`, or `convention` entity, immediately `create_relations` to link it to the relevant `vendor_doc`:

```
create_relations([{
  from: "HydrationMismatchOnDateFormat",
  to: "VendorReactRouter7Routing",
  relationType: "depends_on"
}])
```

| Entity type | Relation to vendor_doc | How to pick the target |
|-------------|----------------------|----------------------|
| `bug_resolution` | `depends_on` | The library where the bug manifests |
| `architecture_decision` | `depends_on` | The library the decision is about |
| `convention` | `configures` | The library the convention applies to |

If the entity spans multiple libraries, add a relation to each. If no `vendor_doc` exists for the library, skip — don't create a stub just for a relation.

### Good vs bad entries

```
# Good bug_resolution — specific, searchable, has root cause + relation
Entity: HydrationMismatchOnDateFormat (bug_resolution)
  "Symptom: hydration mismatch warning on pages with formatted dates"
  "Root cause: Date.now() differs server vs client"
  "Fix: format dates in loader, pass as string"
Relation: HydrationMismatchOnDateFormat -> VendorReactRouter7Routing (depends_on)

# Good vendor pitfall — saves hours next session
Entity: VendorReactRouter7Routing (vendor_doc) — add_observations:
  "Pitfall: clientLoader doesn't run on initial SSR — only on client navigations"
  "GitHub: https://github.com/remix-run/react-router/issues/11​234 — confirmed by maintainer"

# Bad — vague, unsearchable, no relation (orphan)
Entity: DateBug (bug_resolution)
  "Fixed a date formatting issue"
```

### KG in the planning-execution cycle

1. **Task start** (before coding): `search_nodes("architecture_decision")` + `search_nodes("domain: <domain>")` + `search_nodes("bug_resolution")` — load decisions, vendor docs, and known bugs
2. **During execution** (unexpected behavior): `search_nodes("Pitfall")` + `search_nodes("<library name>")` — check if already solved; if new, record immediately via `add_observations`
3. **Task end** (verification pass): confirm all non-obvious findings are recorded — this is a check, not batch-write time

---

## Context7 (version-specific library documentation)

Context7 fetches current, version-specific documentation and code examples for libraries.

**Tools:**
- `resolve-library-id` — resolve a package name to a Context7 library ID (MUST call first)
- `query-docs` — fetch documentation for a resolved library ID, optionally filtered by topic

### Context7 tool rules
1. Call `resolve-library-id` before `query-docs` to get the exact library ID (enforced by hook)
2. Use the `topic` parameter to narrow results (e.g. topic: "routing" for Next.js, topic: "hooks" for React)
3. If documentation looks wrong or outdated after fetching, do NOT blindly trust it — flag the concern

For **when** to use Context7 (verification discipline, version checking), see `core/process/engineering-discipline`.

---

## Playwright MCP (browser automation)

Screenshots use JPEG format (enforced by hook for context efficiency).

