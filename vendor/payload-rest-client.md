---
version: 1.1.0
applies: payload-rest-client
target: graph
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
