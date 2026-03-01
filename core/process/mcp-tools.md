---
version: 2.1.0
applies: Always
target: rules
priority: high
tags: [mcp, typescript-lsp, context7, knowledge-graph, tools, workflow]
---

# MCP Tools & Plugins

## Where to get information

| You need... | Use | NOT |
|-------------|-----|-----|
| Library conventions, pitfalls, known bugs | KG `search_nodes` → `open_nodes` | Reading files, grepping docs, guessing |
| Current API signatures, function params | Context7 `resolve-library-id` → `query-docs` | Outdated memory, guessing from types |
| Code structure, symbol locations, type info | typescript-lsp `goToDefinition`, `findReferences` | Grepping filenames, guessing paths |
| Session progress & next steps | Claude Code auto memory (`MEMORY.md`) | KG (wrong tool for ephemeral state) |

**KG is authoritative** for vendor/library information — it contains curated, project-specific docs seeded by the skill. If KG and Context7 disagree, trust KG. Context7 supplements with version-specific API details the KG may not cover.

**Vendor docs live in the KG only.** They are not deployed as files in the project. Never try to read vendor documentation from the filesystem — use `search_nodes` → `open_nodes`.

---

## typescript-lsp (code intelligence)

The typescript-lsp plugin provides two capabilities:

1. **Automatic diagnostics** — after every Edit/Write to TypeScript files, the language server analyzes changes and reports errors, missing imports, and type issues automatically. No manual invocation needed. If diagnostics appear, fix them before moving on.
2. **Code navigation** — precise, LSP-powered navigation that understands code structure, not just text.

**Available operations:**
- `goToDefinition` — jump to where a symbol is defined
- `findReferences` — find all usages of a symbol across the codebase
- `hover` — get type information and documentation for a symbol
- `documentSymbol` — list all top-level symbols in a file

### typescript-lsp triggers — navigate before you edit

| Before you... | Run first |
|---------------|-----------|
| Edit a function or method body | `goToDefinition` to verify exact location and current shape |
| Change an export's signature or name | `findReferences` to find all consumers |
| Navigate to a definition you haven't read | `goToDefinition`, not grep or filename guessing |
| Start working in an unfamiliar file | `documentSymbol` to see the structure |
| Delete or move an export | `findReferences` — if it has callers, update them first |

Use Claude Code's native Grep/Glob for: text search, file discovery, non-TypeScript files. Use typescript-lsp for: anything involving code structure, types, or symbol relationships.

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
| Hit an error in library code | `search_nodes("Pitfall")` + `search_nodes("<library name>")` | Someone may have already solved this |
| Something "should work" but doesn't | `open_nodes(["Vendor<Library>"])` and read pitfall observations | Check for recorded quirks before debugging blind |
| Plan an approach for a non-trivial task | `search_nodes("bug_resolution")` + domain search | Avoid repeating known mistakes |
| Work outside a domain rule's scope | `search_nodes("<primary keyword>")` | Find relevant context (auth, forms, payments, etc.) |

Domain-specific rules (`react-components`, `i18n`, `ssr-hydration`, etc.) include additional `open_nodes` / `search_nodes` triggers — follow those when those rules are active.

### KG write triggers — record immediately, not later

Don't batch these for "before moving on." Write to KG **right after the event**, while the details are fresh.

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

### Good vs bad entries

```
# Good bug_resolution — specific, searchable, has root cause
Entity: HydrationMismatchOnDateFormat (bug_resolution)
  "Symptom: hydration mismatch warning on pages with formatted dates"
  "Root cause: Date.now() differs server vs client"
  "Fix: format dates in loader, pass as string"

# Good vendor pitfall — saves hours next session
Entity: VendorReactRouter7Routing (vendor_doc) — add_observations:
  "Pitfall: clientLoader doesn't run on initial SSR — only on client navigations"
  "GitHub: https://github.com/remix-run/react-router/issues/11​234 — confirmed by maintainer"

# Bad — vague, unsearchable
Entity: DateBug (bug_resolution)
  "Fixed a date formatting issue"
```

---

## Context7 (version-specific library documentation)

Context7 fetches current, version-specific documentation and code examples for libraries.

**Tools:**
- `resolve-library-id` — resolve a package name to a Context7 library ID (MUST call first)
- `query-docs` — fetch documentation for a resolved library ID, optionally filtered by topic

### Context7 tool rules
1. ALWAYS call `resolve-library-id` before `query-docs` — you need the exact library ID
2. Use the `topic` parameter to narrow results (e.g. topic: "routing" for Next.js, topic: "hooks" for React)
3. If documentation looks wrong or outdated after fetching, do NOT blindly trust it — flag the concern

For **when** to use Context7 (verification discipline, version checking), see `core/process/engineering-discipline`.

---

## Playwright MCP (browser automation)

When using `browser_take_screenshot`, **always set `type: "jpeg"`** — never use PNG.
JPEG at the server's default quality produces significantly smaller images that fit
within context limits more efficiently. PNG screenshots are unnecessarily large.

