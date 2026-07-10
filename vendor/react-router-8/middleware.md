---
version: 2.0.0
applies: react-router@8
target: rules
domain: routing
paths: ["**/routes/**", "**/routes.ts"]
tags: [middleware, context, auth, request, response, headers]
---

# Middleware & Context API

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| React Router docs | https://reactrouter.com/ | Official docs, v8 |
| API reference | https://api.reactrouter.com/v8/ | v8 API reference |
| GitHub | https://github.com/remix-run/react-router | Source, issues, discussions |
| Context7 | `/remix-run/react-router` | Good coverage |

## Middleware is Built In (v8)

Middleware is stable and enabled by default in React Router 8 — no config flag, no minimum-version gate. Export `middleware` (server) or `clientMiddleware` (client) from any route module and it runs.

> **Migrating from v7:** middleware was opt-in behind `future.v8_middleware` and required 7.9.0+. In v8 that flag is removed and the behavior is always on. If you drove context through a custom server's `getLoadContext`, migrate it per https://reactrouter.com/how-to/middleware#migration-from-apploadcontext.

## Overview

Middleware runs code before and after response generation. Executes in a nested chain: parent → child on the way down, child → parent on the way up.

```
Root middleware start
  Parent middleware start
    Child middleware start
      → Run loaders, generate Response
    Child middleware end
  Parent middleware end
Root middleware end
```

## Basic Middleware

```tsx
import type { Route } from "./+types/dashboard";
import { redirect } from "react-router";

const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  const user = await getUserFromSession(request);
  if (!user) {
    throw redirect("/login");
  }
  context.set(userContext, user);
};

export const middleware = [authMiddleware];
```

### The `next` Function

Call `next()` to continue the chain and get the response:

```tsx
const loggingMiddleware: Route.MiddlewareFunction = async ({ request }, next) => {
  console.log(`→ ${request.method} ${request.url}`);

  const response = await next();

  console.log(`← ${response.status}`);
  return response;
};
```

- Call `next()` only once
- If you don't need post-processing, skip calling `next()` (called automatically)
- `next()` never throws—errors return as error responses

## Context API

Create typed context to share data between middleware and loaders/actions:

```tsx
// app/context.ts
import { createContext } from "react-router";

export const userContext = createContext<User | null>(null);
export const dbContext = createContext<Database>();
```

### Setting Context in Middleware

```tsx
import { userContext } from "~/context";

const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  const user = await getUser(request);
  context.set(userContext, user);
};

export const middleware = [authMiddleware];
```

### Reading Context in Loaders/Actions

```tsx
import { userContext } from "~/context";

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return { profile: await getProfile(user) };
}

export async function action({ context }: Route.ActionArgs) {
  const user = context.get(userContext);
  // user is available here too
}
```

## Server vs Client Middleware

**Server middleware** (`middleware`) runs on document requests and `.data` fetches:

```tsx
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    // Runs on server
    const response = await next();
    return response;
  },
];
```

**Client middleware** (`clientMiddleware`) runs on client-side navigations:

```tsx
export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async ({ context }, next) => {
    // Runs in browser
    const start = performance.now();
    await next();
    console.log(`Navigation: ${performance.now() - start}ms`);
  },
];
```

## When Server Middleware Runs

| Request Type                     | Middleware Runs?      |
| -------------------------------- | --------------------- |
| Document request (`GET /route`)  | Always                |
| Client navigation with loader    | Yes (`.data` request) |
| Client navigation without loader | No                    |

To force middleware on routes without loaders, add an empty loader:

```tsx
export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function loader() {
  return null;
}
```

## Common Patterns

### Authentication

```tsx
const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  const session = await getSession(request);
  if (!session.get("userId")) {
    throw redirect("/login");
  }
  context.set(userContext, await getUserById(session.get("userId")));
};
```

### Request Logging

```tsx
const loggingMiddleware: Route.MiddlewareFunction = async ({ request }, next) => {
  const id = crypto.randomUUID();
  const start = performance.now();

  console.log(`[${id}] ${request.method} ${request.url}`);
  const response = await next();
  console.log(`[${id}] ${response.status} (${performance.now() - start}ms)`);

  return response;
};
```

### Response Headers

```tsx
const securityHeaders: Route.MiddlewareFunction = async (_, next) => {
  const response = await next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
};
```

### 404 Fallback

```tsx
const cmsFallback: Route.MiddlewareFunction = async ({ request }, next) => {
  const response = await next();

  if (response.status === 404) {
    const target = await checkCmsRedirects(request.url);
    if (target) throw redirect(target, 302);
  }

  return response;
};
```

### Conditional Execution

```tsx
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    if (request.method === "POST") {
      await requireAuth(request, context);
    }
    return next();
  },
];
```

## Error Handling

Errors bubble to the nearest `ErrorBoundary`. The `next()` function always returns a response (never throws):

```tsx
export const middleware: Route.MiddlewareFunction[] = [
  async (_, next) => {
    const response = await next();
    // response.status = 500 if child threw
    // Can still set headers, commit sessions, etc.
    return response;
  },
];
```

- Error **before** `next()`: Bubbles to highest route with a loader
- Error **after** `next()`: Bubbles from the throwing route

## See Also

- [React Router Middleware Documentation](https://reactrouter.com/how-to/middleware)
