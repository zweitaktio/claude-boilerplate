---
version: 1.1.1
applies: "@conform-to/react" | "@conform-to/zod"
target: rules
domain: forms
paths:
  - "**/*.tsx"
tags: [forms, validation, zod, conform, react-router]
---

# Form Handling: Conform + Zod + React Router 7

## Documentation Sources

| Source | URL | Notes |
|--------|-----|-------|
| Conform | https://conform.guide | Official docs |
| Conform GitHub | https://github.com/edmundhung/conform | Source, issues, examples |
| Zod | https://zod.dev | Schema validation |
| `@conform-to/zod/v4` | — | Zod v4 integration subpath — always import from `/v4` |

## Imports

Get these right first — wrong import paths are the #1 source of errors:

```typescript
// Conform core
import { getFormProps, getInputProps, useForm } from '@conform-to/react'

// Conform + Zod v4 integration — MUST use /v4 subpath
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'

// React Router 7
import { data, Form, redirect, useActionData, useNavigation } from 'react-router'

// Zod
import { z } from 'zod'

// For fetcher-based forms
import { useFetcher } from 'react-router'
```

## Schema Definition

### Schema Factory Pattern (i18n-aware)

Create schema factories that accept a translation function. Use `defaultT` on the server where `t()` from react-i18next is unavailable:

```typescript
// app/lib/validation-helpers.ts
type TranslationFn = (key: string, defaultValue: string) => string
const defaultT: TranslationFn = (_key, defaultValue) => defaultValue

// Reusable field helpers
function requiredString(t: TranslationFn) {
  return z
    .string({ error: t('validation.required', 'Required') })
    .min(1, { error: t('validation.required', 'Required') })
}

function requiredEmail(t: TranslationFn) {
  return requiredString(t).email({ error: t('validation.invalidEmail', 'Invalid email') })
}

function passwordField(t: TranslationFn, minLength = 8) {
  return requiredString(t).min(minLength, {
    error: t('validation.passwordMinLength', `Must be at least ${minLength} characters`),
  })
}
```

### Zod v4 Syntax

Conform + Zod v4 uses `{ error: 'msg' }` for custom messages:

```typescript
// ✅ Zod v4
z.string({ error: 'Required' }).email({ error: 'Invalid email' })

// ❌ Zod 3 (deprecated)
z.string({ message: 'Required' })
z.string({ required_error: 'Required' })
```

### Cross-Field Validation

Use `.refine()` for validations that depend on multiple fields:

```typescript
export const createRegisterSchema = (t: TranslationFn) =>
  z
    .object({
      email: requiredEmail(t),
      password: passwordField(t),
      confirmPassword: requiredString(t),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordMismatch', 'Passwords do not match'),
      path: ['confirmPassword'],
    })
```

### Conditional Validation

Use `.superRefine()` when validation depends on another field's value:

```typescript
export const createCheckoutSchema = (t: TranslationFn) =>
  z
    .object({
      deliveryMethod: z.enum(['pickup', 'delivery']),
      street: z.string().optional(),
      city: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.deliveryMethod === 'delivery') {
        if (!data.street) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('validation.required', 'Required'),
            path: ['street'],
          })
        }
        if (!data.city) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('validation.required', 'Required'),
            path: ['city'],
          })
        }
      }
    })
```

## Action Pattern (Server-Side)

The canonical parse → validate → reply → execute pattern:

```typescript
import { data, redirect } from 'react-router'
import { parseWithZod } from '@conform-to/zod/v4'
import type { Route } from './+types/login'

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: createLoginSchema(defaultT) })

  if (submission.status !== 'success') {
    return data(
      { lastResult: submission.reply({ hideFields: ['password'] }) },
      { status: 400 },
    )
  }

  // submission.value is fully typed
  const { email, password } = submission.value

  try {
    const user = await authenticate(email, password)
    return redirect('/dashboard')
  } catch (error) {
    return data(
      {
        lastResult: submission.reply({
          hideFields: ['password'],
          formErrors: ['Invalid email or password'],
        }),
      },
      { status: 401 },
    )
  }
}
```

