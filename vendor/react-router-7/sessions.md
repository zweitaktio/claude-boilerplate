---
version: 1.0.0
applies: react-router@7
target: graph
tags: [sessions, cookies, auth, login, logout, flash]
---

# Sessions & Cookies

## Overview

React Router provides built-in utilities for cookie-based session management. **Always use these instead of hand-rolling cookie implementations.**

| Utility                      | Import From          | Purpose                            |
| ---------------------------- | -------------------- | ---------------------------------- |
| `createCookie`               | `react-router`       | Low-level signed cookie management |
| `createCookieSessionStorage` | `react-router`       | Session data stored in cookies     |
| `createFileSessionStorage`   | `@react-router/node` | Session data stored in files       |

## Session Storage Setup

Create a session storage file that exports the session helpers:

```ts
// app/sessions.server.ts
import { createCookieSessionStorage } from "react-router";

type SessionData = {
  userId: string;
};

type SessionFlashData = {
  error: string;
};

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET!],
      secure: process.env.NODE_ENV === "production",
    },
  });

export { getSession, commitSession, destroySession };
```

### Key Points

- **`getSession(cookieHeader)`** - Parse session from request's `Cookie` header
- **`commitSession(session)`** - Generate `Set-Cookie` header for response
- **`destroySession(session)`** - Generate `Set-Cookie` header that clears the session
- **Always use `secrets`** for signed cookies that can't be tampered with

## Getting/Setting Session Data

### In Loaders

```tsx
import type { Route } from "./+types/dashboard";
import { getSession } from "~/sessions.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");

  if (!userId) {
    throw redirect("/login");
  }

  return { user: await getUserById(userId) };
}
```

### In Actions

```tsx
import type { Route } from "./+types/settings";
import { getSession, commitSession } from "~/sessions.server";
import { redirect } from "react-router";

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const formData = await request.formData();

  // Update session data
  session.set("theme", formData.get("theme") as string);

  return redirect("/settings", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

## Login Route

```tsx
// app/routes/login.tsx
import { data, redirect, Form } from "react-router";
import type { Route } from "./+types/login";
import { getSession, commitSession } from "~/sessions.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  // Already logged in? Redirect to home
  if (session.has("userId")) {
    return redirect("/");
  }

  return data(
    { error: session.get("error") },
    {
      headers: {
        // Commit to clear flash data
        "Set-Cookie": await commitSession(session),
      },
    },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const formData = await request.formData();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const userId = await validateCredentials(email, password);

  if (!userId) {
    session.flash("error", "Invalid email or password");
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  session.set("userId", userId);

  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function Login({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      {loaderData.error && <p className="error">{loaderData.error}</p>}
      <Form method="post">
        <label>
          Email: <input type="email" name="email" required />
        </label>
        <label>
          Password: <input type="password" name="password" required />
        </label>
        <button type="submit">Log In</button>
      </Form>
    </div>
  );
}
```

## Logout Route

```tsx
// app/routes/logout.tsx
import { redirect, Form, Link } from "react-router";
import type { Route } from "./+types/logout";
import { getSession, destroySession } from "~/sessions.server";

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

export default function Logout() {
  return (
    <div>
      <p>Are you sure you want to log out?</p>
      <Form method="post">
        <button type="submit">Log Out</button>
      </Form>
      <Link to="/">Cancel</Link>
    </div>
  );
}
```

**Important:** Always perform logout in an `action`, never in a `loader`. This prevents CSRF attacks.

## Session Flash Data

Flash data is automatically cleared after being read—useful for one-time messages:

```tsx
// In action - set flash message
session.flash("success", "Settings saved!");
return redirect("/settings", {
  headers: { "Set-Cookie": await commitSession(session) },
});

// In loader - read and clear flash
const success = session.get("success"); // Returns value, then clears
return data(
  { success },
  { headers: { "Set-Cookie": await commitSession(session) } },
);
```

**Gotcha:** With nested routes, multiple loaders run in parallel. If you use flash data, ensure only one loader reads it to avoid race conditions.

## Signed Cookies (Low-Level)

For simple cookie data that doesn't need session semantics, use `createCookie`:

```ts
// app/cookies.server.ts
import { createCookie } from "react-router";

export const userPrefs = createCookie("user-prefs", {
  maxAge: 60 * 60 * 24 * 365, // 1 year
  secrets: [process.env.COOKIE_SECRET!],
});
```

### Using in Routes

```tsx
import { userPrefs } from "~/cookies.server";

export async function loader({ request }: Route.LoaderArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const prefs = (await userPrefs.parse(cookieHeader)) || {};
  return { theme: prefs.theme ?? "light" };
}

export async function action({ request }: Route.ActionArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const prefs = (await userPrefs.parse(cookieHeader)) || {};
  const formData = await request.formData();

  prefs.theme = formData.get("theme");

  return redirect("/", {
    headers: {
      "Set-Cookie": await userPrefs.serialize(prefs),
    },
  });
}
```

## Cookie Attributes Reference

```ts
createCookieSessionStorage({
  cookie: {
    name: "__session", // Cookie name
    domain: "example.com", // Domain scope
    httpOnly: true, // JS can't access (security)
    maxAge: 60 * 60 * 24, // Expiry in seconds
    path: "/", // URL path scope
    sameSite: "lax", // CSRF protection: "lax" | "strict" | "none"
    secrets: ["secret1"], // Signing secrets (rotate by adding to front)
    secure: true, // HTTPS only (use in production)
  },
});
```

### Secret Rotation

Add new secrets to the front of the array. Old cookies are still readable, new cookies use the first secret:

```ts
secrets: ["new-secret", "old-secret"];
```

## See Also

- [React Router Sessions & Cookies Documentation](https://reactrouter.com/explanation/sessions-and-cookies)
- `VendorReactRouter7Middleware` - Middleware patterns for auth
