---
version: 1.0.2
applies: react-router@7
target: rules
domain: routing
paths: ["**/routes/**", "**/routes.ts"]
tags: [root, config, entry, server-only, client-only, special-files]
---

# Special Files

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| React Router docs | https://reactrouter.com/ | Official docs, v7 |
| API reference | https://api.reactrouter.com/v7/ | v7 API reference |
| GitHub | https://github.com/remix-run/react-router | Source, issues, discussions |
| Context7 | `/remix-run/react-router` | Good coverage |

React Router framework mode uses several special files with specific purposes.

## Quick Reference

| File | Required | Purpose |
|------|----------|---------|
| `app/root.tsx` | Yes | Root route rendering the HTML document |
| `app/routes.ts` | Yes | Route configuration |
| `react-router.config.ts` | No | Framework configuration (SSR, prerender, etc.) |
| `app/entry.client.tsx` | No | Client-side hydration entry point |
| `app/entry.server.tsx` | No | Server-side rendering entry point |
| `*.server.ts` | No | Server-only modules (excluded from client) |
| `*.client.ts` | No | Client-only modules (excluded from server) |

## root.tsx (Required)

**`app/root.tsx` is the only required route** — it's the parent to all routes and renders the root `<html>` document.

### What Belongs in root.tsx

| Element | Why |
|---------|-----|
| `<html>`, `<head>`, `<body>` | Document structure |
| `<Meta />`, `<Links />` | Route meta/links aggregation |
| `<Scripts />`, `<ScrollRestoration />` | React Router runtime |
| `<Outlet />` | Child route rendering |
| Global navigation | Appears on every page |
| Global footer | Appears on every page |
| Context providers | Available to all routes |
| Stylesheets/fonts | Loaded once, cached |
| Global error boundary | Catches app-wide errors |
| Loading indicators | Show during navigation |

### Basic root.tsx Structure

```tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
```

### Using the Layout Export

The `Layout` export avoids duplicating the document shell across your component, `HydrateFallback`, and `ErrorBoundary`:

```tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary() {
  return <div>Something went wrong</div>
}

export function HydrateFallback() {
  return <div>Loading...</div>
}
```

### Complete Example with Global UI

```tsx
import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from "react-router"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const navigation = useNavigation()
  const isNavigating = navigation.state !== "idle"

  return (
    <div className="app-layout">
      {isNavigating && <ProgressBar />}

      <header>
        <nav>
          <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>
            Home
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => isActive ? "active" : ""}>
            Products
          </NavLink>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>© {new Date().getFullYear()} My App</footer>
    </div>
  )
}
```

## react-router.config.ts (Optional)

Configures framework-level settings:

```ts
import type { Config } from "@react-router/dev/config"

export default {
  // App directory (default: "app")
  appDirectory: "app",

  // Build output directory (default: "build")
  buildDirectory: "build",

  // Enable/disable SSR (default: true)
  ssr: true,

  // Pre-render routes at build time
  prerender: ["/", "/about", "/pricing"],

  // Base path for all routes
  basename: "/my-app",

  // Future flags
  future: {
    v8_middleware: true,
  },
} satisfies Config
```

### Common Configuration Options

| Option | Default | Purpose |
|--------|---------|---------|
| `ssr` | `true` | Enable server-side rendering |
| `prerender` | `[]` | Routes to pre-render as static HTML |
| `basename` | `"/"` | Base URL path for all routes |
| `appDirectory` | `"app"` | Source directory |
| `buildDirectory` | `"build"` | Build output directory |
| `future` | `{}` | Enable future flags |

### SPA Mode

Disable SSR for a single-page application:

```ts
export default {
  ssr: false,
} satisfies Config
```

### Pre-rendering

Pre-render routes to static HTML at build time:

```ts
export default {
  async prerender({ getStaticPaths }) {
    const dynamicPaths = await getStaticPaths()
    return ["/", "/about", ...dynamicPaths]
  },
} satisfies Config
```

## .server Modules

Files with `.server` in the name (e.g., `auth.server.ts`) are **server-only** and excluded from client bundles.

```
app/
├── utils/
│   ├── db.server.ts      # Server-only
│   ├── auth.server.ts    # Server-only
│   └── format.ts         # Shared
```

**Use for:**
- Database connections
- Authentication utilities
- Environment variables/secrets
- Server-only APIs

**Safety:** The build will fail if `.server` code accidentally ends up in the client bundle.

**Important:** Route modules should NOT use `.server` — they have special handling.

## .client Modules

Files with `.client` in the name (e.g., `analytics.client.ts`) are **client-only** and excluded from server bundles.

```
app/
├── utils/
│   ├── analytics.client.ts  # Client-only
│   ├── browser.client.ts    # Client-only
│   └── format.ts            # Shared
```

**Use for:**
- Browser-specific APIs (localStorage, navigator)
- Client-only libraries (charting, animations)
- Feature detection

**Note:** Values exported from `.client` modules are `undefined` on the server. Only use them in `useEffect` or event handlers.

## Anti-Patterns

**Don't create a separate layout just for nav/footer** — put global UI in `root.tsx`.

**Don't use flat routes when nesting makes sense** — see `VendorReactRouter7Routing` for proper nested route patterns.
