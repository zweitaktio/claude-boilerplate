---
version: 1.9.0
applies: payload@3
target: rules
domain: backend
paths:
  - "**/collections/**"
  - "**/*.server.ts"
  - "**/payload*"
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
| GitHub | https://github.com/payloadcms/payload | Source, issues, examples |
| GitHub raw docs | https://github.com/payloadcms/payload/tree/main/docs | **Prefer for LLM access** — raw markdown, no rendering issues |
| Discord | https://discord.com/invite/payload | Community support |

## Core Rules
- **Never write SQL** — always use the Payload CMS API
- **Prefer standard CRUD API over custom endpoints** — use hooks for side effects
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

### Never wrap external API calls in a transaction

A transaction holds a Postgres connection in the `idle-in-transaction` state for the duration of every
`await` inside it.

A call to an external API inside a transaction leaves that connection idle for seconds or minutes. This
covers OpenAI, Stripe and any third-party HTTP call. The idle connection holds its row locks and its
pool slot.

Under load the pool starves. Unrelated services on the same Postgres instance then fail with a
connection timeout. This covers Hydra OAuth, the jobs queue and other applications.

Each external call is independent — there's no atomicity benefit. Run the external call first, then open a short transaction only around the DB writes that need to be atomic. If the DB writes are also independent (one row each), skip the transaction entirely.

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

## Payload MCP Plugin (`@payloadcms/plugin-mcp`)

When the project uses the Payload MCP plugin, Claude Code gets direct CRUD access to collections via `mcp__payload__*` tools (e.g. `findPages`, `updateTechnologies`, `createArticles`).

### Parameter format — top-level fields, no wrapper

**All collection fields are top-level parameters** alongside reserved keys (`id`, `locale`, `depth`, `draft`, etc.). The plugin destructures reserved keys and sends everything else as field data to `payload.update()` / `payload.create()`.

```
# ✅ Correct — fields are top-level
updatePages { id: 8, locale: "de", seoTitle: "New Title", noIndex: true }
createTechnologies { title: "Redis", slug: "redis", category: "database", _status: "published" }

# ❌ Wrong — data wrapper becomes a non-existent field, silently ignored
updatePages { id: 8, data: { seoTitle: "New Title" } }
createTechnologies { data: { title: "Redis", slug: "redis" } }
```

**The `data` wrapper pattern fails in silence.** The update reports success, and no field changes.

`data` is not a reserved key. It therefore lands in `fieldData` as a field named "data", and no
collection schema holds that field. Payload ignores an unknown field without an error.

### Layout fields (blocks with Lexical JSON)

Layout fields work through MCP. This covers nested Lexical rich-text JSON, a discriminated block type
union, and a deeply nested structure such as a column that holds text blocks. You need no REST API
fallback.

**Caveat:** The plugin generates its Zod validation schema from the running Payload config at server startup. If block definitions change, the backend server must be restarted for MCP to accept the new schema. A stale server will reject blocks with unrecognized fields.

## Pitfalls

### Migrations are not idempotent

Payload auto-generated migrations use bare `DROP TABLE`, `ADD COLUMN`, `CREATE INDEX`, `DROP CONSTRAINT` — none have `IF EXISTS` / `IF NOT EXISTS` guards. If a deploy partially runs a migration and crashes, retrying fails because already-applied statements error out. **Always add `IF EXISTS` / `IF NOT EXISTS` guards** to generated migration files before committing.

### Migrations auto-apply in dev mode

Dev server auto-pushes schema changes on startup. Only create migration files with `migrate:create` — never run `migrate` manually in local dev, or you'll get conflicts between auto-push and explicit migrations.

### plugin-mcp >=3.79.0 poisons globalThis.Response

The MCP handler creates `Response` from a different module scope, breaking `instanceof Response` checks for all subsequent route handlers. **Workaround:** wrap the endpoint handler with save/restore of `globalThis.Response` and re-wrap the response using the native constructor captured at module load time. See https://github.com/payloadcms/payload/issues/15856.

### plugin-mcp generates inaccurate block schemas

The MCP plugin's generated Zod schema uses wrong field names for blocks (e.g., maps `description` as `subtitle`, `body` as `content`). The plugin does NOT enforce `additionalProperties: false`, so actual Payload field names pass through and work. **Always use real Payload field names, not MCP schema names.**

### Array field named 'order' collides with _order column

