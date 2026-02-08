---
version: 1.0.0
applies: react-router@7
target: graph
tags: [errors, ErrorBoundary, error-handling, useRouteError, 404, 500]
---

# Error Handling in React Router

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
