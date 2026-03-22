---
version: 1.0.0
applies: playwright | "@playwright/test"
target: rules
paths:
  - "**/*.spec.*"
  - "**/e2e/**"
  - "**/playwright*"
  - "backend/**"
  - "frontend/**"
  - "**/routes/**"
tags: [testing, e2e, playwright, validation, debugging]
---

# E2E Test Validation Procedure

When running E2E tests, validating a feature via browser, or debugging failures — follow this three-layer procedure. A passing test can still hide problems.

## Prerequisites

1. Services running (Docker containers, databases)
2. Dev servers running (backend + frontend)
3. Proxy/app URL loads in browser

## Running Tests

From the services/test directory:

```bash
yarn e2e                                          # all tests
yarn e2e -- src/e2e/user/home/bookings.spec.ts    # single file
yarn e2e -- --grep @smoke                         # by tag
yarn e2e -- --project=chromium                    # specific project
```

## Three-Layer Validation

### Layer 1: Test Results

| Signal | Meaning |
|--------|---------|
| `PASS` | Assertions passed — still check Layer 2 and 3 |
| `FAIL` with timeout | Element not found — wrong selector, page didn't load, or slow backend |
| `FAIL` with assertion | Element found but wrong state — logic bug or race condition |
| `SKIP` | Test skipped itself — verify that's expected |
| `RETRY` then `PASS` | Flaky — investigate even though it passed |

On failure: check test output directory for screenshots and traces.

### Layer 2: Network Requests

Use Playwright MCP (`browser_network_requests`) or Playwright traces to inspect what the browser did.

**Check for:**
- **Failed API calls** (4xx, 5xx) — a page can render "empty state" without errors if the API silently fails
- **Missing API calls** — if a list is empty, did the fetch even fire?
- **Redirect chains** — auth redirects should land on the right page, not loop
- **WebSocket connections** — if the app uses WebSocket for real-time updates, verify it connects
- **Slow responses** (>2s) — may cause timeouts in tests

### Layer 3: Server Logs

Check both frontend and backend logs after test runs.

**Log locations:** Check `.logs/dev-server.log` in each workspace (created by `dev.sh`).

**Backend — look for:** `ERROR`/`WARN` entries, stack traces, auth failures, database connection errors.

**Frontend — look for:** SSR/loader errors, hydration mismatches, unhandled promise rejections, `TypeError`/`ReferenceError` during render.

Use the Grep tool on log files — not bash grep.

## Validation Checklist

Run through after every E2E test run or manual browser validation:

| Check | How |
|-------|-----|
| Tests pass | Read Playwright output |
| No flaky retries | Check for `RETRY` in output |
| No failed network requests | `browser_network_requests` or Playwright trace |
| WebSocket connected | Network shows `101 Switching Protocols` |
| No backend errors | Grep `error` in backend log |
| No frontend SSR errors | Grep `error` in frontend log |
| Correct data rendered | Empty states should be real, not fallbacks for failed fetches |

## Manual Browser Validation (Playwright MCP)

1. `browser_navigate` to the page
2. `browser_snapshot` — accessibility tree (faster than screenshot)
3. `browser_network_requests` — check API calls
4. `browser_console_messages` — check for JS errors
5. `browser_take_screenshot` — only when visual layout matters

Auth: navigate to the login page first. Credentials are in CLAUDE.md.

## Writing New E2E Tests

See `core/testing/e2e-testing` for selector strategy, naming, and test structure. Test files go in the e2e test directory under the relevant domain.