Payload auto-generates an `_order` column for array row ordering. If you add a relationship field named `order` inside an array, both try to create `{table}_order_idx`. **Rename the field** (e.g., `relatedOrder`, `linkedOrder`) to avoid the index collision.

### payload.create() TS union type confusion

Payload's `create()` Options type is `RequiredData | (DraftData + draft: true)`. When a required field is missing, TypeScript reports "draft is missing" instead of the actual missing field. **Workarounds:** (1) pass the missing field explicitly (defaultValue only applies at runtime, not TS), or (2) pass `draft: false` to satisfy the union. Affects any collection with required fields.

### Localized blocks — never mix levels

A `blocks` or `layout` field can lack `localized: true` at the top level while its individual block
fields carry it. An API update with a `locale` parameter then overwrites the single shared layout array,
and the last locale update wins.

**Fix:** localize the layout field itself. Put `localized: true` on the blocks field. Remove
`localized: true` from the individual block fields inside it. Each locale then gets its own independent
block array.

### Optional boolean fields from checkboxes

An unchecked HTML checkbox sends no value. Conform and Zod then parse it as `undefined`. Payload ignores
an `undefined` field in an update, so the field keeps its previous value. **Always default to `false`**
when you pass an optional boolean field to Payload:
`marketingConsent: formData.marketingConsent ?? false`.

### `jobs.queue()` does not run jobs

`payload.jobs.queue({...})` only inserts a job record into the queue — it does NOT execute it. Jobs only run when (1) an `autoRun` schedule polls the job's queue, or (2) `jobs.runByID()` is called explicitly.

For on-demand workflows (triggered by hooks, endpoints, user actions), you must call `runByID()` after `queue()` or the job sits in the queue forever:

```typescript
const job = await req.payload.jobs.queue({
  workflow: 'recomputePrices',
  input: { ... },
})
// Fire-and-forget — don't await, don't block the request
req.payload.jobs.runByID({ id: job.id }).catch((err) =>
  req.payload.logger.error({ err, jobId: job.id }, '[Jobs] runByID failed'),
)
```

If you have a `crons:` config on the workflow, scheduled runs handle execution; otherwise treat `queue()` + `runByID()` as a single unit.

### An omitted `limit` is 10, not "unlimited"

`find()` resolves a missing limit to 10. The code is
`const sanitizedLimit = limit ?? (usePagination ? 10 : 0)`.

A list then renders its first 10 rows, with no pagination UI and no error. A client-side filter over
that truncated page shows an empty state while the records exist.

**Pass `limit: 0` explicitly when you want everything.** Two exceptions are safe. The first reads only
`totalDocs`, which is the full match count and ignores `limit`. The second is a deliberate `limit: 1`
existence check.

When you add a limit, check that the `where` scopes to the right parent. An unlimited and unscoped
`find` is worse than a truncated one.

### `data` in `beforeChange` is not the request body

`beforeValidate` fills in every field the caller omitted, from stored values, before `beforeChange` runs. So `'field' in data` is **always true**, and a guard asking "did the caller try to write this?" by testing for the key rejects every update. **Compare against `originalDoc`** instead — normalise first, since relationship entries arrive as raw ids or populated docs depending on `depth`. Signal sanctioned callers with `req.context`, as Payload does internally.

Related: field-level `access.update` is not a guard. Payload **discards a denied field without raising an error** — field access exists to make the admin panel render read-only. A hook refuses; an access rule only strips.

### `filterOptions` runs as validation on every write, not just in the admin picker

It receives the **whole** stored array (see the `beforeValidate` entry above), so a value the caller never touched is re-checked on every write. An ownership-scoped `filterOptions` therefore makes a document permanently uneditable by anyone but the owner of each referenced row. Scope by the same `Where` the collection's own `read` uses, not by ownership.

For a polymorphic relationship you **can** branch on the target collection. `FilterOptionsProps` passes
`relationTo`, which names the single collection under validation, plus `req`. Payload loops over the
collections and calls the function once for each one.

A `filterOptions` stricter than the collection's own `read` is the smell. The caller can already see the
document. A refusal of the *reference* then breaks writes only.

Two things make a 400 here weak evidence.

First, a collection `beforeChange` hook runs *before* field validation, and it throws first. Tell the two
apart by the message. Text such as "do not belong to this journey" comes from your hook.
`"This field has the following invalid selections"` comes from `filterOptions`.

