---
version: 1.2.1
applies: react
target: rules
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "!**/*.test.*"
  - "!**/*.spec.*"
tags: [state, useState, useReducer, context, zustand]
---

# React State Management

## Decision Framework

```
┌─────────────────────────────────────────────────────────────────┐
│                    What kind of state?                          │
└─────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   Server Data          UI/Local State      Shared Client State
        │                    │                    │
        ▼                    ▼                    ▼
   TanStack Query       useState/useReducer   Context or Library?
   (React Query)                                     │
                                    ┌───────────────┴───────────────┐
                                    ▼                               ▼
                            Simple + Few consumers           Complex/Performance-critical
                            Low-frequency updates            Many consumers
                                    │                               │
                                    ▼                               ▼
                               useContext                    Zustand
```

## When useContext is Enough

**Good for:**
- Theme (light/dark mode)
- Authentication status / current user
- Locale / language preference
- Feature flags
- Any "low-frequency" state that rarely changes

**Why it works:** These values change infrequently, so the "all consumers re-render" behavior doesn't matter.

**Example:**
```tsx
// ✅ Good use of Context — theme changes rarely
const ThemeContext = createContext<Theme>('light')

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('light')
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}
```

## When useContext is NOT Enough

**Signs you need a library:**
- State updates frequently (typing, dragging, timers)
- Many components consume different parts of the same state
- You're adding `useMemo` / `memo` everywhere to fix re-renders
- Complex derived state or cross-slice dependencies
- Need to update state from outside React (event handlers, WebSockets)

**The problem:** Context re-renders ALL consumers when ANY value changes, even if a component only uses part of the data.

```tsx
// ❌ Bad — CartContext changes on every item add, re-renders EVERYTHING
const CartContext = createContext<{ items: Item[]; total: number }>()

// Header only needs item count, but re-renders when total changes too
const Header = () => {
  const { items } = useContext(CartContext) // re-renders on ANY cart change
  return <span>Cart ({items.length})</span>
}
```

See `vendor/state-management-libs` (auto-loaded) for library examples (Zustand, Context optimization).

## Server State ≠ Client State

See `vendor/react-router-7/data-loading` (auto-loaded for route files) for loader vs client state patterns.

**Never use Zustand for server data.** Use TanStack Query instead.

```tsx
// ❌ Don't do this
const useStore = create((set) => ({
  users: [],
  fetchUsers: async () => {
    const users = await api.getUsers()
    set({ users })
  },
}))

// ✅ Do this — TanStack Query handles caching, refetching, loading states
const { data: users } = useQuery({
  queryKey: ['users'],
  queryFn: api.getUsers,
})
```

## Quick Decision Guide

| Scenario | Use |
|----------|-----|
| Theme, auth, locale | `useContext` |
| Form state (single component) | `useState` / `useReducer` |
| Server data (API responses) | TanStack Query |
| Shopping cart, filters, UI preferences | Zustand |

## See Also

- `core/frontend/react-components` — Component patterns, useEffect (auto-loaded)
- `core/frontend/ssr-hydration` — Hydration considerations for state (auto-loaded)
