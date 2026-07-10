---
version: 2.1.0
applies: react-router@8
target: rules
domain: routing
paths: ["**/routes/**", "**/routes.ts"]
tags: [routing, routes, nested-routes, layout, params, dynamic-segments]
---

# Routing

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| React Router docs | https://reactrouter.com/ | Official docs, v8 |
| API reference | https://api.reactrouter.com/v8/ | v8 API reference |
| GitHub | https://github.com/remix-run/react-router | Source, issues, discussions |
| Context7 | `/remix-run/react-router` | Good coverage |

For file conventions (`root.tsx`, `routes.ts`, etc.), see `VendorReactRouter8SpecialFiles`.

## Route Configuration

Routes are configured in `app/routes.ts`. Each route has a URL pattern and a file path to the route module:

```ts
import { type RouteConfig, route } from "@react-router/dev/routes"

export default [
  route("some/path", "./some/file.tsx"),
  // pattern ^           ^ module file
] satisfies RouteConfig
```

### Complete Example

```ts
import {
  type RouteConfig,
  route,
  index,
  layout,
  prefix,
} from "@react-router/dev/routes"

export default [
  index("./home.tsx"),
  route("about", "./about.tsx"),

  layout("./auth/layout.tsx", [
    route("login", "./auth/login.tsx"),
    route("register", "./auth/register.tsx"),
  ]),

  ...prefix("concerts", [
    index("./concerts/home.tsx"),
    route(":city", "./concerts/city.tsx"),
    route("trending", "./concerts/trending.tsx"),
  ]),
] satisfies RouteConfig
```

## Route Helpers

| Helper | Purpose | Adds URL segment? |
|--------|---------|-------------------|
| `route(path, file, children?)` | Standard route | Yes |
| `index(file)` | Default child route | No |
| `layout(file, children)` | Shared UI wrapper | No |
| `prefix(path, children)` | Path prefix only | Yes |

## Nested Routes

Child routes are passed as the third argument:

```ts
export default [
  route("dashboard", "./dashboard.tsx", [
    index("./dashboard-home.tsx"),
    route("settings", "./dashboard-settings.tsx"),
  ]),
] satisfies RouteConfig
```

Parent path is automatically included: creates `/dashboard` and `/dashboard/settings`.

### Outlet

Child routes render through `<Outlet />` in the parent:

```tsx
import { Outlet } from "react-router"

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Outlet />
    </div>
  )
}
```

**Layout components render children through `<Outlet />`, never a `children` prop** — `Route.ComponentProps` has no `children`. `{ children }: Route.ComponentProps` is always wrong.

## Root Route

**Every route in `routes.ts` is nested inside `app/root.tsx`.** Put global navigation, footer, providers, and fonts there.

## Layout Routes (Use Them!)

**Prefer nested routes over flat structures.** Layouts reduce code duplication and enable shared UI.

Create nesting without adding URL segments:

```ts
export default [
  layout("./marketing/layout.tsx", [
    index("./marketing/home.tsx"),     // renders at /
    route("contact", "./marketing/contact.tsx"), // renders at /contact
  ]),
] satisfies RouteConfig
```

### Anti-Pattern: Flat Routes

```ts
// ❌ DON'T: Flat structure with no shared layouts
export default [
  route("dashboard", "./dashboard.tsx"),
  route("dashboard/settings", "./dashboard-settings.tsx"),
  route("dashboard/profile", "./dashboard-profile.tsx"),
] satisfies RouteConfig

// ✅ DO: Use nested routes with shared layout
export default [
  route("dashboard", "./dashboard/layout.tsx", [
    index("./dashboard/index.tsx"),
    route("settings", "./dashboard/settings.tsx"),
    route("profile", "./dashboard/profile.tsx"),
  ]),
] satisfies RouteConfig
```

## Index Routes

Render at the parent's URL (default child):

```ts
export default [
  index("./home.tsx"),                    // renders at /
  route("dashboard", "./dashboard.tsx", [
    index("./dashboard-home.tsx"),        // renders at /dashboard
    route("settings", "./settings.tsx"),  // renders at /dashboard/settings
  ]),
] satisfies RouteConfig
```

Index routes cannot have children.

## Route Prefixes

Add a path prefix without introducing a parent route:

