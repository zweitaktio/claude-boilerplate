---
version: 1.0.1
applies: react
target: rules
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "!**/*.test.*"
  - "!**/*.spec.*"
tags: [state, useState, useReducer, context, zustand, jotai]
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
                               useContext                    Zustand / Jotai / Redux
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

## Library Comparison

| Library | Bundle | Mental Model | Best For |
|---------|--------|--------------|----------|
| **Zustand** | ~1KB | Single store (like Redux) | Most apps — simple API, no boilerplate |
| **Jotai** | ~1.2KB | Atoms (bottom-up) | Fine-grained reactivity, Suspense |
| **Redux Toolkit** | ~15KB | Single store + reducers | Enterprise, large teams, strict patterns |
| **Recoil** | ~15KB | Atoms + selectors | Complex derived state, dev tools |

## Zustand (Recommended Default)

**When to use:** Most apps. Simple API, no providers, works outside React.

```tsx
import { create } from 'zustand'

interface CartStore {
  items: Item[]
  addItem: (item: Item) => void
  removeItem: (id: string) => void
  total: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id)
  })),
  total: () => get().items.reduce((sum, i) => sum + i.price, 0),
}))

// Components subscribe to specific slices — only re-render when that slice changes
const Header = () => {
  const itemCount = useCartStore((state) => state.items.length)
  return <span>Cart ({itemCount})</span>
}

const Total = () => {
  const total = useCartStore((state) => state.total())
  return <span>${total}</span>
}
```

**Key benefits:**
- No Provider wrapper needed
- Selectors prevent unnecessary re-renders
- Works outside React (WebSocket handlers, etc.)
- Redux DevTools support via middleware

## Jotai (For Atomic State)

**When to use:** Fine-grained reactivity, Suspense integration, code-splitting atoms.

```tsx
import { atom, useAtom, useAtomValue } from 'jotai'

// Primitive atoms
const itemsAtom = atom<Item[]>([])

// Derived atom (read-only)
const totalAtom = atom((get) =>
  get(itemsAtom).reduce((sum, i) => sum + i.price, 0)
)

// Derived atom (read-write)
const addItemAtom = atom(
  null,
  (get, set, item: Item) => set(itemsAtom, [...get(itemsAtom), item])
)

// Components only re-render when their specific atom changes
const Header = () => {
  const items = useAtomValue(itemsAtom)
  return <span>Cart ({items.length})</span>
}

const Total = () => {
  const total = useAtomValue(totalAtom)
  return <span>${total}</span>
}
```

**Key benefits:**
- Components subscribe to exactly what they need
- Derived state is declarative and cached
- Built-in Suspense support for async atoms
- Atoms can be split across bundles

## Redux Toolkit (For Enterprise)

**When to use:** Large teams, strict patterns, complex middleware, time-travel debugging.

```tsx
import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit'

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] as Item[] },
  reducers: {
    addItem: (state, action: PayloadAction<Item>) => {
      state.items.push(action.payload)
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload)
    },
  },
})

export const store = configureStore({ reducer: { cart: cartSlice.reducer } })
export const { addItem, removeItem } = cartSlice.actions
```

**Key benefits:**
- Strict, predictable patterns
- Excellent DevTools
- Middleware ecosystem (thunks, sagas, etc.)
- Time-travel debugging

## Server State ≠ Client State

**Never use Zustand/Redux/Jotai for server data.** Use TanStack Query instead.

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
| Many independent pieces, fine-grained updates | Jotai |
| Large team, strict patterns, complex workflows | Redux Toolkit |

## Optimizing Context (If You Must)

If you can't add a library, optimize Context:

1. **Split state and dispatch:**
```tsx
const StateContext = createContext<State>(initialState)
const DispatchContext = createContext<Dispatch>(() => {})

// Components that only dispatch don't re-render on state changes
```

2. **Memoize the value:**
```tsx
const value = useMemo(() => ({ user, theme }), [user, theme])
return <MyContext.Provider value={value}>{children}</MyContext.Provider>
```

3. **Use `use-context-selector` library** for selector-based subscriptions.

Before deciding what belongs in a loader vs client state, run `open_nodes(["VendorReactRouter7DataLoading"])`.

## See Also

- `core/react-components` — Component patterns, useEffect (auto-loaded)
- `core/ssr-hydration` — Hydration considerations for state (auto-loaded)
