---
version: 1.0.2
applies: react
target: rules
domain: frontend
paths:
  - "**/*.tsx"
  - "**/*.ts"
tags: [state, zustand, context, react-query]
---

# State Management Libraries

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Zustand docs | https://zustand.docs.pmnd.rs/ | Primary state library |
| Zustand GitHub | https://github.com/pmndrs/zustand | Source, issues |
| React docs | https://react.dev/reference/react/useContext | Context API reference |
| Context7 | `/pmndrs/zustand` | Zustand coverage |

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
- DevTools support via middleware

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
