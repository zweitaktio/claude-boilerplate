---
version: 1.3.0
applies: payload
target: rules
paths:
  - "scripts/payload-*"
  - "backend/**"
tags: [payload, api, scripts, rest, mcp, context-mode]
---

# Payload CMS Data Access

## Prerequisites

Payload MCP requires two things:

1. **Backend plugin**: `@payloadcms/plugin-mcp` added to your Payload config (project dependency)
2. **Claude MCP server**: `claude mcp add payload --transport http --scope project -- http://localhost:3000/api/plugin/mcp`

The backend must be running for MCP tools to work. If `mcp__payload__*` tools are unavailable, fall back to Workflow 1 (context-mode + payload-api.sh) for all operations.

## Choosing a Workflow

Two workflows depending on the task. Choose the right one.

## Workflow 1: Content Work (context-mode + payload-api.sh)

When working with CMS content at scale — reviewing, writing, or translating — route reads through **context-mode + `payload-api.sh`**. This keeps raw JSON in the sandbox; only your printed summary enters context.

**When to use:**
- **Reviewing** — browsing collections, auditing SEO fields, checking content quality
- **Writing** — reading existing entries to understand patterns before creating/updating content
- **Translating** — comparing locales side-by-side, finding untranslated fields, reading source text before writing translations

Any content task that involves reading multiple entries or large responses should start here.

```bash
# Review — scan a collection for issues
mcp__plugin_context-mode_context-mode__execute({
  command: "bash ./scripts/payload-api.sh GET '/technologies?limit=50&locale=de&depth=0' --jq '.docs[] | {id, title, category, seoTitle}'",
  language: "jsonl",
  code: "print each entry, flag any with missing seoTitle"
})

# Translation — compare locales in one call
mcp__plugin_context-mode_context-mode__batch_execute({
  commands: [
    "bash ./scripts/payload-api.sh GET '/technologies?limit=50&locale=en&depth=0' --jq '.docs[] | {id, title, seoTitle, seoSummary}'",
    "bash ./scripts/payload-api.sh GET '/technologies?limit=50&locale=de&depth=0' --jq '.docs[] | {id, title, seoTitle, seoSummary}'"
  ],
  language: "jsonl",
  code: "compare en vs de, list entries missing German translations"
})

# Writing — read existing entry with full rich text before rewriting
mcp__plugin_context-mode_context-mode__execute({
  command: "bash ./scripts/payload-api.sh GET '/technologies/42?depth=0&locale=en'",
  language: "json",
  code: "extract summary text content (strip rich text nodes), seoTitle, seoSummary, related IDs"
})
```

**Rules for this workflow:**
- **Read-only** — use `--jq` to select only the fields you need (skip for single-entry reads where you need the full document)
- **Use context-mode** (`execute` or `batch_execute`) for sandbox processing
- After reading, use `index` + `search` if you need to reference the data again later
- Writes still go through Workflow 2 (MCP tools) — this workflow is for the read side of content tasks

### payload-api.sh reference

```bash
bash ./scripts/payload-api.sh GET '<path>' [--jq '<filter>']

# Common patterns
bash ./scripts/payload-api.sh GET '/technologies?limit=50&depth=0&locale=en'
bash ./scripts/payload-api.sh GET '/technologies/42?depth=0&locale=en'
bash ./scripts/payload-api.sh GET '/pages?limit=20&locale=de' --jq '.docs[] | {id, title, slug}'
bash ./scripts/payload-api.sh GET '/menus/1?locale=en&depth=0' --jq '.items | length'
```

Env: `PAYLOAD_URL` overrides the default `http://localhost:3000`.

## Workflow 2: CRUD Operations (MCP tools)

For targeted reads (single entry by ID), creates, updates, and deletes — use the Payload MCP tools (`mcp__payload__*`). These are precise operations where the response fits comfortably in context.

**When to use:** fetching a specific entry to edit, creating/updating/deleting entries, any write operation.

All write operations use MCP tools exclusively (enforced by hook).

### Usage Patterns

**All fields are top-level parameters.** The plugin destructures reserved keys (`id`, `locale`, `depth`, etc.) and sends the rest as field data. A `data` wrapper becomes a non-existent field that Payload silently ignores.

```
# Find with filters (small result sets only — use Workflow 1 for bulk reads)
findTechnologies { where: { slug: { equals: "react" } }, locale: "en", limit: 1 }

# Update — fields are top-level, NOT wrapped in data
updateTechnologies { id: 89, locale: "de", seoTitle: "..." }

# Create — fields are top-level
createTechnologies { title: "...", slug: "...", category: "...", _status: "published" }
```

### Payload Validation (enforced on all writes)

**CRITICAL:** Every write operation (create/update) must follow this sequence:

1. **Build the payload** — construct the full JSON object with all fields
2. **Validate** — check the payload before sending:
   - Valid JSON (parseable, no syntax errors)
   - Empty objects (`{}`) in arrays or nested structures — Payload rejects these (hook warns)
   - `null` values for enum fields cause silent corruption — omit the field instead (hook warns)
   - SEO limits: `seoTitle` max 60 chars, `seoSummary` max 160 chars
   - Relation fields contain IDs (numbers), not populated objects
3. **Send** — only after validation passes, call the MCP tool

**Empty objects are prohibited.** Arrays of blocks, columns items, or any nested structure must never contain `{}`. If a slot is unused, remove it from the array entirely. Payload will reject or silently corrupt data with empty objects.

**Write to `/tmp/` first for complex payloads.** For updates with layout blocks, rich text, or other deeply nested structures: write the JSON to a temp file, validate it, then send.

## Decision Table

| Task | Workflow | Tool |
|------|----------|------|
| List entries to review content | 1 | context-mode + payload-api.sh --jq |
| Compare en/de translations | 1 | context-mode batch_execute |
| Audit SEO fields across a collection | 1 | context-mode + payload-api.sh --jq |
| Read existing content before rewriting | 1 | context-mode execute |
| Read source locale before translating | 1 | context-mode execute |
| Scan for untranslated entries | 1 | context-mode batch_execute |
| Fetch one entry by ID for a targeted edit | 2 | MCP find* (with where/id filter) |
| Create a new entry | 2 | MCP create* |
| Update/write content to an entry | 2 | MCP update* |
| Delete an entry | 2 | MCP delete* |
