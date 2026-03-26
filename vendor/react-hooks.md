---
version: 1.0.2
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
| Context7 | `/facebook/react` | Good coverage |

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