### Key Points

- **`hideFields`** — strips sensitive values (passwords, tokens) from the reply so they don't appear in the DOM
- **`formErrors`** — array of form-level errors (auth failures, server errors, duplicate email)
- **Status codes:** 400 (validation), 401 (auth failure), 409 (conflict, e.g. duplicate), 500 (server error)
- **Always validate server-side** — never trust client-only validation

## Component Pattern (Client-Side)

```tsx
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { Form, useActionData, useNavigation } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Route } from './+types/login'

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const schema = createLoginSchema(t)
  const isSubmitting = navigation.state === 'submitting'

  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    defaultValue: { email: '', password: '' },
    lastResult: actionData?.lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema })
    },
    shouldRevalidate: 'onInput',
    shouldValidate: 'onSubmit',
  })

  return (
    <Form {...getFormProps(form)} method="POST">
      {/* Form-level errors (auth failures, server errors) */}
      {form.errors && (
        <div className="alert alert-error">
          {form.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <FormField label={t('auth.email', 'Email')} field={fields.email} type="email" />
      <FormField label={t('auth.password', 'Password')} field={fields.password} type="password" />

      <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.submitting', 'Signing in...') : t('auth.login', 'Sign in')}
      </button>
    </Form>
  )
}
```

### Critical: `key={field.key}`

Every input MUST have `key={field.key}`. Without it, Conform cannot re-render inputs after server validation or reset:

```tsx
// ✅ Always include key
<input {...getInputProps(field, { type: 'text' })} key={field.key} />

// ❌ Missing key — breaks re-renders after validation
<input {...getInputProps(field, { type: 'text' })} />
```

## FormField Wrapper Component

DaisyUI 5-styled field wrapper with Conform integration:

```tsx
import { type FieldMetadata, getInputProps } from '@conform-to/react'
import { cn } from '~/lib/utils'

interface FormFieldProps {
  field: FieldMetadata<string>
  label: string
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'
  hint?: string
  placeholder?: string
}

export function FormField({ field, label, type = 'text', hint, placeholder }: FormFieldProps) {
  return (
    <fieldset className="fieldset">
      <label className="label" htmlFor={field.id}>
        {label}
      </label>
      <input
        {...getInputProps(field, { type })}
        className={cn('input w-full', field.errors && 'input-error')}
        key={field.key}
        placeholder={placeholder}
      />
      {field.errors ? (
        <p className="label text-error">{field.errors.join(', ')}</p>
      ) : hint ? (
        <p className="label text-base-content/60">{hint}</p>
      ) : null}
    </fieldset>
  )
}
```

### Select and Textarea

Same pattern — swap the element and DaisyUI class:

```tsx
// Select
<select
  {...getSelectProps(field)}
  className={cn('select w-full', field.errors && 'select-error')}
  key={field.key}
>
  <option value="">Choose...</option>
  {options.map((opt) => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</select>

// Textarea
<textarea
  {...getTextareaProps(field)}
  className={cn('textarea w-full', field.errors && 'textarea-error')}
  key={field.key}
/>
```

## FormCheckbox Wrapper Component

DaisyUI 5-styled checkbox with Conform integration:

```tsx
import { type FieldMetadata, getInputProps } from '@conform-to/react'
import { cn } from '~/lib/utils'

interface FormCheckboxProps {
  field: FieldMetadata<boolean>
  children: React.ReactNode
}

export function FormCheckbox({ field, children }: FormCheckboxProps) {
  return (
    <fieldset className="fieldset">
      <label className="label cursor-pointer justify-start gap-3">
        <input
          {...getInputProps(field, { type: 'checkbox' })}
          className={cn('checkbox', field.errors && 'checkbox-error')}
          key={field.key}
        />
        <span>{children}</span>
      </label>
      {field.errors && <p className="label text-error">{field.errors.join(', ')}</p>}
    </fieldset>
  )
}
```

