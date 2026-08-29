---
version: 1.1.1
applies: react
target: rules
domain: frontend
paths:
  - "**/*.tsx"
  - "**/*.ts"
tags: [react, hooks, useEffect, cleanup, race-conditions, stale-closures, type-guards]
---

# React Hook Patterns

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| React docs | https://react.dev/reference/react | Hooks API reference |
| GitHub | https://github.com/facebook/react | Source, issues |

## API Type Guard Factory

Use `createTypeGuards<T>` for consistent runtime type checking across all API types:

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
- Strict Mode runs the setup, then the cleanup, then the setup again. This sequence verifies correctness

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

**A debounced writer built once freezes everything it closes over.** Creating it in a `useState`
initialiser (or a `useMemo` with `[]`) captures mount-time values for the life of the component:

```tsx
const [debouncedUpdate] = useState(() =>
  debounce((v: string) => updateParams({ keyword: v }), 300),   // ❌ updateParams frozen at mount
)
```

With URL state this shows up as a filter chosen a moment ago vanishing when you type in the search
box, while filters already present at page load survive — that asymmetry is the tell, because the
stale closure writes the mount-time query string back over everything set since.

**A functional updater is not sufficient here.** React Router's `setSearchParams` is itself recreated
per render and carries *that render's* params into the callback, so
`setSearchParams(prev => merge(prev, updates), { replace: true })` still receives mount-time `prev`
when reached through a frozen closure. Route the call through a ref — and keep the functional form as
well, since it is correct on its own terms:

```tsx
const updateParamsRef = useRef(updateParams)
useEffect(() => { updateParamsRef.current = updateParams })

const [debouncedUpdate] = useState(() =>
  debounce((v: string) => updateParamsRef.current({ keyword: v }), 300),   // ✅
)
```

Extracting the merge into a pure reducer makes this testable — a hook needs a DOM, a reducer does not.

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
