---
version: 1.3.2
applies: react-router | next | remix
target: rules
paths:
  - "**/*.tsx"
  - "**/*.ts"
tags: [ssr, hydration, client-only, server-only, useEffect, mounted]
---

# SSR Hydration Safety

## Client-Only Code Guard

```typescript
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

if (!mounted) return <ServerFallback />
return <ClientOnlyComponent />
```

## ClientOnly Wrapper Component

Reusable wrapper for client-only content:

```typescript
interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

export const ClientOnly = ({ children, fallback = null }: ClientOnlyProps) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <>{children}</> : <>{fallback}</>
}

// Usage
<ClientOnly fallback={<Skeleton />}>
  <BrowserOnlyComponent />
</ClientOnly>
```

## Common Hydration Mismatch Causes
- Direct browser API usage (`window`, `document`, `localStorage`) in render
- `Date.now()` or `Math.random()` in render (different server vs client)
- Different content server vs client
- Client-only libraries without guards (drag-and-drop, editors, etc.)

## Safe Browser API Access

```typescript
// Guard browser APIs
if (typeof window !== 'undefined') {
  // Browser-only code
}

// Or use useEffect (always client-side)
useEffect(() => {
  // Safe to use window, document, etc.
}, [])
```

## No Timers in SSR

```typescript
// ❌ Never — memory leaks + hydration mismatches
setInterval(() => { ... }, 1000)
setTimeout(() => { ... }, 1000)

// ✅ Promise-based delay (server-safe)
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
await delay(1000)

// ✅ Debounce/throttle via library (client-safe)
import { debounce } from 'es-toolkit'
const debouncedFn = debounce(fn, 300)
```

## Event-Driven Pattern (Instead of Polling)

Use check-on-access instead of timers:

```typescript
class RateLimiter {
  private count = 0
  private resetTime = Date.now() + 60000

  checkAndReset() {
    if (Date.now() >= this.resetTime) {
      this.count = 0
      this.resetTime = Date.now() + 60000
    }
  }

  increment() {
    this.checkAndReset()
    return ++this.count
  }
}
```

## Environment Variables

`process.env` is only available server-side. Access env vars only in loaders, actions, and `.server` modules — never in components or shared utilities that run in the browser.

```typescript
// ✅ Safe — loader runs server-side only
export async function loader() {
  const apiKey = process.env.API_SECRET
}

// ❌ Leaks to client bundle — breaks at runtime
export const MyComponent = () => {
  const key = process.env.API_SECRET  // undefined in browser
}
```

Only variables prefixed with `VITE_` (Vite) or `PUBLIC_` are available client-side. Never put secrets in prefixed variables.

## Rules
- Never use `setInterval`/`setTimeout` at module scope or in SSR render paths
- Use event-driven patterns (check-on-access) instead of polling
- Use `useEffect` cleanup for any client-side timers
- Never access `process.env` in components or shared modules — use loaders/actions or `.server` files

See `vendor/react-router-7/rendering-strategies` (auto-loaded for route files) for rendering strategy patterns.

## See Also

- `core/react-components` — Component patterns (auto-loaded)
- `core/code-review` — SSR safety checks (auto-loaded)
