---
version: 1.1.2
applies: react-router@7
target: rules
domain: routing
paths: ["**/routes/**", "**/routes.ts"]
tags: [errors, ErrorBoundary, error-handling, useRouteError, 404, 500]
---

# Error Handling in React Router

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| React Router docs | https://reactrouter.com/ | Official docs, v7 |
| API reference | https://api.reactrouter.com/v7/ | v7 API reference |
| GitHub | https://github.com/remix-run/react-router | Source, issues, discussions |
| Context7 | `/remix-run/react-router` | Good coverage |

React Router provides built-in mechanisms for catching and managing errors across your application through error boundaries and strategic error throwing.

## Core Concepts

**Error Boundaries**: Export an `ErrorBoundary` component from route modules to catch errors in loaders, actions, and rendering. The `useRouteError` hook retrieves error information, while `isRouteErrorResponse` distinguishes between intentional Response throws and unexpected errors.

**Throwing Responses**: For anticipated errors, throw Response objects from loaders or actions. The `data` helper enables you to structure error payloads with additional context beyond status codes.

## Error Boundary Example

```tsx
import { useRouteError, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/my-route";

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    // Intentional Response throw (404, 401, etc.)
    return (
      <div>
        <h1>{error.status} {error.statusText}</h1>
        <p>{error.data}</p>
      </div>
    );
  }

  // Unexpected error
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  );
}
```

## Throwing Responses in Loaders

```tsx
import { data } from "react-router";
import type { Route } from "./+types/product";

export async function loader({ params }: Route.LoaderArgs) {
  const product = await db.getProduct(params.id);

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  return product;
}
```

## Error Bubbling Strategy

Errors propagate upward to the nearest ErrorBoundary in the route hierarchy. This means a child route's boundary catches its own errors, but unhandled errors escalate to parent boundaries. Always implement a root ErrorBoundary as your final safety net.

```tsx
// app/root.tsx
export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <html>
      <head>
        <title>Error</title>
      </head>
      <body>
        <h1>Application Error</h1>
        <p>Something unexpected happened.</p>
      </body>
    </html>
  );
}
```

## Form Validation Pattern

For validation errors, return data responses rather than throwing. This keeps your component accessible while providing feedback through `fetcher.data`, allowing users to correct input rather than experiencing a full error boundary display.

```tsx
import { data } from "react-router";
import type { Route } from "./+types/signup";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");

  const errors: Record<string, string> = {};

  if (!email?.toString().includes("@")) {
    errors.email = "Invalid email address";
  }

  if (Object.keys(errors).length > 0) {
    // Return errors, don't throw - keeps form accessible
    return data({ errors }, { status: 400 });
  }

  await createUser({ email });
  return redirect("/dashboard");
}
```

```tsx
// In component
function SignupForm() {
  const fetcher = useFetcher();
  const errors = fetcher.data?.errors;

  return (
    <fetcher.Form method="post">
      <input type="email" name="email" />
      {errors?.email && <span className="error">{errors.email}</span>}
      <button type="submit">Sign Up</button>
    </fetcher.Form>
  );
}
```

## Error Reporting

Configure `entry.server.tsx` with a `handleError` function to send errors to external logging services. The framework distinguishes between aborted requests and genuine errors, helping you avoid noise in error tracking systems.

```tsx
// app/entry.server.tsx
import { isRouteErrorResponse } from "react-router";

export function handleError(
  error: unknown,
  { request }: { request: Request }
) {
  // Don't log aborted requests
  if (request.signal.aborted) {
    return;
  }

  // Don't log expected errors (404s, etc.)
  if (isRouteErrorResponse(error) && error.status < 500) {
    return;
  }

  // Log to external service
  console.error(error);
  // errorReportingService.report(error);
}
```

## Pitfalls

### Returning error objects instead of throwing Responses

Never return `{ error: "..." }` from loaders/actions. This renders the component normally with an error prop instead of triggering the ErrorBoundary:

```typescript
// ❌ Component renders normally — no ErrorBoundary, no HTTP status
export async function loader({ params }: Route.LoaderArgs) {
  const item = await db.getItem(params.id)
  if (!item) return { error: "Not found" }
  return { item }
}

// ✅ ErrorBoundary catches this, HTTP 404 status
export async function loader({ params }: Route.LoaderArgs) {
  const item = await db.getItem(params.id)
  if (!item) throw new Response("Not found", { status: 404 })
  return { item }
}
```

**When to throw vs return errors:**
- **Throw `new Response()`:** Page-level errors (404, 401, 403, 500) — user sees ErrorBoundary
- **Return validation errors:** Field-level form errors from actions — component renders inline error messages

### ErrorBoundary not defined on the right route

ErrorBoundary catches errors from the route it's defined on AND all child routes. If a child route throws and no ErrorBoundary exists between it and root, the root ErrorBoundary replaces the entire page. Place ErrorBoundaries on layout routes to contain errors to their section.
