---
version: 1.2.0
applies: payload@3
target: graph
priority: high
tags: [payload, cms, collections, api, backend, database]
---

# Payload CMS 3

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Official docs | https://payloadcms.com/docs | v3 docs |
| llms.txt | https://payloadcms.com/llms.txt | Fetch via WebFetch |
| API reference | https://payloadcms.com/docs/local-api/overview | Local API |
| REST API | https://payloadcms.com/docs/rest-api/overview | REST endpoints |
| Context7 | `/payloadcms/payload` | Good coverage |
| GitHub | https://github.com/payloadcms/payload | Source, issues, examples |
| Discord | https://discord.com/invite/payload | Community support |

## Core Rules
- **Never write SQL** — always use the Payload CMS API
- Use Payload transactions for multi-record atomic operations
- Use `Where` type for query filters

## Where Clause Syntax (Payload 3.0+)

```typescript
import { Where } from 'payload'

// Correct operators
where.field = { equals: 'value' }
where.field = { not_equals: null }
where.id = { in: [1, 2, 3] }
where.id = { not_in: [4, 5] }
where.date = { greater_than: startDate }
where.price = { less_than_equal: 100 }
where.title = { like: '%bike%' }
where.desc = { exists: true }

// OR conditions
where = {
  or: [
    { status: { equals: 'active' } },
    { featured: { equals: true } }
  ]
}
```

**Use `not_equals`, `not_in` — NOT nested `not` objects.**

```typescript
// ❌ Wrong (causes type errors)
where.field = { not: { equals: null } }
```

## Transactions

Wrap multi-record operations in transactions:

```typescript
let txId: string | undefined
let txReq = req

if (req.payload.db.beginTransaction) {
  const id = await req.payload.db.beginTransaction()
  if (id !== null) {
    txId = String(id)
    txReq = { ...req, transactionID: id }
  }
}

try {
  for (const item of items) {
    await txReq.payload.create({ collection: 'items', data: item })
  }
  if (txId) await req.payload.db.commitTransaction(txId)
} catch (error) {
  if (txId) await req.payload.db.rollbackTransaction(txId)
  throw error
}
```

Key points:
1. Use `txReq` (with transactionID), not original `req`
2. Always rollback on error
3. Rethrow after rollback

## File Upload via REST API

```typescript
const formData = new FormData()
formData.append('file', fileObject)  // MUST be named 'file'

// Simple fields: append directly
formData.append('altText', 'description')

// Complex/nested data: use _payload
formData.append('_payload', JSON.stringify({
  metadata: { author: 'John' }
}))

// Send — DO NOT set Content-Type (breaks multipart boundary)
const response = await fetch('/api/media', {
  method: 'POST',
  body: formData,
  credentials: 'include'
})
```

## Logging (Pino)

Payload uses Pino for structured logging. **Syntax: object FIRST, message SECOND.**

```typescript
// ✅ Correct — object first, message second
req.payload.logger.info({ userId, action: 'login' }, '[Auth] User logged in')
req.payload.logger.error({ error: err.message, orderId }, '[Orders] Failed')

// ❌ Wrong — object won't appear in JSON output!
req.payload.logger.info('User logged in', { userId })

// ❌ Never use console
console.log('message')
```

### Headers Access

Headers is a Web API object — use `.get()`:

```typescript
req.payload.logger.info({
  auth: req.headers?.get('authorization'),
  userAgent: req.headers?.get('user-agent'),
  ip: req.headers?.get('x-forwarded-for') || 'unknown',
}, 'Request received')
```

### Log Levels
- `info` — Normal operations
- `error` — Failures
- `warn` — Recoverable issues
- `debug` — Development only

## Known Issues

### PostgreSQL identifier length limit
PostgreSQL has a 63-character limit for table and enum names. Payload auto-generates long names for nested fields. Use `dbName` and `enumName` for long paths:

```typescript
{
  name: 'availableForDeliveryMethods',
  type: 'select',
  hasMany: true,
  dbName: 'pay_del_methods',        // junction TABLE name
  enumName: 'enum_pay_del_methods', // ENUM TYPE name (must differ from dbName!)
}
```

### Admin UI uses SCSS modules
Payload's admin UI uses SCSS modules internally. Custom admin components must follow Payload's styling patterns, not the project's Tailwind setup.

### Migration table after prod data import
When importing prod data to dev, the `payload_migrations` table reflects prod's state. Dev mode creates a `dev` entry with `batch = -1`. To reset and allow dev mode to push schema changes:

```bash
docker exec <container> psql -U postgres -d "<database>" -c "TRUNCATE payload_migrations;"
```

Then restart the dev server — it will auto-push schema changes.

## Custom Endpoints

Extract complex endpoints to separate files:

```
collections/{Name}/
├── {Name}.ts              # Collection config
└── endpoints/
    ├── validate.ts        # POST /api/{name}/validate
    └── export.ts          # GET /api/{name}/export
```

### Request helpers pattern

```typescript
// lib/request-helpers.ts
export const errorResponse = (message: string, status = 400) =>
  Response.json({ error: message }, { status })

export const successResponse = (data: unknown, status = 200) =>
  Response.json(data, { status })

export const parseJsonBody = async <T>(req: PayloadRequest): Promise<T> => {
  const body = await req.json?.()
  if (!body) throw new Error('Missing request body')
  return body as T
}
```

## Access Control with OAuth2

When using OAuth2 (e.g. Ory Hydra), define reusable access policies:

```typescript
// lib/access-control.ts
import type { Access } from 'payload'

export const adminOnly = (): Access => ({ req }) => isAdmin(req)

export const adminOrScope = (scope: string): Access =>
  ({ req }) => isAdmin(req) || hasScope(req, scope)

export const adminOrScopeOrSelf = (scope: string, idField = 'id'): Access =>
  ({ req, id }) => isAdmin(req) || hasScope(req, scope) && getOAuth2User(req)?.sub === String(id)
```

Apply in collection config:
```typescript
access: {
  read: adminOrScope('payload:customers:read'),
  update: adminOrScopeOrSelf('payload:customers:update'),
  delete: adminOnly(),
}
```

## Audit Logging

Structured security event logging via Pino:

```typescript
import type { PayloadRequest } from 'payload'

export const auditLog = (req: PayloadRequest, event: {
  event: string
  userId?: string
  reason?: string
  resource?: string
}) => {
  req.payload.logger.info({
    audit: true,
    ...event,
    ip: req.headers?.get('x-forwarded-for') || 'unknown',
  }, `audit: ${event.event}`)
}
```

Log security-relevant events: `login_success`, `login_failure`, `token_refresh`, `password_change`, `access_denied`.