```ts
export default [
  ...prefix("projects", [
    index("./projects/home.tsx"),          // /projects
    route(":pid", "./projects/project.tsx"), // /projects/:pid
  ]),
] satisfies RouteConfig
```

## Dynamic Segments

Segments starting with `:` are dynamic and available via `params`:

```ts
route("teams/:teamId", "./team.tsx")
```

```tsx
import type { Route } from "./+types/team"

export async function loader({ params }: Route.LoaderArgs) {
  // params.teamId is typed as string
  return fetchTeam(params.teamId)
}

export default function Team({ params }: Route.ComponentProps) {
  return <h1>Team {params.teamId}</h1>
}
```

Multiple dynamic segments:

```ts
route("c/:categoryId/p/:productId", "./product.tsx")
// params: { categoryId: string; productId: string }
```

## Optional Segments

Add `?` to make a segment optional:

```ts
route(":lang?/categories", "./categories.tsx")
// matches /categories and /en/categories

route("users/:userId/edit?", "./user.tsx")
// matches /users/123 and /users/123/edit
```

## Splats (Catch-All)

Match any remaining path with `/*`:

```ts
route("files/*", "./files.tsx")
```

```tsx
export async function loader({ params }: Route.LoaderArgs) {
  const filePath = params["*"] // e.g., "docs/intro.md"
  return getFile(filePath)
}

// Destructure with rename
const { "*": splat } = params
```

### 404 Catch-All

```ts
route("*", "./catchall.tsx")
```

```tsx
export function loader() {
  throw new Response("Page not found", { status: 404 })
}
```

## Modal Routes Pattern

Render create/edit forms as modals on top of a list page using nested routes with `<Outlet />`.

### Route Configuration

```ts
// routes.ts — modal routes are children of an index layout
...prefix("expenses", [
  layout("./expenses/_layout.tsx", { id: "expensesLoader" }, [
    layout("./expenses/_layout-index.tsx", [
      index("./expenses/index.tsx"),
      route("create", "./expenses/create.tsx"),          // modal
      route(":expenseId/update", "./expenses/update.tsx"), // modal
    ]),
  ]),
])
```

Key structure:
- `_layout.tsx` — data loader (fetches list data)
- `_layout-index.tsx` — renders the list page + `<Outlet />` for modals
- Child routes (`create`, `:id/update`) — render modal dialogs

### Index Layout (List + Outlet)

The index layout renders the list content and an `<Outlet />` where modal routes appear:

```tsx
// _layout-index.tsx
import { Outlet } from "react-router"

export default function ExpensesOverview() {
  return (
    <>
      {/* List content */}
      <div>
        <h2>Expenses</h2>
        <ExpenseTable />
        <AddButton onClick={() => navigate("create")} />
      </div>

      {/* Modal routes render here */}
      <Outlet />
    </>
  )
}
```

### Modal Route Component

Each modal route renders a dialog that navigates back on close:

```tsx
// create.tsx
import { href, useNavigate, useParams } from "react-router"

export default function ExpenseCreate({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate()
  const { journeyId = "" } = useParams()

  const handleClose = () => {
    void navigate(href("/journeys/:journeyId/expenses", { journeyId }))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <Form method="post">
          {/* form fields */}
          <button type="submit">Save</button>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### Benefits

- Direct URL access to modals (shareable, bookmarkable)
- Browser back button closes the modal naturally
- List page stays mounted underneath (no re-render on open/close)
- Each modal has its own loader/action for data isolation
- Works with `useFetcher` for non-navigating submissions

## Pitfalls

### Missing shouldRevalidate causes unnecessary refetches

By default, React Router revalidates ALL loaders on every navigation and mutation. Without `shouldRevalidate`, every route's loader re-runs even when its data hasn't changed — causing unnecessary API calls and UI flicker.

```typescript
// ✅ Only revalidate when this route's params or data change
export function shouldRevalidate({
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}: Route.ShouldRevalidateArgs) {
  // Skip revalidation if params haven't changed
  if (currentParams.teamId === nextParams.teamId) {
    return false
  }
  return defaultShouldRevalidate
}
```

**When to add `shouldRevalidate`:**
- List pages that shouldn't refetch when a child modal submits
- Layout routes with data that rarely changes (user info, nav items)
- Routes with expensive loaders (aggregations, search)

**When NOT to override:** If the route's data depends on other routes' mutations (e.g., a count that changes when items are added), let default revalidation handle it.
