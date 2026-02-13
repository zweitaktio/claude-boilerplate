---
version: 1.5.0
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

All component wrappers must use CVA + twMerge for variants — see `VendorTailwind4` for the pattern.

## Component Declaration
- Always `export const` arrow functions for components: `export const Foo = ({ ... }: FooProps) => { }`
- No `React.FC` — type props inline on the function parameter
- **Exception: React Router route exports** — use named `function` declarations for `loader`, `action`, `clientLoader`, `clientAction`, `meta`, `links`, `headers`, `shouldRevalidate`, `ErrorBoundary`, `HydrateFallback` (framework requirement)

## Props Typing
- Define a named `Props` interface for every component (e.g. `FooProps`)
- Type inline on destructured params: `({ title }: FooProps) =>`
- Never `React.FC<FooProps>`, never inline untyped props, never `any`

## Exports
- Always named exports — no default exports
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

## useEffect Patterns

### When NOT to Use useEffect
- **Derived state:** If you can calculate something during render, don't use an effect
- **Expensive calculations:** Use `useMemo` instead of useEffect + setState
- **Data fetching:** Prefer React Router loaders, TanStack Query, or similar over raw useEffect
- **Event handlers:** Logic that responds to user actions belongs in handlers, not effects

### Race Condition Prevention

**Boolean flag pattern:**
```tsx
useEffect(() => {
  let cancelled = false

  const fetchData = async () => {
    const result = await api.getData(id)
    if (!cancelled) {
      setData(result)
    }
  }

  fetchData()
  return () => { cancelled = true }
}, [id])
```

**AbortController pattern (preferred for fetch):**
```tsx
useEffect(() => {
  const controller = new AbortController()

  const fetchData = async () => {
    try {
      const res = await fetch(url, { signal: controller.signal })
      const data = await res.json()
      setData(data)
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    }
  }

  fetchData()
  return () => controller.abort()
}, [url])
```

### Cleanup Functions
- Always clean up subscriptions, timers, event listeners
- Cleanup runs before next effect and on unmount
- Strict Mode runs setup → cleanup → setup to verify correctness

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => { /* ... */ }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

### Avoiding Infinite Loops

**Missing dependency array:** Always provide one, even if empty
```tsx
// ❌ Runs every render
useEffect(() => { ... })

// ✅ Runs once on mount
useEffect(() => { ... }, [])

// ✅ Runs when deps change
useEffect(() => { ... }, [dep1, dep2])
```

**Objects/arrays as dependencies:** Memoize with useMemo or use primitive values
```tsx
// ❌ New object every render → infinite loop
useEffect(() => { ... }, [{ foo: 'bar' }])

// ✅ Memoized object
const config = useMemo(() => ({ foo: 'bar' }), [])
useEffect(() => { ... }, [config])

// ✅ Primitive values
useEffect(() => { ... }, [foo, bar])
```

**Functions as dependencies:** Use useCallback or define inside effect
```tsx
// ❌ New function every render
useEffect(() => { doSomething() }, [doSomething])

// ✅ Memoized function
const doSomething = useCallback(() => { ... }, [dep])
useEffect(() => { doSomething() }, [doSomething])

// ✅ Define inside effect (if only used there)
useEffect(() => {
  const doSomething = () => { ... }
  doSomething()
}, [dep])
```

### Stale Closures

**Use functional updates for state:**
```tsx
// ❌ Stale closure risk
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000)
  return () => clearInterval(id)
}, []) // count is stale

// ✅ Functional update always gets fresh state
useEffect(() => {
  const id = setInterval(() => setCount(c => c + 1), 1000)
  return () => clearInterval(id)
}, [])
```

**Use refs for mutable values that shouldn't trigger re-renders:**
```tsx
const latestCallback = useRef(callback)
useEffect(() => { latestCallback.current = callback })

useEffect(() => {
  const handler = () => latestCallback.current()
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

### useLayoutEffect vs useEffect
- `useEffect` — runs after paint, non-blocking
- `useLayoutEffect` — runs before paint, blocks rendering
- Use `useLayoutEffect` only for DOM measurements or visual updates that would flicker

### Extract to Custom Hooks
Move complex effect logic into custom hooks for reusability and cleaner components:
```tsx
const useWindowSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handler = () => setSize({
      width: window.innerWidth,
      height: window.innerHeight
    })
    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return size
}
```

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

Create a `createTypeGuards<T>` factory for consistent guards across all API types:

```typescript
function createTypeGuards<T>(typeName: string) {
  const singular = (data: unknown): data is T =>
    data != null && typeof data === "object" && "id" in data && "itemType" in data
      && (data as any).itemType === typeName

  const plural = (data: unknown): data is T[] =>
    Array.isArray(data) && data.length > 0 && data.every(singular)

  const parse = (data: unknown): T | null =>
    singular(data) ? data : null

  const parseArray = (data: unknown): T[] =>
    plural(data) ? data : []

  return { singular, plural, parse, parseArray }
}

// Usage — one line per collection type
export const { singular: isUser, parse: parseUser } = createTypeGuards<User>("user")
export const { singular: isProduct, parse: parseProduct } = createTypeGuards<Product>("product")
```

Before writing DaisyUI component markup, run `open_nodes(["VendorDaisyui5"])`.
Before writing dialogs, popovers, menus, selects, or tooltips, run `open_nodes(["VendorBaseUiReact"])`.
Before writing route components, run `search_nodes("domain: routing")` → `open_nodes` on results.

## See Also

- `core/state-management` — When to use Context vs Zustand vs Redux (auto-loaded)
- `core/ssr-hydration` — Client-only code patterns (auto-loaded)
- `core/i18n` — Translation in components (auto-loaded)
