---
version: 1.0.0
applies: "@playwright/test@1"
target: rules
domain: testing
paths:
  - "**/e2e/**/*.ts"
  - "**/*.spec.ts"
  - "**/playwright.config.ts"
tags: [playwright, e2e, testing, browser, locators, actionability, fixtures, network, trace]
---

# Playwright

API gotchas, setup patterns, and reliability practices specific to Playwright. Project-level E2E conventions (selectors, tags, fixtures, data-testid naming) live in `core/e2e-testing`; post-run validation (logs, traces, network) lives in `core/e2e-validation`.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Official docs | https://playwright.dev/docs/intro | Start here |
| API reference | https://playwright.dev/docs/api/class-playwright | Full API |
| Best practices | https://playwright.dev/docs/best-practices | Official recommendations |
| Locators | https://playwright.dev/docs/locators | Selector strategies |
| Actionability | https://playwright.dev/docs/actionability | What auto-waits, what doesn't |
| Network | https://playwright.dev/docs/network | `route`, `waitForResponse`, request API |
| Fixtures | https://playwright.dev/docs/test-fixtures | `test.extend`, scoping |
| Parallelism | https://playwright.dev/docs/test-parallel | Workers, serial, fullyParallel |
| Trace viewer | https://playwright.dev/docs/trace-viewer | Post-mortem debugging |
| Context7 | `/microsoft/playwright` | Good coverage |
| GitHub issues | https://github.com/microsoft/playwright/issues | Search before filing |

## Quick Reference — APIs that bite

| You might reach for | Actually do | Why |
|---------------------|-------------|-----|
| `locator.isVisible({ timeout })` | `await expect(locator).toBeVisible({ timeout })` OR `locator.waitFor({ state: 'visible', timeout })` | `isVisible()` / `isHidden()` / `isEnabled()` / `isChecked()` do NOT wait. The `timeout` option is advisory — the method returns the DOM state at call time. |
| `locator.count()` inside an assertion | `await expect(locator).toHaveCount(n)` | `count()` is a sync DOM read; no retry. `toHaveCount` polls. |
| `page.textContent()` for assertion text | `await expect(locator).toHaveText('...')` | Same — `textContent()` is a one-shot read. |
| `page.click()` then `await waitForResponse(...)` | register `waitForResponse` **before** the click | Responses can fire before your subscription; bare sequential calls time out. |
| `waitForResponse(backendUrl)` in SSR apps | match the framework action URL (`POST /<current-route>`) | Backend calls made inside a server-side loader/action never reach the browser. |
| `page.getByText('Sign in')` in an i18n app | `getByTestId` or attribute-based selectors (`input[type="email"]`) | Text selectors break on locale switch. |
| `page.waitForTimeout(1000)` to "let things settle" | any `waitFor*` / `toBe*` with a timeout | Hard sleeps are the #1 cause of flakiness. |
| Bare `page.goto(url)` after an action-triggered redirect | `page.waitForURL(...)` after the trigger | `goto` races in-flight navigations. |

## Setup

### `playwright.config.ts` essentials

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,                       // run tests in parallel by default
  workers: process.env.CI ? 1 : undefined,   // conservative in CI; default = 1/2 of CPUs
  retries: process.env.CI ? 2 : 0,           // retries hide flakiness — use sparingly
  timeout: 60_000,                           // per-test timeout
  expect: { timeout: 10_000 },               // per expect-matcher timeout
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    actionTimeout: 10_000,                   // per action (click, fill)
    navigationTimeout: 30_000,               // per navigation
    trace: 'retain-on-failure',              // keep trace only for failures
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  // Optional — only if you want Playwright to start the app itself
  // webServer: { command: 'yarn dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
})
```

**Timeout layering:** `timeout` (whole test) > `navigationTimeout` / `actionTimeout` (per call) > `expect.timeout` (per matcher). Any single overrun aborts the enclosing scope.

**Retries are a smell.** They're for truly flaky infrastructure (network blips, third-party services). Don't let retries mask a race in your test code — diagnose the root cause.

### Projects

Each `project` is a separate run configuration (browser, viewport, baseURL, env). Target with `--project=chromium`. Good for:
- Browser matrix (chromium / firefox / webkit)
- Device matrix (desktop / mobile)
- Environment matrix (dev / staging) via different `baseURL`

Skip-by-project idiom inside a test:
```typescript
test.skip(testInfo.project.name !== 'chromium', 'single-browser assertion')
```

### `test.extend` fixtures

```typescript
import { test as base } from '@playwright/test'

type Fixtures = {
  authenticatedPage: Page
  adminToken: string
}