Second, a **nonexistent id** also yields "invalid selections", because the query matches no row.

### A `hasMany` write replaces the whole array

`update({ data: { media } })` does not diff — `upsertRow` deletes existing rows by path and reinserts the set. Two callers who read `[1,2]` and write `[1,2,3]` / `[1,2,4]` end with one set silently gone and **both told they succeeded**. None of the obvious fixes work:

| Does not fix it | Why |
|---|---|
| A transaction | READ COMMITTED — both still read the pre-write array |
| Verify-and-retry | A point-in-time read is not a lock: it excludes writers before it, none after |
| Compare-and-swap on a version column | `where` is not a conditional write — the adapter resolves it to an id under an unlocked `SELECT`, then writes by primary key |
| `SELECT … FOR UPDATE` | Does not serialise through drizzle |

**Never write a `hasMany` array from a value you read earlier.** Serialise the read *and* the write, or
send a delta to something that merges.

No lock makes a caller safe when it holds the list across a user interaction, such as a form's default
values. The window *is* the interaction.

### `createdAt` is client-writable

Payload accepts a supplied `createdAt` through the REST API, on both create and update. The server does
not pin it.

Never read `createdAt` as "when this row was made". Use the server clock at hook time instead. Never
treat it as audit evidence.

For a trustworthy timestamp, add a separate field with `access.update: () => false`, and set it in
`beforeChange`.

Never "fix" `createdAt` itself before you check the callers. Some flows set it as domain data, and that
is legitimate. An order-by on `createdAt` is a spoofing nuisance rather than an authorization hole,
*only if* the query is access-scoped.

### A localized field you can read is not necessarily one you can query

**Reading** a localized field under a locale with no stored value falls back to `defaultLocale` (unless `fallback: false`). **Querying** it in a `where` clause matches only the value stored for that locale — there is no fallback. So link generation and sitemaps happily emit a URL built from the fallback value, and the detail route's lookup 404s. If a list route renders under a locale but the detail route 404s, check whether its `where` filters a localized field. Fix by populating every locale, making the field non-localized, or looking up by `id`.

### A migration is two files — `index.ts` lands in the same commit

`migrate:create` writes the migration **and** rewrites `migrations/index.ts` to register it.
`payload migrate` runs the array in `index.ts`. A file missing from that array does not exist to the
runner.

Dev never catches this. The dev server auto-applies a schema change and never consults `index.ts`. The
defect appears only on staging or production.

A hand-written path list for `git commit --only` (see `core/tooling`) makes the omission more likely.
Review does not catch it either, because the diff shows a well-formed migration.

After `migrate:create`, run `git status --porcelain <migrations dir>` and commit both files. A peer's
dirty `index.ts` is an unshipped schema change, never a leftover side effect.

### A data migration must read locales from the data, not the config

The config holds the *final* locale list the moment you edit it. The `_locales` Postgres enum gains a
value only when the migration that adds it runs.

A migration that loops over `config.localization.localeCodes` therefore queries a locale the database
does not know yet, whenever that migration sorts **before** the one that adds the locale. Migrations run
in filename order. The natural authoring order puts the backfill first, and that order is the broken
one. It passes locally, because the dev auto-push already widened the enum.

Derive the list from the rows you touch instead:
`SELECT DISTINCT "_locale"::text FROM "<table>_locales"`. This is also more correct, because a locale
with no rows has nothing to backfill.

### Changing a workflow's `queue` strands its seeded job

A pending job carries the queue it was created with. An `autoRun` cron drains its own queue only.

`jobs.queue({ workflow })` reads the queue from the workflow config *at insert time*. An edit to
`queue:` therefore affects future inserts only. An idempotent seeder that matches on `workflowSlug`
alone finds the stale job and skips.

The workflow then stops in silence. The row exists, `completedAt` is null, and `run?queue=<new>` reports
`noJobsRemaining: true`.

Match the existence check on the queue as well. Then **delete the stranded row before the next run**. A
`repeated: true` re-queue skips when more than one unfinished job exists, so a stale row makes the
handler decline to schedule its successor.

Detect the problem with `GET /api/payload-jobs?depth=0`. Look for a pending row whose `queue` differs
from the one the workflow now declares.

### Two auth collections make `req.user` a union

