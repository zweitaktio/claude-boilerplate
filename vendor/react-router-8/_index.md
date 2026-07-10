---
version: 2.1.0
applies: react-router@8
target: rules
domain: routing
paths: ["**/routes/**", "**/routes.ts"]
priority: high
tags: [react-router, routing, framework, overview]
---

# React Router Framework Mode

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| React Router docs | https://reactrouter.com/ | Official docs, v8 |
| API reference | https://api.reactrouter.com/v8/ | v8 API reference |
| GitHub | https://github.com/remix-run/react-router | Source, issues, discussions |
| Context7 | `/remix-run/react-router` | Good coverage |

React Router's framework mode enables full-stack development with file-based routing, multiple rendering strategies, data loading, mutations, and type-safe APIs.

## Key Application Areas

Apply this framework when:
- Setting up routes via `app/routes.ts`
- Implementing data fetching through `loader` or `clientLoader`
- Processing form submissions with `action` or `clientAction`
- Building navigation with components like `<Link>` and `<Form>`
- Creating loading states for better UX
- Configuring rendering modes in `react-router.config.ts`
- Securing routes with authentication

## Essential References

| Topic | KG Entity | Purpose |
|-------|-----------|---------|
| Routing | `VendorReactRouter8Routing` | File-based route configuration and nesting |
| Route Modules | `VendorReactRouter8RouteModules` | Understanding available exports |
| Special Files | `VendorReactRouter8SpecialFiles` | Customizing `root.tsx` and global elements |
| Data Loading | `VendorReactRouter8DataLoading` | Implementing loaders with streaming support |
| Actions | `VendorReactRouter8Actions` | Form handling and data mutations |
| Navigation | `VendorReactRouter8Navigation` | Link components and programmatic routing |
| Pending UI | `VendorReactRouter8PendingUi` | Loading indicators and optimistic updates |
| Error Handling | `VendorReactRouter8ErrorHandling` | Error boundaries and recovery |
| Type Safety | `VendorReactRouter8TypeSafety` | Route module types and `href` utility |
| Rendering Strategies | `VendorReactRouter8RenderingStrategies` | SSR, SPA, and static pre-rendering |
| Sessions | `VendorReactRouter8Sessions` | Authentication and cookie management |
| Middleware | `VendorReactRouter8Middleware` | Request preprocessing (built in) |

## Version Requirements

Framework mode requires React Router 8: Node.js 22+, React 19+, Vite 7+, and ESM-only packages. Middleware is built in — no config flag. See the v7 → v8 upgrade guide: https://reactrouter.com/upgrading/v7

## Critical Implementation Patterns

**Search forms**: Use `<Form method="get">` instead of manual state management.

**Non-navigating mutations**: Employ `useFetcher` to avoid page refreshes during inline actions.

**Metadata**: Reference `loaderData` rather than deprecated alternatives in meta exports.

**Type-safe URLs**: Use `href()` utility for generating type-checked paths with params.

## Package Discipline

Framework mode uses the `react-router` / `@react-router/*` packages only. These imports are always wrong:

- `react-router-dom` — **removed in v8.** Import components and hooks from `react-router`; import `HydratedRouter` / `RouterProvider` from `react-router/dom`.
- `@remix-run/*` — the pre-v7 packages, replaced by `@react-router/*`.
- v6 component routing (`<Routes><Route element={...} /></Routes>`) — framework mode declares routes in `routes.ts`, not JSX.