export const test = base.extend<Fixtures, { adminToken: string }>({
  // test-scoped: fresh per test
  authenticatedPage: async ({ page }, use) => {
    await login(page)
    await use(page)
    // optional teardown here
  },

  // worker-scoped: once per worker (second tuple slot in generics + 3rd arg)
  adminToken: [async ({}, use) => {
    const token = await fetchAdminToken()
    await use(token)
  }, { scope: 'worker' }],
})
```

Worker-scoped fixtures are for expensive setup that doesn't mutate (tokens, DB seeds). Anything a test mutates should be test-scoped.

## Locators — how Playwright finds elements

Locators are **lazy** — they describe how to find an element, not a reference to one. Every action re-queries the DOM, so a locator survives re-renders.

```typescript
// A locator — no DOM query yet
const submit = page.getByTestId('submit')

// Each call below re-queries
await submit.click()
await expect(submit).toBeEnabled()
```

### Priority order (per Playwright best practices)

1. `getByRole('button', { name: 'Save' })` — accessibility-first, user-visible intent
2. `getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle` — form/semantic
3. `getByTestId` — explicit test hooks, refactor-safe, i18n-safe
4. `locator('css')` — last resort

For i18n apps, `getByTestId` is usually the right default because role/label strategies match on localized text.

### Strict mode

Every locator action asserts exactly one match. Multiple matches throw. Narrow first:

```typescript
// ❌ Throws if multiple forms on page
await page.getByLabel('Email').fill('...')

// ✅ Scope to a specific form first
await page.getByTestId('login-form').getByLabel('Email').fill('...')

// Use .first() / .nth() / .last() only when ambiguity is intentional
await page.getByTestId('product-card').first().click()
```

### Filtering

```typescript
// By child text
page.getByRole('listitem').filter({ hasText: 'Mango' })

// By presence of a child
page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Product 2' }) })

// Chained scoping
const product = page.getByTestId('product-card').filter({ hasText: 'Bike' })
await product.getByRole('button', { name: 'Add to cart' }).click()
```

## Auto-waiting and actionability

`click`, `fill`, `check`, `hover`, `dblclick`, `selectOption`, etc. auto-wait for the element to be **attached, visible, stable, enabled, and able to receive events**. Don't pre-check.

```typescript
// ❌ Redundant + introduces a race (isVisible doesn't wait)
if (await page.getByTestId('submit').isVisible()) {
  await page.getByTestId('submit').click()
}

// ✅ click() auto-waits
await page.getByTestId('submit').click()
```

**Expect-matchers auto-retry** up to `expect.timeout`:
```typescript
await expect(locator).toBeVisible()
await expect(locator).toHaveText('Loaded')
await expect(locator).toHaveCount(3)
await expect(page).toHaveURL(/dashboard/)
```

Use `locator.waitFor({ state })` when you need to wait without asserting:
```typescript
await modal.waitFor({ state: 'visible' })
await spinner.waitFor({ state: 'detached' }) // wait for it to disappear
```

## Waiting — the right tool

| Goal | Use |
|------|-----|
| Assert state (and retry until it's true) | `expect(locator).toBe*()` |
| Wait without asserting | `locator.waitFor({ state })` |
| Wait for navigation to a URL | `page.waitForURL(urlOrRegex)` |
| Wait for a response | `page.waitForResponse(predicate)` (register BEFORE the trigger) |
| Wait for a request | `page.waitForRequest(predicate)` |
| Wait for a function to return truthy in the page | `page.waitForFunction(fn)` |
| Settle a specific amount of time | Never. Find a real signal. |

### The subscribe-before-trigger pattern

```typescript
// ❌ Race — response may fire before subscription
await page.getByTestId('submit').click()
const res = await page.waitForResponse(r => r.url().includes('/api/foo'))

// ✅ Subscribe, trigger, await
const resP = page.waitForResponse(r => r.url().includes('/api/foo'))
await page.getByTestId('submit').click()
const res = await resP

// ✅ Multiple concurrent pages
const aP = pageA.waitForResponse(predicate)
const bP = pageB.waitForResponse(predicate)
await Promise.all([pageA.locator('...').click(), pageB.locator('...').click()])
const [aRes, bRes] = await Promise.all([aP, bP])
```

### `waitForResponse` predicate patterns

```typescript
// Match URL substring
page.waitForResponse(r => r.url().includes('/api/checkout'))

// Match method + URL
page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/checkout'))

// Match status
page.waitForResponse(r => r.url().includes('/api/foo') && r.status() === 200)
```

### URL globs and regex

`waitForURL('**/foo')` matches any path ending in `/foo`, but query strings slip past:

```typescript
// ❌ Won't match /foo?x=1
await page.waitForURL('**/foo')

// ✅ Tolerate query strings
await page.waitForURL(/\/foo(\?|$)/)
```

## Network — interception

### `page.route()` — mock or modify requests

```typescript
// Stub an API response
await page.route('**/api/products', async route => {
  await route.fulfill({ status: 200, json: { docs: [...] } })
})

// Let it pass through but delay
await page.route('**/api/slow', async route => {
  await new Promise(r => setTimeout(r, 2000))
  await route.continue()
})