With `users` + `admins`, `req.user` is typed `Admin | User`, and a types regen bakes a required `collection` discriminator into both. Permission helpers declaring `User | null` then fail to compile. **Widen the consuming signatures to `Admin | User | null`** — an existing `if (isAdmin(user)) return true` guard already narrows the rest — and add `collection: '<slug>'` to mock fixtures.

### Payload caches its instance on `globalThis` across HMR

Next dev HMR reloads a route module. It does **not** reload an already-registered Payload job handler or
a config-imported module. A fresh request therefore keeps executing the old code. The module's own
`console.log` prints the stale value while the file on disk is correct.

Restart the dev server after you edit anything the Payload config reaches. This covers a collection hook
and a jobs-queue task.

A custom endpoint fails in two ways. A *new* endpoint returns 404, because the route table is built at
init. An *edited* endpoint returns 200 and runs the old code. The second failure is silent and reads as
a passing test.

Confirm the behaviour from the server log. Never confirm it by a re-read of the source.

### Admin component paths need the `@/` alias, not bare `src/`

A bare `'src/…#Export'` specifier in `admin.components` resolves only through the tsconfig `baseUrl`.

The TS 6 migration drops `baseUrl`. `importMap.js` then holds specifiers that Next cannot resolve, and
the build fails with `Module not found: Can't resolve 'src/components/…'`. The file exists, and `tsc`
passes.

Reference an admin component through the `@/` path alias. Then re-run `generate:importmap`.

### A native `Buffer` in a JSON column 500s the write

A spread of `sharp.metadata()` into a JSON or JSONB column fails. `JSON.stringify` throws
`TypeError: Method get TypedArray.prototype.length called on incompatible receiver`.

`.withMetadata()` re-attaches EXIF, so `metadata()` returns an `exif` **Buffer**. A buffer from a native
binding is cross-realm inside the Next.js runtime, and `Buffer.prototype.toJSON` fails its internal
brand check.

Delete `exif` together with `icc`, `iptc` and `xmp`. Serialise the column one key at a time, so a future
non-serialisable value degrades to `null` instead of a failed write.

`tsc`, ESLint and the unit tests all pass. A copy of the hook in plain Node also succeeds, because a
single-realm process has no Buffer mismatch. Only the running server reproduces the failure.

## Known Issues

### `serverURL` breaks frontend media URLs (403s)

**Symptom:** 403 on all frontend images after adding `serverURL` to the Payload config.

**Cause:** Payload prepends `serverURL` to `media.url`, turning relative paths (`/api/media/file/x.jpg`)
into absolute URLs. A frontend image service that only recognizes *relative* Payload paths lets the
absolute URL fall through to domain validation and blocks it.

**Fix:** in the image-URL processing, strip the backend origin (`API_URL` minus the `/api` suffix) from
absolute URLs before the Payload-endpoint check — handle both relative and absolute `media.url` forms.

### Migrations auto-apply in dev — never run `migrate` manually

**Symptom:** migration errors on dev-server startup, or "table/column already exists" after a manual
`yarn payload migrate` in local dev.

**Cause:** Payload's dev mode applies pending migrations automatically on startup. A manual `migrate`
double-applies or races the dev server's own run.

**Fix:** in local dev use only `yarn payload migrate:create` (generate the file); let the dev server
apply it on restart. `migrate` is for production/staging where the server doesn't auto-apply.

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

```scss
// ComponentName.module.scss
.component {
  background: var(--theme-bg);
  color: var(--theme-text);
  padding: var(--base);
  border-radius: var(--radius-m);
  &:hover { background: var(--theme-elevation-50); }
}
```

Key CSS variables: `--theme-bg`, `--theme-text`, `--theme-border-color`, `--theme-elevation-*`, `--base`, `--radius-s/m/l`.

### `drizzle session.execute()` doesn't serialize FOR UPDATE locks

Raw SQL with `FOR UPDATE`, or with `FOR UPDATE NOWAIT`, does NOT serialize concurrent transactions when
you run it through `req.payload.db.session(transactionID).db.execute(sql\`...\`)`. This was observed on
`@payloadcms/drizzle@3.82.x` through `3.84.x`.

The same SQL through a raw `pg` client blocks the second caller until the first commits. Through drizzle
the second `.execute()` returns at once, and it does not wait for the first transaction to commit.

Two causes fit the evidence. The lock releases at the end of the statement rather than at the end of the
transaction. Or the SQL routes through a connection outside the transaction.

