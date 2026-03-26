---
version: 1.8.1
applies: react
target: rules
priority: high
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "!**/*.test.*"
  - "!**/*.spec.*"
tags: [react, components, props, patterns, hooks, typescript]
---

# React Component Conventions

## Component Library Selection

DaisyUI 5 provides CSS styling. Base UI (`@base-ui/react`) provides headless behavior and accessibility.

Use DaisyUI classes alone for: buttons, cards, badges, alerts, avatars, form inputs, layout, loading states.
Use Base UI + DaisyUI/Tailwind for: dialogs, popovers, menus, selects, comboboxes, tabs, accordions, tooltips, switches.

Never use DaisyUI's CSS-only interactive components (`<dialog class="modal">`, `<div class="dropdown">`, `<details class="collapse">`) in production — they lack focus management, keyboard navigation, and ARIA state.

All component wrappers must use CVA + twMerge for variants — see `vendor/tailwind-4` (auto-loaded) for the pattern.

## Component Declaration
- Components use `export const` arrow functions with inline props typing: `export const Foo = ({ ... }: FooProps) => { }`
- **Exception: React Router route exports** — use named `function` declarations for `loader`, `action`, `clientLoader`, `clientAction`, `meta`, `links`, `headers`, `shouldRevalidate`, `ErrorBoundary`, `HydrateFallback` (framework requirement)

## Props Typing
- Define a named `Props` interface for every component (e.g. `FooProps`)
- Type inline on destructured params: `({ title }: FooProps) =>`
- Never inline untyped props, never `any`

## Exports
- Named exports preferred (hook warns on default exports)
- Exception: route components require `export default` per framework convention; use `export default ComponentName` at bottom of file

## File Organization
- One component per file
- Exceptions: compound groups (e.g. `Card`/`CardBody`/`CardTitle`), MDX wrappers, tightly coupled style variants

## Examples

```tsx
// Standard component — arrow function
interface FooProps {
  title: string
  children: ReactNode
}

export const Foo = ({ title, children }: FooProps) => {
  return <div>{title}{children}</div>
}

// Route component — arrow function with default export
const MyPage = ({ loaderData }: Route.ComponentProps) => {
  return <div>...</div>
}
export default MyPage

// React Router exports — function declarations (required by framework)
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request)
  return { user }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  return { success: true }
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.title ?? 'Default' }]
}
```

## useEffect

See `vendor/react-hooks` (auto-loaded) for race condition prevention, cleanup patterns, stale closures, and infinite loop avoidance.

**When NOT to use useEffect:** derived state (calculate during render), expensive calculations (`useMemo`), data fetching (use loaders or TanStack Query), event handlers (use handler functions).

## API Data Safety

Never use `as Type` assertions for API responses — use runtime type guards:

```tsx
// ❌ Unsafe — silently wrong if API shape changes
const user = data as User

// ✅ Safe — validates at runtime
if (isUser(data)) {
  // data is typed as User
}

// ✅ Parse with fallback
const user = parseUser(data) // returns User | null
```

Use a `createTypeGuards<T>` factory for consistent guards across all API types — see `vendor/react-hooks` (auto-loaded) for the full pattern.

## Progressive Enhancement

Forms must work without JavaScript. Use `<Form>` + server action, not `onClick` + `fetch()`:

```tsx
// ✅ Works without JS — progressive enhancement
<Form method="post" action="/api/subscribe">
  <input name="email" type="email" required />
  <button type="submit">Subscribe</button>
</Form>

// ❌ Breaks without JS
<button onClick={() => fetch('/api/subscribe', { method: 'POST', body })}>
```

Use `useFetcher` for in-page mutations that shouldn't trigger navigation.

## Error Responses

Always `throw new Response()` with proper status codes from loaders and actions — never return error objects:

```typescript
// ✅ Caught by ErrorBoundary, proper HTTP semantics
throw new Response("Not found", { status: 404 })
throw new Response("Unauthorized", { status: 401 })

// ❌ Renders normally with error prop — no ErrorBoundary, no status code
return { error: "Not found" }
```

## Accessibility

- **Focus management after navigation:** When client-side navigation completes, focus should move to the main content area or a heading — don't leave focus on the clicked link
- **Skip link:** Include a "Skip to content" link as the first focusable element in the layout, targeting `#main-content`
- **Reduced motion:** Wrap animations in `prefers-reduced-motion` media query. Use `motion-safe:` Tailwind modifier

See `vendor/daisyui-5` (auto-loaded) for DaisyUI 5 component markup patterns.
See `vendor/base-ui-react` (auto-loaded) for headless component patterns (dialogs, popovers, menus, selects, tooltips).
See `vendor/react-router-7/` rules (auto-loaded for route files) for route component patterns.

## See Also

- `core/frontend/state-management` — When to use Context vs Zustand (auto-loaded)
- `core/frontend/ssr-hydration` — Client-only code patterns (auto-loaded)
- `core/frontend/i18n` — Translation in components (auto-loaded)
