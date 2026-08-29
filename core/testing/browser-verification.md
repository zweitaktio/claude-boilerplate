---
version: 1.1.1
applies: Always
target: rules
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/routes/**"
  - "**/routes.ts"
tags: [browser, verification, claude-in-chrome, playwright, ui, done]
---

# Browser Verification

**A change that affects the app is not done until it has been driven in the running UI.** A green
typecheck, a passing unit test and a successful `curl` prove the server answered — never that the
screen is right. This blocks reporting done and blocks closing the issue. Exemptions exist (a pure
backend change, a build-config edit) but must be **stated, not assumed**.

**For a backend-only change, skip the browser.** Authenticate for a token, then `curl` the endpoint —
that is the faster and more precise verification for that layer.

## Driving the browser

**Use Claude in Chrome when it is available**, ahead of Playwright MCP. Invoke the `claude-in-chrome`
skill first, then batch every `mcp__claude-in-chrome__*` tool you expect to need into **one**
`ToolSearch` call — one call per tool wastes a round-trip each.

- **Always open a new tab** (`tabs_create_mcp`) rather than reusing one of the user's, and call
  `tabs_context_mcp` first. Never reuse a tab id from an earlier session.
- **Never drive by coordinates.** Screenshots come back scaled — a 1718×2416 viewport arrives as
  924×1299 — so a coordinate computed from the image lands somewhere else entirely.
- **A ref click is frequently not enough.** `computer{left_click, ref}` often dispatches nothing: a
  link stays put, a submit button does not submit. Drive with a **native call inside an evaluated
  script** — `element.click()`, or `form.requestSubmit()` for a form.
- **Set controlled inputs through the native value setter**, or React never sees the change:
  ```js
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  set.call(input, 'value'); input.dispatchEvent(new Event('input', { bubbles: true }))
  ```
- **Images are lazy.** Reading the DOM straight after load shows tiles with no `<img>`. Take a
  screenshot (which forces a paint) or scroll the container, then re-read.

## Measure after every action, not only at the end

**A retried click on a toggle is not a retry — it is an undo.** When a control seems unresponsive, the
instinct is to try a second click mechanism in the same probe to compare. Both land, the state returns
to where it started, and the final reading is identical to what a dead button produces. That is worse
than a hang, because it yields a *plausible answer* — exactly the value the broken-button hypothesis
predicts — and it has produced skipped tests and advice to peers to stop driving clicks at all.

**Try exactly one mechanism per page load, and read the state after each action:**

```ts
const before = await page.evaluate(() => location.search)
await page.getByTestId('chip').click()
const afterFirst = await page.evaluate(() => location.search)   // ← the measurement that matters
```

Anything toggle-shaped is affected — filter chips, checkboxes, sort direction, expand/collapse,
selection mode — as is any action without idempotence: a second "add to album" adds twice, a second
stepper click moves two steps.

## A wedged tab looks exactly like a broken app

`Runtime.evaluate` timing out, or `executeScript waited 45000ms for document_idle`, usually means the
tab is stuck — not that you broke the app. Tell them apart with `curl` against the dev server: an SSR
**200 with full HTML** means the app is fine and the tab is the problem. A fresh tab often does not
help; switch tools instead of retrying.

**Your own probe is the usual culprit.** Never combine `attributes: true` with `subtree: true` on
`body` — that fires for every attribute write in the document, so a re-render storm (an upload grid,
a list refresh) runs the callback thousands of times, each doing a full `querySelector`. The main
thread never yields and CDP cannot evaluate. Watch `childList` only, on the narrowest container that
can hold the node, and read `mutation.addedNodes` instead of querying inside the callback. Short
bounded polling does not storm and is the safer probe when the lifetime is unbounded.

## Cookies ignore the port — a second local app can evict your session

`localhost:5173` and `localhost:3000` are the **same cookie host** (RFC 6265: ports provide no
isolation), so one local app's auth token is sent to the other. If that other app rejects the token on
its unauthorised path, it clears it — and the first app bounces to sign-in. **One navigation is
enough: no click, no logout**, and from the inside it is indistinguishable from ordinary session
expiry.

Never drive an app and a co-hosted admin panel in the same browser profile during one run — use a
separate profile, or do the admin work over the REST API. When a session dies unexpectedly, check
whether anything touched the other port before blaming the app or a backend restart.

## Signing in on local dev

Fill the form and submit it. Credentials come from committed dev fixtures or `.env`, or the form
arrives prefilled by the browser's password manager. In that case, submit the form. Drive submits with
`form.requestSubmit()`.

**Never print a credential into the transcript** — no echoing a password, token or API key into
output or logs. Reading one from a fixture and typing it into a field is fine; publishing it is not.
**Local dev only — never against staging or production.** A session expiring mid-task is ordinary;
sign in again rather than reporting the work unverified.

## Playwright MCP — the fallback

It remains the tool for scripted E2E specs, and it rescues a wedged Chrome session. Two constraints
that cost time when forgotten:

- `browser_file_upload` needs a **file chooser already open** — click the file input first.
- It only accepts paths **inside the project root**. A session scratchpad path is rejected, so stage
  fixtures somewhere gitignored inside the repo.
