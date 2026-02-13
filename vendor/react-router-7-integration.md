---
version: 1.2.0
applies: react-router@7
target: graph
type: integration
tags: [conform, zod, oauth2, feature-modules, auth, validation, known-issues]
---

# React Router 7 Integration

Project-specific patterns for integrating React Router 7 with our stack. For core RR7 reference, see `VendorReactRouter7Index`.

## Documentation Sources

| Source | URL | Notes |
|--------|-----|-------|
| Official docs | https://reactrouter.com/docs | v7 docs |
| API reference | https://api.reactrouter.com | Type definitions |
| Context7 | `/remix-run/react-router` | Good coverage |
| GitHub | https://github.com/remix-run/react-router | Source, issues, examples |

## Form Handling

See `VendorConformZod` for complete Conform + Zod form handling patterns, examples, and DaisyUI 5 styling.

### Checkbox Boolean Handling

HTML checkboxes send string values. Conform's `parseWithZod` from `@conform-to/zod/v4` auto-coerces `"on"` → `true`, absence → `false`.

```typescript
// ✅ Schema — plain z.boolean(), Conform handles coercion
acceptTerms: z.boolean().refine((val) => val === true, {
  message: t('validation.acceptTerms', 'You must accept the terms'),
})

// ❌ Don't use z.preprocess — breaks TypeScript types (returns unknown)
acceptTerms: z.preprocess((val) => val === 'true', z.boolean())
```

```tsx
// ✅ Checkbox — no value attribute (let browser send "on")
<input {...getInputProps(field, { type: 'checkbox' })} key={field.key} />

// ❌ Don't set value="true" — sends string "true", not coerced correctly
<input {...getInputProps(field, { type: 'checkbox' })} value="true" />
```

### Dynamic Form ID (Data Restoration)

When navigating back to a form with server data, `defaultValue` may not re-apply (React only applies it on initial mount). Force re-initialization with a dynamic `id`:

```tsx
const [form, fields] = useForm({
  // Dynamic ID forces re-initialization when data changes
  id: record?.id ? `form-${record.id}` : 'form-new',
  defaultValue: { /* from server data */ },
  // ...
})
```

## Protected Route Pattern

```typescript
// services/auth.server.ts
export async function requireAuth(request: Request) {
  const session = await getSession(request)
  if (!session) throw redirect('/login')
  return session.user
}

// Any protected loader
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request)
  // ... rest of loader
}
```

## API Client Pattern (OAuth2)

```typescript
// User's token — for operations on behalf of the user
const client = await restOnServer(request)
const data = await client.collections.customers.find({ where: { id: { equals: customerId } } })

// M2M token — for privileged server operations
const client = await privilegedRestOnServer()
const data = await client.collections.orders.find({ limit: 100 })
```

**Never use `privilegedRestOnServer` for user-initiated actions.**

## Feature Module Architecture

Self-contained feature folders under `app/features/`:

```
app/features/{name}/
├── routes/
│   ├── index.ts              # Route config export
│   └── {route-handler}.ts
├── components/
├── services/
├── types/
└── config.ts
```

Rules:
- Each feature exports `RouteConfig[]` from `routes/index.ts`
- Routes integrate via spreading into `app/routes.ts`
- No barrel files — import directly from source files
- Never re-export `.server.ts` from shared/client code

## Route ID Gotcha

```typescript
// routes.ts defines the ID
{ id: "journey", path: "journeys/:id", loader: journeyLoader }

// Use the ID, NOT the path
const data = useRouteLoaderData("journey")      // ✅ CORRECT
const data = useRouteLoaderData("journeys/:id") // ❌ WRONG
```

## Known Issues

### Conform duplicate input bug

Custom selector components that render native `<input>` elements must NOT also have hidden inputs for the same field name. This causes FormData to contain arrays instead of single values.

**Debug:**
```javascript
document.querySelectorAll('[name="fieldName"]').length // Should be 1
```

### Dialog + fetcher submission timing

When using any dialog/modal with form submissions, the dialog must stay open until submission completes. Otherwise the form disconnects from the DOM mid-submission.

```tsx
const fetcher = useFetcher()
const [dialogOpen, setDialogOpen] = useState(false)
const isSubmitting = fetcher.state !== 'idle'

const handleSubmit = async () => {
  await fetcher.submit({ intent: 'action' }, { method: 'post' })
  setDialogOpen(false)  // Close AFTER await, not before
}

// Use controlled dialog state (open/onOpenChange)
// Use a regular button with onClick, NOT the dialog library's
// auto-closing action button
<button
  disabled={isSubmitting}
  onClick={() => void handleSubmit()}
>
  {isSubmitting ? 'Processing...' : 'Confirm'}
</button>
```

Key points:
- Use **controlled dialog state** (`open` + `onOpenChange`)
- Close dialog **after** `await` completes, not before
- Use `void` for async `onClick` to satisfy ESLint `no-floating-promises`
- Derive loading state from `fetcher.state !== 'idle'`
- Don't use dialog library auto-close buttons for async operations
