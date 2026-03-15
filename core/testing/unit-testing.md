---
version: 1.1.0
applies: vitest
target: rules
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/vitest*"
  - "!**/*.test.tsx"
  - "!**/*.spec.tsx"
  - "backend/**"
tags: [testing, vitest, unit-test, mock, test-data]
---

# Unit Testing Conventions

## Framework

- **Vitest** — the only supported test runner
- **Node environment** — no jsdom, no browser APIs
- **Plain functions only** — test business logic, utilities, and data transformations

## What to Test

```typescript
// ✅ Test these
import { calculateTotal } from "./calculate-total"
import { formatCurrency } from "./format-currency"
import { validateEmail } from "./validate-email"

test("calculateTotal sums items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 20 }])).toBe(30)
})
```

## What NOT to Test

```typescript
// ❌ No React component tests — no jsdom, no @testing-library
import { render } from "@testing-library/react"  // FORBIDDEN
render(<Button />)                                // FORBIDDEN

// ❌ No .tsx test files
// Tests must be .test.ts, never .test.tsx
```

## Test File Convention

- Files: `*.test.ts` (never `.tsx`)
- Location: colocated with source or in `__tests__/` directory
- Environment: Node only

## Mock Data

Centralize mock data in a shared location:

```
app/lib/testing/mock-data/
├── common.ts       # Shared utilities
├── users.ts        # Mock users
├── journeys.ts     # Mock domain objects
└── index.ts        # Re-exports
```

```typescript
// mock-data/users.ts
import type { User } from "~/services/api/payload/payload-types"

export const mockUser: User = {
  id: 1,
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  // ... required fields
}
```

## Commands

```bash
yarn test              # Run once
yarn test:watch        # Watch mode
yarn test:coverage     # Coverage report
yarn test:ui           # UI runner
```
