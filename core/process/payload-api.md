---
version: 2.0.0
applies: payload
target: rules
paths:
  - "backend/**"
tags: [payload, mcp, migrations]
---

# Payload CMS Data Access

All Payload data access goes through the `@payloadcms/plugin-mcp` server. There is no REST API workflow — `mcp__payload__*` tools are the only path.

## Prerequisites

1. **Backend plugin**: `@payloadcms/plugin-mcp` added to your Payload config (project dependency)
2. **MCP API key**: created in the Payload admin panel under MCP API Keys (the plugin rejects requests without a Bearer token)
3. **Claude MCP server**: `claude mcp add payload --transport http --scope project --header "Authorization: Bearer MCP-USER-API-KEY" -- http://localhost:3000/api/mcp`

The backend must be running for MCP tools to work.

## Usage Patterns

**All fields are top-level parameters.** The plugin destructures reserved keys (`id`, `locale`, `depth`, etc.) and sends the rest as field data. A `data` wrapper becomes a non-existent field that Payload silently ignores.

```
# Find with filters
findTechnologies { where: { slug: { equals: "react" } }, locale: "en", limit: 1 }

# Update — fields are top-level, NOT wrapped in data
updateTechnologies { id: 89, locale: "de", seoTitle: "..." }

# Create — fields are top-level
createTechnologies { title: "...", slug: "...", category: "...", _status: "published" }

# Delete
deleteTechnologies { id: 89 }
```

## Payload Validation (enforced on all writes)

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

## Migrations

### Idempotency Review (required before commit)

Every migration must be idempotent — safe to re-run if it partially fails during deployment. Before committing a migration file, review every statement and apply these guards:

| Statement | Guard |
|-----------|-------|
| `ALTER TYPE ... ADD VALUE` | `ADD VALUE IF NOT EXISTS` |
| `CREATE TABLE` | `CREATE TABLE IF NOT EXISTS` |
| `DROP TABLE` | `DROP TABLE IF EXISTS ... CASCADE` |
| `ALTER TABLE ... ADD COLUMN` | `ADD COLUMN IF NOT EXISTS` |
| `ALTER TABLE ... DROP COLUMN` | `DROP COLUMN IF EXISTS` |
| `ALTER TABLE ... ADD CONSTRAINT` | `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT` |
| `ALTER TABLE ... DROP CONSTRAINT` | `DROP CONSTRAINT IF EXISTS` |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` | `CREATE INDEX IF NOT EXISTS` |
| `DROP INDEX` | `DROP INDEX IF EXISTS` |
| `DROP TYPE` | `DROP TYPE IF EXISTS` |
| `DISABLE ROW LEVEL SECURITY` before `DROP TABLE` | Remove — `DROP TABLE IF EXISTS CASCADE` handles it |

Split large migrations into sequential `db.execute` steps grouped by concern for clearer failure isolation.

The `down()` migration does not need idempotency guards (it's a destructive rollback, not re-runnable).