### Boolean Coercion

Conform's `parseWithZod` from `@conform-to/zod/v4` auto-coerces checkbox values: `"on"` → `true`, absence → `false`. No manual coercion needed:

```typescript
// ✅ Schema — plain z.boolean(), Conform handles coercion
acceptTerms: z.boolean().refine((val) => val === true, {
  error: t('validation.acceptTerms', 'You must accept the terms'),
})

// ❌ Don't use z.preprocess — breaks TypeScript types
acceptTerms: z.preprocess((val) => val === 'true', z.boolean())
```

```tsx
// ✅ No value attribute — let browser send "on"
<input {...getInputProps(field, { type: 'checkbox' })} key={field.key} />

// ❌ Don't set value="true" — breaks Conform coercion
<input {...getInputProps(field, { type: 'checkbox' })} value="true" />
```

## Working Examples

### Example 1 — Login Form (Simple)

Complete route file with schema, action, and component:

```tsx
// routes/login.tsx
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { data, Form, redirect, useNavigation } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/login'

const defaultT = (_key: string, defaultValue: string) => defaultValue

const createLoginSchema = (t: typeof defaultT) =>
  z.object({
    email: z.string({ error: t('v.required', 'Required') })
      .min(1, { error: t('v.required', 'Required') })
      .email({ error: t('v.email', 'Invalid email') }),
    password: z.string({ error: t('v.required', 'Required') })
      .min(1, { error: t('v.required', 'Required') }),
  })

export async function action({ request }: Route.ActionArgs) {
  const submission = parseWithZod(await request.formData(), {
    schema: createLoginSchema(defaultT),
  })
  if (submission.status !== 'success') {
    return data({ lastResult: submission.reply({ hideFields: ['password'] }) }, { status: 400 })
  }
  const { email, password } = submission.value
  const user = await authenticate(email, password)
  if (!user) {
    return data({
      lastResult: submission.reply({
        hideFields: ['password'],
        formErrors: ['Invalid email or password'],
      }),
    }, { status: 401 })
  }
  return redirect('/dashboard')
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const schema = createLoginSchema(defaultT)
  const isSubmitting = navigation.state === 'submitting'

  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    defaultValue: { email: '', password: '' },
    lastResult: actionData?.lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema })
    },
    shouldRevalidate: 'onInput',
    shouldValidate: 'onSubmit',
  })

  return (
    <Form {...getFormProps(form)} method="POST" className="mx-auto max-w-sm space-y-4">
      {form.errors && (
        <div className="alert alert-error">{form.errors.join(', ')}</div>
      )}
      <fieldset className="fieldset">
        <label className="label" htmlFor={fields.email.id}>Email</label>
        <input
          {...getInputProps(fields.email, { type: 'email' })}
          className={`input w-full ${fields.email.errors ? 'input-error' : ''}`}
          key={fields.email.key}
        />
        {fields.email.errors && <p className="label text-error">{fields.email.errors.join(', ')}</p>}
      </fieldset>
      <fieldset className="fieldset">
        <label className="label" htmlFor={fields.password.id}>Password</label>
        <input
          {...getInputProps(fields.password, { type: 'password' })}
          className={`input w-full ${fields.password.errors ? 'input-error' : ''}`}
          key={fields.password.key}
        />
        {fields.password.errors && <p className="label text-error">{fields.password.errors.join(', ')}</p>}
      </fieldset>
      <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
    </Form>
  )
}
```

### Example 2 — Registration Form (Cross-Field Validation)

