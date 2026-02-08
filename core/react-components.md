---
version: 1.3.0
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

## See Also

- `core/state-management` — When to use Context vs Zustand vs Redux (auto-loaded)
- `core/ssr-hydration` — Client-only code patterns (auto-loaded)
- `core/i18n` — Translation in components (auto-loaded)
- KG entity `VendorDaisyui5` — UI component styling (`search_nodes("domain: styling")`)
- KG entities `VendorReactRouter7*` — Route component patterns (`search_nodes("domain: routing")`)
