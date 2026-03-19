---
version: 1.0.0
applies: react-router@7
target: graph
domain: routing
priority: high
tags: [react-router, routing, framework, overview]
---

# React Router Framework Mode

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
| Routing | `VendorReactRouter7Routing` | File-based route configuration and nesting |
| Route Modules | `VendorReactRouter7RouteModules` | Understanding available exports |
| Special Files | `VendorReactRouter7SpecialFiles` | Customizing `root.tsx` and global elements |
| Data Loading | `VendorReactRouter7DataLoading` | Implementing loaders with streaming support |
| Actions | `VendorReactRouter7Actions` | Form handling and data mutations |
| Navigation | `VendorReactRouter7Navigation` | Link components and programmatic routing |
| Pending UI | `VendorReactRouter7PendingUi` | Loading indicators and optimistic updates |
| Error Handling | `VendorReactRouter7ErrorHandling` | Error boundaries and recovery |
| Type Safety | `VendorReactRouter7TypeSafety` | Route module types and `href` utility |
| Rendering Strategies | `VendorReactRouter7RenderingStrategies` | SSR, SPA, and static pre-rendering |
| Sessions | `VendorReactRouter7Sessions` | Authentication and cookie management |
| Middleware | `VendorReactRouter7Middleware` | Request preprocessing (v7.9.0+) |

## Version Requirements

Framework features require React Router 7.0.0 or later. Middleware specifically needs version 7.9.0+.

## Critical Implementation Patterns

**Search forms**: Use `<Form method="get">` instead of manual state management.

**Non-navigating mutations**: Employ `useFetcher` to avoid page refreshes during inline actions.

**Metadata**: Reference `loaderData` rather than deprecated alternatives in meta exports.

**Type-safe URLs**: Use `href()` utility for generating type-checked paths with params.