```tsx
// routes/register.tsx (action only — component follows same pattern as login)
import { parseWithZod } from '@conform-to/zod/v4'
import { data, redirect } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/register'

const defaultT = (_key: string, defaultValue: string) => defaultValue

const createRegisterSchema = (t: typeof defaultT) =>
  z
    .object({
      email: z.string({ error: t('v.required', 'Required') })
        .email({ error: t('v.email', 'Invalid email') }),
      password: z.string({ error: t('v.required', 'Required') })
        .min(8, { error: t('v.minLength', 'At least 8 characters') }),
      confirmPassword: z.string({ error: t('v.required', 'Required') }),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t('v.passwordMismatch', 'Passwords do not match'),
      path: ['confirmPassword'],
    })

export async function action({ request }: Route.ActionArgs) {
  const submission = parseWithZod(await request.formData(), {
    schema: createRegisterSchema(defaultT),
  })
  if (submission.status !== 'success') {
    return data(
      { lastResult: submission.reply({ hideFields: ['password', 'confirmPassword'] }) },
      { status: 400 },
    )
  }
  try {
    await createUser(submission.value)
    return redirect('/login?registered=true')
  } catch (error) {
    if (isDuplicateEmail(error)) {
      return data({
        lastResult: submission.reply({
          hideFields: ['password', 'confirmPassword'],
          formErrors: ['An account with this email already exists'],
        }),
      }, { status: 409 })
    }
    throw error
  }
}
```

### Example 3 — Profile Edit (Fetcher-Based)

Uses `useFetcher` for in-page mutation without navigation:

```tsx
// components/profile-form.tsx
import { getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { useFetcher } from 'react-router'
import { z } from 'zod'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const profileSchema = z.object({
  name: z.string().min(1, { error: 'Required' }),
  bio: z.string().max(500, { error: 'Max 500 characters' }).optional(),
})

interface ProfileFormProps {
  profile: { id: string; name: string; bio?: string }
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const fetcher = useFetcher<{ lastResult?: unknown; success?: boolean }>()
  const isSubmitting = fetcher.state !== 'idle'

  const [form, fields] = useForm({
    id: `profile-${profile.id}`,
    constraint: getZodConstraint(profileSchema),
    defaultValue: { name: profile.name, bio: profile.bio ?? '' },
    lastResult: fetcher.data?.lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: profileSchema })
    },
    shouldRevalidate: 'onInput',
    shouldValidate: 'onSubmit',
  })

  // Success toast
  const prevState = useRef(fetcher.state)
  useEffect(() => {
    if (prevState.current === 'loading' && fetcher.state === 'idle' && fetcher.data?.success) {
      toast.success('Profile updated')
    }
    prevState.current = fetcher.state
  }, [fetcher.state, fetcher.data])

  return (
    <fetcher.Form {...getFormProps(form)} method="POST" action="/api/profile">
      <fieldset className="fieldset">
        <label className="label" htmlFor={fields.name.id}>Name</label>
        <input
          {...getInputProps(fields.name, { type: 'text' })}
          className={`input w-full ${fields.name.errors ? 'input-error' : ''}`}
          key={fields.name.key}
        />
        {fields.name.errors && <p className="label text-error">{fields.name.errors.join(', ')}</p>}
      </fieldset>
      <fieldset className="fieldset">
        <label className="label" htmlFor={fields.bio.id}>Bio</label>
        <textarea
          {...getInputProps(fields.bio, { type: 'text' })}
          className={`textarea w-full ${fields.bio.errors ? 'textarea-error' : ''}`}
          key={fields.bio.key}
        />
        {fields.bio.errors && <p className="label text-error">{fields.bio.errors.join(', ')}</p>}
      </fieldset>
      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </fetcher.Form>
  )
}
```

### Example 4 — Multi-Intent Form

Single action handles multiple intents (add, edit, delete):

```tsx
// routes/items.tsx (action)
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'create': {
      const submission = parseWithZod(formData, { schema: createItemSchema(defaultT) })
      if (submission.status !== 'success') {
        return data({ lastResult: submission.reply() }, { status: 400 })
      }
      await createItem(submission.value)
      return data({ success: true })
    }
    case 'delete': {
      const id = formData.get('id')
      if (typeof id !== 'string') {
        return data({ error: 'Missing id' }, { status: 400 })
      }
      await deleteItem(id)
      return data({ success: true })
    }
    default:
      return data({ error: 'Unknown intent' }, { status: 400 })
  }
}

// In component — each button sets the intent
<button type="submit" name="intent" value="create" className="btn btn-primary">
  Create
</button>
<button type="submit" name="intent" value="delete" className="btn btn-error">
  Delete
</button>
```

