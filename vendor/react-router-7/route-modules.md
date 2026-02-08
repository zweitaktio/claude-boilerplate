---
version: 1.0.0
applies: react-router@7
target: graph
tags: [route-module, exports, loader, action, meta, links, handle]
---

# Route Modules

Route modules are files referenced in `routes.ts` that define automatic code-splitting, data loading, actions, revalidation, error boundaries, and more.

## Key Exports Overview

The framework supports 13 primary exports across server and client environments.

### Server-Side Exports

| Export | Purpose |
|--------|---------|
| `loader` | Pre-render data fetching |
| `action` | Form mutation handling |
| `middleware` | Request preprocessing (v7.9.0+) |
| `headers` | HTTP response headers |

### Client-Side Exports

| Export | Purpose |
|--------|---------|
| `clientLoader` | Browser data loading |
| `clientAction` | Client-side mutations |
| `clientMiddleware` | Navigation processing (v7.9.0+) |
| `HydrateFallback` | Loading states during hydration |

### Shared Exports

| Export | Purpose |
|--------|---------|
| `default` | Route component |
| `ErrorBoundary` | Error rendering |
| `meta` | SEO tags |
| `links` | Document head elements |
| `handle` | Custom metadata |
| `shouldRevalidate` | Loader revalidation control |

## Component Export

```tsx
import type { Route } from "./+types/product";

export default function Product({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.name}</h1>;
}
```

## Loader Export

```tsx
import type { Route } from "./+types/product";

export async function loader({ params, request }: Route.LoaderArgs) {
  const product = await db.getProduct(params.id);
  return product;
}
```

## Action Export

```tsx
import { redirect } from "react-router";
import type { Route } from "./+types/product";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  await db.updateProduct(formData);
  return redirect("/products");
}
```

## Meta Export

```tsx
import type { Route } from "./+types/product";

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data.name },
    { name: "description", content: data.description },
  ];
}
```

**Important:** Reference `loaderData` rather than deprecated alternatives in meta exports.

## Links Export

```tsx
export function links() {
  return [
    { rel: "stylesheet", href: "/styles/product.css" },
    { rel: "preload", href: "/fonts/inter.woff2", as: "font" },
  ];
}
```

## Headers Export

```tsx
import type { Route } from "./+types/product";

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control") ?? "max-age=300",
  };
}
```

## ErrorBoundary Export

```tsx
import { useRouteError, isRouteErrorResponse } from "react-router";

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <div>{error.status} {error.statusText}</div>;
  }

  return <div>Something went wrong</div>;
}
```

## HydrateFallback Export

Show UI while `clientLoader.hydrate` runs:

```tsx
export function HydrateFallback() {
  return <ProductSkeleton />;
}
```

## Handle Export

Custom metadata accessible via `useMatches`:

```tsx
export const handle = {
  breadcrumb: "Products",
};

// In parent component
function Breadcrumbs() {
  const matches = useMatches();
  const crumbs = matches
    .filter((m) => m.handle?.breadcrumb)
    .map((m) => m.handle.breadcrumb);

  return <nav>{crumbs.join(" > ")}</nav>;
}
```

## shouldRevalidate Export

Control when loaders re-run:

```tsx
import type { ShouldRevalidateFunction } from "react-router";

export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formAction,
  defaultShouldRevalidate,
}) => {
  // Don't revalidate if only search params changed
  if (currentUrl.pathname === nextUrl.pathname) {
    return false;
  }

  return defaultShouldRevalidate;
};
```

## Client Loader with Hydration

```tsx
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const cached = getFromCache();
  if (cached) return cached;

  const data = await serverLoader();
  setInCache(data);
  return data;
}

// Enable running on initial hydration
clientLoader.hydrate = true;

export function HydrateFallback() {
  return <LoadingSkeleton />;
}
```

## See Also

- `VendorReactRouter7DataLoading` - Loader patterns
- `VendorReactRouter7Actions` - Action patterns
- `VendorReactRouter7ErrorHandling` - Error boundary patterns
