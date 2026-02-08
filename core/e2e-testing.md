---
version: 1.1.0
applies: playwright | "@playwright/test"
target: rules
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/tests/**"
  - "**/e2e/**"
  - "**/playwright*"
tags: [testing, e2e, playwright, selectors, test]
---

# E2E Testing Conventions

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Playwright docs | https://playwright.dev/docs/intro | Official docs |
| API reference | https://playwright.dev/docs/api/class-playwright | Full API |
| Best practices | https://playwright.dev/docs/best-practices | Official recommendations |
| Locators | https://playwright.dev/docs/locators | Selector strategies |
| Context7 | `/microsoft/playwright` | Good coverage |
| GitHub | https://github.com/microsoft/playwright | Source, issues |

## Selector Strategy: data-testid

Always prefer `data-testid` attributes over text-based selectors.

### Why
- **Language independent** — tests work regardless of UI locale
- **Refactoring safe** — changing button text won't break tests
- **Clear intent** — test IDs document which elements are testable
- **No strict mode violations** — unique IDs avoid matching multiple elements

### Component Side
```tsx
<Button data-testid="invite-btn">
  {t("invite")}
</Button>

<Dialog data-testid="invite-dialog">
  ...
</Dialog>
```

### Test Side
```typescript
await page.getByTestId("invite-btn").click()
await expect(page.getByTestId("invite-dialog")).toBeVisible()
```

### Naming Convention

Kebab-case with descriptive suffixes:

| Suffix | Element |
|--------|---------|
| `-btn` | Buttons |
| `-dialog` | Dialogs/modals |
| `-input` | Text inputs |
| `-select` | Dropdowns |
| `-list` | Lists/tables |
| `-item` | List items |
| `-heading` | Important headings |
| `-empty-state` | Empty state messages |

### When to Add Test IDs
- Interactive elements being tested (buttons, links, inputs)
- Dialogs/modals that tests verify
- Lists and their items for data verification
- Empty states for conditional UI testing
- Key headings that tests verify

### When NOT to Use Test IDs
- Elements accessed via unambiguous ARIA roles
- URL-based navigation assertions
- Internal implementation details not under test