## Patterns Reference

### Async Validation

For server-dependent validation (e.g., checking email uniqueness):

```typescript
export const createRegisterSchema = (
  t: TranslationFn,
  isEmailUnique?: (email: string) => Promise<boolean>,
) =>
  z.object({
    email: requiredEmail(t).superRefine(async (email, ctx) => {
      if (isEmailUnique && !(await isEmailUnique(email))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('v.emailTaken', 'Email already in use'),
        })
      }
    }),
  })

// In action
const submission = await parseWithZod(formData, {
  schema: createRegisterSchema(defaultT, checkEmailUnique),
  async: true,
})
```

### Nested Objects

Use dot notation for nested field names:

```typescript
const schema = z.object({
  address: z.object({
    street: z.string().min(1, { error: 'Required' }),
    city: z.string().min(1, { error: 'Required' }),
  }),
})

// In component — access nested fields
const address = fields.address.getFieldset()
<input {...getInputProps(address.street, { type: 'text' })} key={address.street.key} />
<input {...getInputProps(address.city, { type: 'text' })} key={address.city.key} />
```

### Dynamic Form ID

When navigating back to a form with server data, `defaultValue` may not re-apply (React only applies it on initial mount). Force re-initialization with a dynamic `id`:

```tsx
const [form, fields] = useForm({
  id: record?.id ? `form-${record.id}` : 'form-new',
  defaultValue: { /* from server data */ },
  // ...
})
```

### Hidden Fields

For return URLs, tokens, or IDs that need to travel with the form:

```tsx
<input {...getInputProps(fields.returnTo, { type: 'hidden' })} key={fields.returnTo.key} />
```

## Anti-Patterns

```tsx
// ❌ Manual useState for form values — Conform manages form state
const [email, setEmail] = useState('')

// ❌ z.preprocess for checkbox coercion — breaks TypeScript types, Conform handles it
acceptTerms: z.preprocess((val) => val === 'true', z.boolean())

// ❌ Client-only validation — server MUST always validate
onValidate({ formData }) { return parseWithZod(formData, { schema }) }
// Without a matching server-side parseWithZod in the action

// ❌ value="true" on checkboxes — breaks Conform coercion
<input {...getInputProps(field, { type: 'checkbox' })} value="true" />

// ❌ Missing key={field.key} on inputs — breaks re-renders after validation
<input {...getInputProps(field, { type: 'text' })} />

// ❌ Importing from @conform-to/zod instead of @conform-to/zod/v4
import { parseWithZod } from '@conform-to/zod'

// ❌ Zod 3 error syntax
z.string({ message: 'Required' })
// ✅ Zod v4 error syntax
z.string({ error: 'Required' })
```

## Pitfalls

### Duplicating Zod schemas across files

Don't create separate schemas for the same data shape in action vs component. Define schemas once in a shared location and import them:

```typescript
// ✅ Shared schema — single source of truth
// app/schemas/login.ts
export const createLoginSchema = (t: TranslationFn) =>
  z.object({
    email: z.string({ error: t('v.required', 'Required') }).email(),
    password: z.string({ error: t('v.required', 'Required') }).min(8),
  })

// Used in BOTH action and component
import { createLoginSchema } from '~/schemas/login'
```

**Why:** Duplicate schemas diverge silently — a field added to the action schema but missing from the client schema causes silent validation gaps. The `createXSchema(t)` factory pattern supports i18n while keeping a single source of truth.

## See Also

- `VendorReactRouter7Actions` — Form submission patterns, useFetcher
- `VendorReactRouter7Integration` — Integration-specific gotchas (checkbox coercion, dynamic form ID, Conform duplicate input bug)
- `VendorDaisyui5` — Full DaisyUI 5 component class reference
