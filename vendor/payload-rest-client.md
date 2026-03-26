---
version: 1.3.1
applies: payload-rest-client
target: rules
domain: backend
paths:
  - "**/collections/**"
  - "**/*.server.ts"
  - "**/payload*"
tags: [payload, rest-client, api, fetch, typed-client]
---

# payload-rest-client

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| npm | https://www.npmjs.com/package/payload-rest-client | Package info |
| GitHub | https://github.com/rilrom/payload-rest-client | Source, README |
| Payload REST docs | https://payloadcms.com/docs/rest-api/overview | Underlying API reference |

## Critical: `where` not `filter`

The query parameter is `where`, NOT `filter`. Using `filter` is **silently ignored** and returns unfiltered results.

```typescript
// ✅ Correct
client.collections.posts.find({
  where: { status: { equals: 'published' } },
  limit: 10,
  sort: '-createdAt',
})

// ❌ Wrong — silently returns ALL records
client.collections.posts.find({
  filter: { status: { equals: 'published' } },
})
```

## Available Query Parameters

```typescript
type FindParams = {
  sort?: string           // e.g., '-createdAt' for descending
  where?: Filter<DOC>     // Query filters
  limit?: number          // Max results
  page?: number           // Pagination
  select?: SELECT         // Field selection
  depth?: number          // Relationship population depth
  locale?: LOCALES        // Localization
  fallbackLocale?: LOCALES
}
```

## Filter Operators

```typescript
{ equals: value }
{ not_equals: value }
{ greater_than: value }
{ greater_than_equal: value }
{ less_than: value }
{ less_than_equal: value }
{ like: string }
{ contains: string }
{ in: string }
{ not_in: string }
{ exists: boolean }
```

## Logical Operators

```typescript
// AND
where: { and: [{ status: { equals: 'published' } }, { author: { equals: 'john' } }] }

// OR
where: { or: [{ status: { equals: 'draft' } }, { status: { equals: 'published' } }] }
```

## Authentication Setup

Use an HTTP client (e.g., `ky`) with API key authentication for server-side requests:

```typescript
import ky from "ky"

const client = ky.extend({
  prefixUrl: process.env.PAYLOAD_API_URL,
  headers: {
    users: `API-Key ${process.env.PAYLOAD_API_KEY}`,
  },
})

const data = await client.get("api/collections/journeys").json()
```

Key rules:
- Always use the `users` header with `API-Key` prefix for server-to-server auth
- Store the API key in environment variables — never hardcode
- Use `ky.extend()` to configure the base client once, reuse everywhere
- The header name `users` corresponds to the Payload auth collection name

## Pitfalls

### `select` doesn't include implicit fields

The `select` parameter only returns explicitly listed fields. Implicit fields like `id` are NOT included automatically. If you need `id` in the response, either omit `select` or include a real collection field to get a minimal response (Payload always includes `id` when at least one field is selected via the REST API — but the TypeScript type won't reflect it).

### `in` operator expects a comma-separated string

The `in` and `not_in` filter operators expect a comma-separated string, not an array. TypeScript enforces this, but it's easy to pass an array by mistake:

```typescript
// ✅ Correct — comma-separated string
where: { status: { in: 'pending,confirmed,processing' } }

// ❌ Wrong — array (TypeScript will reject this)
where: { status: { in: ['pending', 'confirmed', 'processing'] } }
```

### Where type too strict for conditional properties

Payload's `Where` type uses a strict index signature that conflicts with TypeScript's inference for inline objects with conditional (optional) properties. Optional fields infer as `T | undefined`, which doesn't satisfy the index signature.

**Workaround:** For generic utility functions that build where clauses dynamically, type the where parameter as `any` and narrow at the consumer level:

```typescript
// ✅ Permissive in the utility, strict at the call site
function buildQuery(where: any) { /* ... */ }

// ❌ Inline conditional where causes TS error
const where: Where = {
  status: { equals: 'active' },
  ...(categoryId && { category: { equals: categoryId } }),
  // TS error: index signature not compatible
}
```
