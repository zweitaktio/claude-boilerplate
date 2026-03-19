---
version: 1.2.0
applies: react-router@7
target: graph
domain: routing
tags: [types, typescript, typegen, href, Route, typesafe]
---

# Route Module Types

React Router generates route-specific types that provide type inference for URL params, loader data, action data, and more.

## Is Typegen Set Up?

Check for these indicators:

1. `.react-router/types/` directory exists (or appears after running `dev`)
2. `tsconfig.json` includes `.react-router/types/**/*`
3. Imports like `import type { Route } from "./+types/my-route"` resolve

**If not set up:** See https://reactrouter.com/how-to/route-module-type-safety

## Importing Types

Import the `Route` namespace from the `+types` directory relative to your route file:

```tsx
import type { Route } from "./+types/my-route"
```

## Available Types

| Type | Used For |
|------|----------|
| `Route.LoaderArgs` | Server `loader` function arguments |
| `Route.ClientLoaderArgs` | Client `clientLoader` function arguments |
| `Route.ActionArgs` | Server `action` function arguments |
| `Route.ClientActionArgs` | Client `clientAction` function arguments |
| `Route.ComponentProps` | Component props (loaderData, actionData, etc.) |
| `Route.ErrorBoundaryProps` | `ErrorBoundary` component props |
| `Route.HydrateFallbackProps` | `HydrateFallback` component props |
| `Route.MetaArgs` | `meta` function arguments |
| `Route.HeadersArgs` | `headers` function arguments |
| `Route.MiddlewareFunction` | Server middleware function type |
| `Route.ClientMiddlewareFunction` | Client middleware function type |

## What Gets Typed

Types are inferred from your route configuration:

- **URL params**: From dynamic segments (`:id`, `:slug`)
- **Loader data**: From `loader` return → `ComponentProps.loaderData`
- **Action data**: From `action` return → `ComponentProps.actionData`
- **Parent data**: Matches include typed data from parent routes

## Example

```tsx
import type { Route } from "./+types/products.$id"

// params.id typed as string (from :id segment)
export async function loader({ params }: Route.LoaderArgs) {
  const product = await db.products.find(params.id)
  return { product }
}

// loaderData.product typed from loader return
export default function Product({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.product.name}</h1>
}
```

## Type-Safe URLs with href

**All internal links MUST use `href()`.** Never manually construct URL strings.

```tsx
import { href, Link } from "react-router"

// ✅ Type-safe — catches route typos at compile time
<Link to={href("/:lang/products/:id", { lang, id: "abc123" })} />
<Link to={href("/:lang/about", { lang })} />

// ❌ Never manually construct URLs
<Link to={`/${lang}/products/${id}`} />
```

**Troubleshooting:** If route types aren't updated after changes to `routes.ts`, restart the dev server to regenerate route types.

## Typing useFetcher

When using `useFetcher` to call an action from another route, type it with the action's type:

```tsx
import { useFetcher } from "react-router"

// Option 1: Import the action type directly
import type { action } from "./rate"

function RatingForm({ itemId }: { itemId: string }) {
  const fetcher = useFetcher<typeof action>()

  return (
    <fetcher.Form method="post" action={`/items/${itemId}/rate`}>
      <button name="rating" value="5">⭐⭐⭐⭐⭐</button>
      {fetcher.data?.success && <span>Saved!</span>}
    </fetcher.Form>
  )
}
```

```tsx
// Option 2: Define inline type for simple cases
type ActionData = { success: boolean; error?: string }

function FavoriteButton({ itemId }: { itemId: string }) {
  const fetcher = useFetcher<ActionData>()

  return (
    <fetcher.Form method="post" action={`/favorites/${itemId}`}>
      <button type="submit">Favorite</button>
    </fetcher.Form>
  )
}
```

## Route IDs vs Paths

When using `useRouteLoaderData`, use the route ID (NOT the path):

```typescript
// routes.ts defines the ID
{ id: "journey", path: "journeys/:id", loader: journeyLoader }

// Use the ID, NOT the path
const data = useRouteLoaderData("journey")      // ✅ CORRECT
const data = useRouteLoaderData("journeys/:id") // ❌ WRONG
```

## Known Issues

### Serialized loader data breaks type predicates

React Router serializes loader data, creating structural types with `[k: string]: unknown` index signatures. Nominal types (e.g., Payload CMS types) have `[x: string]: undefined`. TypeScript's type predicate overload requires `S extends T`, but the nominal type doesn't extend the serialized structural type.

**Symptom:** `.filter(isMedia)` or similar type guards don't narrow the array type when used on loader data.

**Fix:** Derive the type from the actual serialized data instead of forcing the nominal type:

```typescript
// ❌ Nominal type predicate fails on serialized data
.filter((img): img is Media => typeof img !== 'number')

// ✅ Derive from serialized type
.filter((img): img is Exclude<typeof img, number> => typeof img !== 'number')
```

This pattern applies whenever you use type predicates on any data that came through a React Router loader.