// Modify headers
await page.route('**/api/**', async route => {
  const headers = { ...route.request().headers(), 'x-test': '1' }
  await route.continue({ headers })
})
```

Register routes **before** the triggering navigation. Unroute with `page.unroute(pattern)` when done.

### `request` fixture — API-level calls outside the browser

```typescript
test('seed data via API', async ({ request }) => {
  const res = await request.post('/api/login', { data: { email, password } })
  expect(res.ok()).toBeTruthy()
})
```

Useful for test setup/teardown that bypasses the UI. Shares cookies with the browser context if you use `page.context().request`.

## Parallelism and isolation

### Context boundaries

- Each **test** gets a fresh browser context by default (cookies, localStorage, cache isolated).
- **Workers** are OS processes. Tests within a worker run sequentially; workers run in parallel.
- Backend/DB state is NOT isolated — Playwright has no opinion about what your app stores server-side.

### `test.describe.configure({ mode: 'serial' })`

Forces tests within the describe to run sequentially **and propagates failures** — the first failure skips all downstream tests in that describe. Skipped tests don't report their own pass/fail, so regressions downstream stay hidden until you fix the upstream.

Use serial mode only when tests genuinely share mutable state (e.g., a `sharedPage` created in `beforeAll`). Otherwise keep tests independent and let Playwright parallelize.

### `test.use({ ... })` — per-test/per-describe overrides

```typescript
test.describe('mobile flow', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })
  test('...', async ({ page }) => { /* runs at mobile viewport */ })
})
```

### Worker index

`testInfo.workerIndex` / `testInfo.parallelIndex` gives you a stable worker id — useful for allocating per-worker resources (unique accounts, DBs):

```typescript
const email = `e2e-worker-${testInfo.parallelIndex}-${Date.now()}@test.example.com`
```

### Shared backend = shared state

Two workers pointing at the same backend share its database. Anything server-side (carts tied to a user, seeded content, rate limits) can collide. Use unique per-test data (timestamps, worker index) and clean up in `afterEach` / test `finally`.

## Iframes

`page.frameLocator()` descends into an iframe. Input inside an iframe needs its own locator chain:

```typescript
const stripe = page.frameLocator('iframe[name^="__privateStripeFrame"]')
await stripe.getByLabel('Card number').fill('4242424242424242')
await stripe.getByLabel('CVC').fill('123')

// Focus can get stuck inside the iframe — click outside before submitting
await page.getByTestId('payment-form').click({ position: { x: 5, y: 5 } })
await page.getByTestId('submit').click()
```

Iframe-internal elements are out of reach of `page.keyboard` / `page.mouse` at page-level coordinates. Use the frame locator's methods.

## Dialogs and downloads

**Dialogs (alert/confirm/prompt) block the page.** Register a handler before triggering:
```typescript
page.once('dialog', d => d.accept())
await page.getByTestId('delete').click()
```

**Downloads:**
```typescript
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByTestId('export').click(),
])
const path = await download.path()
```

## Debugging

### Trace viewer — the first tool to reach for

```bash
# Run with full trace
npx playwright test path/to.spec.ts --trace on

# View a saved trace
npx playwright show-trace test-results/.../trace.zip
```

Traces include DOM snapshots at every step, network calls, console, source — 90% of debugging starts here.

### UI mode

```bash
npx playwright test --ui
```

Watch mode with step-through, time-travel debugging, locator picker.

### Headed / slow-mo

```bash
npx playwright test --headed --project=chromium
# or in config: use: { launchOptions: { slowMo: 500 } }
```

### `page.pause()` — interactive breakpoint

```typescript
await page.pause() // opens the Playwright inspector at this point
```

Useful for investigating a failing test without restructuring it.

## Common flakiness diagnoses

| Symptom | Usual cause |
|---------|-------------|
| Intermittently fails on CI, passes locally | Real race — timing-sensitive assertion. `isVisible` without `expect`, `count()` without retry, or manual `waitForTimeout`. |
| Passes in isolation, fails in parallel | Shared backend state. Another worker is mutating the data this test reads/expects. |
| `waitForResponse` times out but the response clearly fired | Subscribed after the trigger, or predicate matches the backend URL in an SSR app where only the framework-action URL is visible to the browser. |
| Strict-mode violation "2 elements found" | Locator matches too broadly — narrow with scoping or `.filter()`. |
| `click()` times out with "element not stable" | CSS animation or layout shift during interaction. Wait for the animation to end (`waitFor({ state: 'visible' })` on a post-animation sibling, or disable animations in tests). |
| Test finishes fast then finally block reports cleanup errors | Test threw mid-flight with in-flight HTTP requests; teardown races them. Await critical responses before the assertion that can throw. |

## See Also

- `core/e2e-testing` — project-level conventions (selectors, tags, fixtures, test ID naming) (auto-loaded)
- `core/e2e-validation` — post-run validation procedure (auto-loaded)