This breaks any concurrency control built on `SELECT ... FOR UPDATE` (stock holds, balance checks, idempotency guards). Symptom: race tests pass intermittently or never serialize at all under parallel load.

**Workarounds:**
- Use Postgres advisory locks (`pg_advisory_xact_lock(key)`) — these are tied to the transaction and respected by drizzle's session routing.
- Add a `unique` index on the column you're guarding (e.g. `stripePaymentIntentId`) and let the DB raise a constraint violation on the loser. Catch it and treat as the "already created" branch.
- Drop into raw `pg` for the locking query when you need true row-level serialization.

Avoid relying on `FOR UPDATE` through drizzle until upstream confirms a fix.

### Migration table after prod data import
When importing prod data to dev, the `payload_migrations` table reflects prod's state. Dev mode creates a `dev` entry with `batch = -1`. To reset and allow dev mode to push schema changes:

```bash
docker exec <container> psql -U postgres -d "<database>" -c "TRUNCATE payload_migrations;"
```

Then restart the dev server — it will auto-push schema changes.

## Custom Endpoints

**Minimize custom endpoints.** Use Payload's standard API for:
- CRUD on collections (find, create, update, delete)
- Filtering with `where`, pagination, sorting
- Auth-filtered data (via access control)
- Relationship depth

**Use hooks for side effects** instead of custom endpoints:

```typescript
// ✅ Use afterChange hook — not POST /api/orders/send-email
afterChange: [async ({ doc, previousDoc }) => {
  if (doc.status === 'shipped' && previousDoc?.status !== 'shipped') {
    await sendShippedEmail(doc)
  }
}]
```

**Custom endpoints ONLY for:**
- External API integrations (Stripe webhooks, payment intents)
- Atomic multi-collection transactions
- Webhook handlers (signature verification)
- Operations requiring server-side secrets

### File structure

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

Apply in collection config. Declare every operation, including `create`:
```typescript
access: {
  create: adminOnly(),
  read: adminOrScope('payload:customers:read'),
  update: adminOrScopeOrSelf('payload:customers:update'),
  delete: adminOnly(),
}
```

### An undeclared operation falls back to any authenticated user

Payload fills each operation you do not declare with `defaultAccess`. That function returns
`Boolean(user)`. A collection that declares `read`, `update` and `delete` therefore accepts a
`create` from every authenticated principal. A service user with a static API key is such a
principal.

```js
// payload/dist/collections/config/defaults.js:57-65 — an omitted operation gets defaultAccess
collection.access = { create: defaultAccess, /* … */ ...collection.access || {} }
// payload/dist/auth/defaultAccess.js:1
export const defaultAccess = ({ req: { user } }) => Boolean(user)
```

A field rule does not prevent this. The field hook runs a rule only when that rule exists:

```js
// payload/dist/fields/hooks/beforeValidate/promise.js:217
if (field.access && field.access[operation]) { /* … */ }
```

A `role` field that declares `access.update` alone still accepts a `role` on the create. `POST
/api/users` with `role: 'admin'` then makes an admin. Declare `create` on the collection **and** on
the `role` field, both as `({ req: { user } }) => isSuperAdmin(user)`.

**An auth collection has five operations.** `defaults.js:62` also fills `unlock`. An undeclared
`unlock` lets any authenticated principal clear the lockout that `maxLoginAttempts` sets. Declare
all five.

Payload reports no error for this defect. The admin panel still renders the role dropdown read-only
for a principal who is not a super-admin. An OAuth2 login through `payload-oauth2` still works,
because it creates the user with the Local API, which defaults to `overrideAccess: true`.

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

### Default depth over-fetches

Payload's `find()` and `findByID()` default to deep relationship population. This causes N+1 queries and returns massive payloads for collections with many relationships.

```typescript
// ❌ Default depth — fetches entire relationship tree
const products = await payload.find({ collection: 'products' })

// ✅ Minimal depth — only populate what you need
const products = await payload.find({
  collection: 'products',
  depth: 1,                    // Only direct relationships
  select: {                    // Only needed fields
    title: true,
    price: true,
    category: true,
  },
})
```

**Rules:**
- Always specify `depth: 0` or `depth: 1` unless you need nested relationships
- Use `select` to limit returned fields for list views
- For admin UI custom components, the full document is already available — don't re-fetch