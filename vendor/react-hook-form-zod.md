---
version: 2.0.0
applies: react-hook-form | remix-hook-form
target: rules
domain: forms
paths:
  - "**/*-form.tsx"
  - "**/*-form-handlers.ts"
  - "**/components/ui/form.tsx"
  - "**/forms/**"
tags: [forms, validation, zod, react-hook-form, remix-hook-form]
---

# Form Handling: react-hook-form + Zod

Companion to `vendor/conform-zod.md` — that one covers `@conform-to/*`. Pick by which library the
project actually depends on; they are alternatives, not layers.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| react-hook-form | https://react-hook-form.com | Core form library |
| Zod | https://zod.dev | Schema validation |
| remix-hook-form | https://github.com/Code-Forge-Net/remix-hook-form | React Router / Remix integration |
| @hookform/resolvers | https://github.com/react-hook-form/resolvers | Zod resolver |

## Library Selection

| Scenario | Library | Why |
|----------|---------|-----|
| Route-connected forms (React Router actions) | `remix-hook-form` | Bridges react-hook-form with React Router form submissions |
| Standalone forms (no route action) | `react-hook-form` | Lighter, no router dependency |
| Validation | `zod` | Type-safe schemas, infers TypeScript types |

## Core Pattern

### 1. Define Schema (Shared)

```typescript
// expense-form.tsx — schema + component in same file
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

export const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string().length(3),
  date: z.string(),
  type: z.enum(["food", "transport", "accommodation", "other"]),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
export const expenseResolver = zodResolver(expenseSchema)
```

### 2. Form Component (with remix-hook-form)

```tsx
import { Form } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"

interface ExpenseFormProps {
  defaultValues: ExpenseFormData
  onClose: () => void
}

export function ExpenseForm({ defaultValues, onClose }: ExpenseFormProps) {
  const form = useRemixForm<ExpenseFormData>({
    defaultValues,
    resolver: expenseResolver,
    mode: "onSubmit",
  })

  return (
    <RemixFormProvider {...form}>
      <Form method="post" onSubmit={form.handleSubmit}>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save"}
        </button>
      </Form>
    </RemixFormProvider>
  )
}
```

### 3. Route Action (Server Validation)

```typescript
// expense-form-handlers.ts
import { type ActionFunctionArgs, redirect } from "react-router"
import { getValidatedFormData } from "remix-hook-form"
import { expenseResolver, type ExpenseFormData } from "./expense-form"

export async function expenseCreateAction({ request }: ActionFunctionArgs) {
  const { data, errors } = await getValidatedFormData<ExpenseFormData>(
    request,
    expenseResolver,
    false, // don't use native validation
  )

  if (errors || !data) {
    return { errors }
  }

  await db.create({ collection: "expenses", data })
  return redirect("/expenses")
}
```

### 4. Route File (Wire It Up)

```tsx
// routes/expenses/create.tsx
import { expenseCreateAction, expenseCreateLoader } from "~/components/expenses/expense-form-handlers"
import { ExpenseForm } from "~/components/expenses/expense-form"
import type { Route } from "./+types/create"

export const loader = expenseCreateLoader
export const action = expenseCreateAction

export default function ExpenseCreate({ loaderData }: Route.ComponentProps) {
  return <ExpenseForm defaultValues={loaderData.defaultValues} onClose={handleClose} />
}
```

## Key Patterns

### Shared Schema Between Client and Server

Export the schema and resolver from the form component file. Both the client form and server action use the same validation:

```
expense-form.tsx       → schema + resolver + component
expense-form-handlers.ts → loader + action (imports schema)
routes/create.tsx      → wires loader, action, component
```

### Programmatic Field Updates

Use `form.setValue()` to update fields from external events:

```tsx
const form = useRemixForm<ExpenseFormData>({ ... })

// Update from external data (e.g., receipt scan, API response)
onReceiptData={(data) => {
  form.setValue("amount", data.total)
  form.setValue("currency", data.currency)
  form.setValue("description", data.name)
}}
```

### FormField Component (shadcn/ui pattern)

Use a `FormField` + `FormItem` component for consistent field rendering with labels, descriptions, and error messages:

```tsx
<FormField
  control={form.control}
  name="amount"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Amount</FormLabel>
      <FormControl>
        <Input
          type="number"
          step="0.01"
          {...field}
          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
        />
      </FormControl>
      <FormDescription>Enter the expense amount</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Known Issues

**`FormMessage` must translate `error.message` in i18n projects.** If the schema is module-level it
cannot call a real `t`, so teams commonly feed it translation *keys* via a dummy `t`. A stock shadcn
`FormMessage` renders `String(error.message)` raw and every validation error shows as a bare key. Use
`t(message, message)` — key as its own default.

**Version drift between `remix-hook-form` and `react-hook-form`.** `remix-hook-form@7.1.1` types
`RemixFormProviderProps` with a required `setValues` that `useRemixForm`'s return type (from
`react-hook-form@7.76`) does not expose, so every `<RemixFormProvider {...form}>` spread fails TS2741.
Its declared peer range (`^7.55.0`) is looser than what actually type-checks. Pin `react-hook-form` to
`7.71.1` until a compatible `remix-hook-form` ships.

## Anti-Patterns

```tsx
// ❌ Don't use native form handling with manual state
const [description, setDescription] = useState("")
const [errors, setErrors] = useState({})
function onSubmit(e) { e.preventDefault(); /* manual validation */ }

// ✅ Use react-hook-form + zod — validation is declarative
const form = useRemixForm({ resolver: zodResolver(schema) })

// ❌ Don't validate on client only
// Server action must also validate (never trust the client)

// ✅ Share resolver between client form and server action
const { data, errors } = await getValidatedFormData(request, resolver)
```

## See Also

- `vendor/react-router-8/actions` — Form submission patterns, useFetcher
- `vendor/react-router-8/routing` — Modal routes pattern for form dialogs
