---
version: 1.0.0
applies: react-router@7
target: graph
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

| Topic | File | Purpose |
|-------|------|---------|
| Routing | [routing.md](./routing.md) | File-based route configuration and nesting |
| Route Modules | [route-modules.md](./route-modules.md) | Understanding available exports |
| Special Files | [special-files.md](./special-files.md) | Customizing `root.tsx` and global elements |
| Data Loading | [data-loading.md](./data-loading.md) | Implementing loaders with streaming support |
| Actions | [actions.md](./actions.md) | Form handling and data mutations |
| Navigation | [navigation.md](./navigation.md) | Link components and programmatic routing |
| Pending UI | [pending-ui.md](./pending-ui.md) | Loading indicators and optimistic updates |
| Error Handling | [error-handling.md](./error-handling.md) | Error boundaries and recovery |
| Type Safety | [type-safety.md](./type-safety.md) | Route module types and `href` utility |
| Rendering Strategies | [rendering-strategies.md](./rendering-strategies.md) | SSR, SPA, and static pre-rendering |
| Sessions | [sessions.md](./sessions.md) | Authentication and cookie management |
| Middleware | [middleware.md](./middleware.md) | Request preprocessing (v7.9.0+) |

## Version Requirements

Framework features require React Router 7.0.0 or later. Middleware specifically needs version 7.9.0+.

## Critical Implementation Patterns

**Search forms**: Use `<Form method="get">` instead of manual state management.

**Non-navigating mutations**: Employ `useFetcher` to avoid page refreshes during inline actions.

**Metadata**: Reference `loaderData` rather than deprecated alternatives in meta exports.

**Type-safe URLs**: Use `href()` utility for generating type-checked paths with params.
