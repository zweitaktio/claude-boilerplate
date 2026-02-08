---
version: 1.0.0
applies: react-router@7
target: graph
type: integration
tags: [conform, zod, oauth2, feature-modules, auth, validation, known-issues]
---

# React Router 7 Integration

Project-specific patterns for integrating React Router 7 with our stack. For core RR7 reference, see [react-router-7/](./react-router-7/_index.md).

## Documentation Sources

| Source | URL | Notes |
|--------|-----|-------|
| Official docs | https://reactrouter.com/docs | v7 docs |
| API reference | https://api.reactrouter.com | Type definitions |
| Context7 | `/remix-run/react-router` | Good coverage |
| GitHub | https://github.com/remix-run/react-router | Source, issues, examples |

## Form Handling with Conform + Zod

### Schema Factory Pattern (i18n-aware)

```typescript
export const createLoginSchema = (t: TranslationFn) =>
  z.object({
    email: z.string({ error: t('validation.required', 'Required') })
      .email({ error: t('validation.invalidEmail', 'Invalid email') }),
    password: z.string({ error: t('validation.required', 'Required') })
      .min(1, { error: t('validation.required', 'Required') }),
  })
```

### Conform + React Router Form

```tsx
const [form, fields] = useForm({
  constraint: getZodConstraint(schema),
  lastResult: actionData?.lastResult,
  onValidate({ formData }) {
    return parseWithZod(formData, { schema })
  },
  shouldRevalidate: 'onBlur',
  shouldValidate: 'onBlur',
})

return (
  <Form {...getFormProps(form)} method="POST">
    <FormField field={fields.email} label={t('auth.email', 'Email')} />
    <button type="submit" disabled={isSubmitting}>Submit</button>
  </Form>
)
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

### Dialog + form submission timing

When using dialogs with form submissions, close AFTER submission completes:

```tsx
const fetcher = useFetcher()
const [dialogOpen, setDialogOpen] = useState(false)

const handleSubmit = async () => {
  await fetcher.submit({ intent: 'action' }, { method: 'post' })
  setDialogOpen(false)  // Close AFTER await
}
```
