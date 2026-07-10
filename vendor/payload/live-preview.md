---
version: 1.1.0
applies: payload@3
target: rules
domain: full-stack
paths:
  - "**/collections/**"
  - "**/live-preview*"
  - "**/preview*"
  - "**/routes/**"
  - "**/root.tsx"
  - "**/Caddyfile"
  - "**/inject-env.sh"
priority: high
tags: [payload, live-preview, csp, iframe, postMessage, deployment]
---

# Payload CMS 3 — Live Preview Caveats

Live preview embeds the frontend inside an iframe in the Payload admin and pushes form-state updates via `window.postMessage`. The end-to-end path crosses three concerns — **CSP/headers**, **environment URLs**, and **draft-mode data fetching** — and a wrong default in any one of them breaks preview silently. This doc collects every pitfall observed in production with copy-paste fixes.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Live preview overview | https://payloadcms.com/docs/live-preview/overview | Concept, setup |
| Live preview frontend | https://payloadcms.com/docs/live-preview/frontend | `useLivePreview` hook |
| `@payloadcms/live-preview` | https://www.npmjs.com/package/@payloadcms/live-preview | Core merge logic |
| `@payloadcms/live-preview-react` | https://www.npmjs.com/package/@payloadcms/live-preview-react | React hook |
| GitHub | https://github.com/payloadcms/payload/tree/main/packages/live-preview | Source |

## Architecture

```
┌─────────────────────────────┐         postMessage         ┌──────────────────────────┐
│ Payload admin               │ ──────────────────────────▶ │ Frontend iframe          │
│ https://api.example.com     │   (form state, full doc)    │ https://www.example.com  │
│                             │                             │  /:lang/:slug?preview=…  │
│  livePreview.url(data)      │ ◀── fetch GET /:slug ?…     │  loader → fetch by id/   │
│  → builds iframe URL        │     populates initialData   │     slug with draft=true │
│                             │ ◀── POST /api/{coll}/{id}   │  useLivePreview hook     │
│                             │     merge data (depth=2)    │  merges postMessage      │
└─────────────────────────────┘                             └──────────────────────────┘
```

Three browsers' worth of policy decide whether this works:

1. **Frame embedding** — `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`
2. **Cross-origin postMessage** — `targetOrigin` must equal the iframe parent's origin
3. **Cross-origin fetch** (the hook's merge call) — `connect-src` must allow the admin origin

If any one is wrong, the iframe blanks out or shows stale content with no obvious error.

## Pitfall Cheat Sheet

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| `Refused to load … because it does not appear in the frame-ancestors directive` | Frontend sends `X-Frame-Options: DENY` or restrictive CSP | Drop XFO + add `frame-ancestors 'self' <admin>` for `?preview=true` requests |
| `Unable to post message to http://backend:3000. Recipient has origin https://api.example.com.` | Frontend was given the Docker-internal backend URL as `serverURL` | Pass the **public** backend URL to `useLivePreview`, not the internal one |
| `Refused to connect … connect-src 'self'` | App CSP blocks the hook's merge fetch | Add admin origin to `connect-src` in preview mode |
| Caddyfile changes deployed but never take effect | `docker compose up -d` doesn't recreate volume-mounted Caddy | Run `docker compose restart caddy` (or `caddy reload`) after `up -d` |
| `?preview=true` returns 404 even though the page exists | Empty-shell catch uses `instanceof Response` but loader threw `data()` | Throw `new Response(...)` for HTTP errors, not `data()` |
| `POST /api/pages/undefined 500` | Live-preview hook ran with no document id (empty shell case) | Skip `useLivePreview` when `initialData.id` is missing |
| `?preview=true` shows empty layout for an existing page | Payload `find?draft=true&where[slug]=…` returns 0 docs when only published exists | Pass `id=` in the preview URL and fetch by id; or fall back to a published `find` |
| Initial SSR works but admin edits never update the iframe; console shows `Access-Control-Allow-Origin: * … must not be the wildcard when credentials mode is include` for `POST /api/<collection>/<id>` | `next.config.*` defines a `headers` block with `Access-Control-Allow-Origin: *` on `/api/:path*`. Next.js applies these headers AFTER Payload's CORS middleware, clobbering the dynamically-reflected origin. The hook's populate fetch uses `credentials: 'include'`, so the wildcard is rejected | Remove the `headers` block from `next.config.*` entirely. CORS belongs to Payload (`payload.config.ts` `cors` + `csrf`) — never duplicate it at the Next.js layer, which can't reflect request origin dynamically |

## Backend — Pages Collection (Payload 3)

```ts
// backend/src/collections/pages.ts
import type { CollectionConfig } from 'payload'

const DEFAULT_LOCALE = 'en'

export const Pages: CollectionConfig = {
  access: {
    read: ({ req }) => {
      // Authenticated requests (e.g. PAYLOAD_SERVICE_USER_API_KEY) see drafts;
      // anonymous requests see published only.
      if (req.user) return true
      return { _status: { equals: 'published' } }
    },
  },
  admin: {
    livePreview: {
      url: ({ data, locale }) => {
        const base = process.env.FRONTEND_URL || 'http://localhost:5173'
        const lang = locale?.code || DEFAULT_LOCALE

        // Empty slug → /{lang}/ (the index route). For pages without a slug
        // yet (new/unsaved), the frontend renders an empty shell on 404 and
        // useLivePreview populates it via postMessage.
        const slug = typeof data.slug === 'string' ? data.slug : ''

        // CRITICAL: append id when available. The frontend prefers id-based
        // fetch in preview mode to bypass Payload's `find?draft=true&where[slug]`
        // quirk that returns no docs when only a published version exists.
        // Survives slug edits in the admin form too.
        const idParam = data.id ? `&id=${data.id}` : ''

        return `${base}/${lang}/${slug}?preview=true${idParam}`
      },
    },
    useAsTitle: 'title',
  },
  fields: [/* ... */],
  versions: { drafts: true },
}
```

**Anti-patterns:**
```ts
// ❌ Hard-codes a slug guess; preview navigates to a non-existent URL
return `${base}/${lang}/${data.slug || 'home'}?preview=true`

// ❌ No id param — frontend can only fetch by slug, hits the find+draft+slug quirk
return `${base}/${lang}/${data.slug ?? ''}?preview=true`
```

## Caddy / Reverse Proxy

The admin and frontend are typically served from different hostnames behind a reverse proxy. The frontend's headers must allow the admin to embed it **only when in preview mode**:

```caddyfile
# deployment/production/Caddyfile
www.example.com {
    encode zstd gzip

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options    "nosniff"
        X-Frame-Options           "DENY"
        Referrer-Policy           "strict-origin-when-cross-origin"
        -Server
        -X-Powered-By
    }

    # Allow Payload admin to embed the frontend in the live-preview iframe.
    # XFO has no allow-list for cross-origin embedders, so we strip it on
    # preview requests and emit a CSP frame-ancestors instead.
    @preview query preview=true
    header @preview {
        -X-Frame-Options
        Content-Security-Policy "frame-ancestors 'self' https://api.example.com"
    }

    reverse_proxy frontend:3000
}
```

### Volume-mounted Caddyfile pitfall

```yaml
# docker-compose.yml
services:
  caddy:
    image: caddy:2-alpine
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
```

`docker compose up -d` only recreates a container when its **compose definition** changes (image, env, volume *paths*, ports). The mount target's *content* is not part of that diff — Caddy keeps the previously-loaded config in memory. Every deploy that updates only the Caddyfile must explicitly reload Caddy:

```yaml
# .github/workflows/deploy.yml — after `docker compose up -d`
- run: docker compose restart caddy
  # Or graceful (zero-downtime):
  # docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --force
```

## Frontend — React Router 8

### Two backend URLs (internal vs public)

In Docker deployments the frontend has two distinct addresses for the backend:

| Env var | Value (prod) | Used by |
|---------|--------------|---------|
| `API_URL` | `http://globe-production-backend:3000` | SSR loaders / actions (server-side fetches inside the compose network) |
| `API_URL_PUBLIC` | `https://api.example.com` | CSP `frame-ancestors`/`connect-src`/`img-src`, `useLivePreview` `serverURL`, `postMessage` `targetOrigin` |

A single `API_URL` set to the internal name leaks into the client bundle and is unreachable from the browser. Symptoms: Safari logs *"Recipient has origin https://api.example.com"*, fetches fail, CSP blocks them.

```sh
# deployment/production/frontend.env
INSTANCE_NAME=production
ORIGIN=https://www.example.com
FRONTEND_URL=https://www.example.com
# Internal — SSR fetches inside the compose network
API_URL=http://globe-production-backend:3000
# Public — browser-side code (live-preview hook, CSP, postMessage)
API_URL_PUBLIC=https://api.example.com
```

In local dev a single URL (`http://localhost:3000`) is reachable from both — the public var falls back to the internal one.

### `root.tsx` — CSP and ENV exposure

```tsx
// frontend/app/root.tsx
import { type HeadersFunction, data } from 'react-router'

export const headers: HeadersFunction = ({ loaderHeaders }) => {
  const isPreview = loaderHeaders.get('X-Preview-Mode') === '1'
  // Public origin first, internal as fallback for local dev
  const adminOrigin =
    process.env.API_URL_PUBLIC || process.env.API_URL || 'http://localhost:3000'

  const imgSrc = `'self' data: ${adminOrigin}`
  const frameAncestors = isPreview ? `'self' ${adminOrigin}` : "'self'"
  // CRITICAL: connect-src must allow the admin origin in preview mode —
  // the live-preview hook posts to /api/{collection}/{id} on that origin.
  const connectSrc = isPreview ? `'self' ${adminOrigin}` : "'self'"

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    `frame-ancestors ${frameAncestors}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

  return {
    'Cache-Control': 'public, max-age=0, s-maxage=0',
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
  }
}

export const loader = async ({ request }: Route.LoaderArgs) => {
  const isLivePreview = new URL(request.url).searchParams.has('preview')
  const headers = new Headers()
  if (isLivePreview) headers.set('X-Preview-Mode', '1')

  return data(
    {
      ENV: {
        // Browser-reachable backend origin — `useLivePreview` reads this as
        // serverURL (postMessage targetOrigin + cross-origin fetches).
        API_URL: process.env.API_URL_PUBLIC || process.env.API_URL,
      },
    },
    { headers },
  )
}
```

### Preview route loader — id-based fetch first

```tsx
// frontend/app/routes/page.$slug.tsx
export async function loader({ context, params, request }: Route.LoaderArgs) {
  const locale = getLocale(context)
  const url = new URL(request.url)
  const isPreview = url.searchParams.has('preview')
  const previewIdParam = isPreview ? url.searchParams.get('id') : null
  const previewId = previewIdParam ? Number.parseInt(previewIdParam, 10) : Number.NaN

  try {
    const pageData =
      isPreview && Number.isFinite(previewId)
        ? // Bypass Payload's find+draft+slug quirk by fetching by id.
          await loadCmsPageById(request, locale, previewId, params.slug, { draft: true })
        : await loadCmsPage(
            request,
            locale,
            params.slug,
            undefined,
            isPreview ? { draft: true } : undefined,
          )
    return { ...pageData, isPreview }
  } catch (error) {
    // Empty-shell fallback: never-published pages 404 normally. Render an
    // empty shell so useLivePreview can populate it via postMessage.
    // CRITICAL: this only fires when `loadCmsPage` throws a real `Response` —
    // throwing `data()` does NOT pass `instanceof Response`. See § "data()
    // is not a Response" below.
    if (isPreview && error instanceof Response && error.status === 404) {
      return {
        isPreview: true,
        layout: [],
        page: { layout: [] } as unknown as PageLikeDocument,
        // ...other empty-shell fields
      }
    }
    throw error
  }
}
```

### Helper — throw `new Response`, not `data()`

```ts
// frontend/app/services/api/payload/page-route-helpers.server.ts
export async function loadCmsPage(
  request: Request,
  locale: string,
  slug: string,
  routePath?: string,
  options?: { draft?: boolean },
) {
  const page = await fetchPageLikeBySlug(request, slug, locale, options)
  if (page) return { /* ... */ }

  // ❌ Won't be caught by `error instanceof Response` in route loaders —
  //    react-router's `data()` returns a plain DataWithResponseInit.
  // throw data(null, { status: 404, statusText: 'Not Found' })

  // ✅ Catchable by routes that test `instanceof Response`.
  throw new Response(null, { status: 404, statusText: 'Not Found' })
}
```

### `fetchBySlug` — fall back to published in draft mode

Payload v3 quirk: `find` with `draft: true` + `where[slug]` returns 0 docs when only a published version exists (no draft has ever been saved). `findById` with `draft: true` works, and the published `find` works — so fall back when the draft-mode find returns nothing:

```ts
// frontend/app/services/api/payload/fetch-page.server.ts
async function fetchBySlug<K extends DraftableCollection>(
  request: Request,
  collection: K,
  slug: string,
  locale: string,
  options?: { draft?: boolean },
) {
  const client = await restOnServer(request)

  const findOne = async (draft: boolean) => {
    const where = draft
      ? { slug: { equals: slug } }
      : { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] }
    const result = await client.collections[collection].find({
      depth: 2,
      locale,
      where: where as never,
      ...(draft ? { draft: true } : {}),
    })
    return result.docs[0] ?? null
  }

  if (options?.draft) {
    return (await findOne(true)) ?? (await findOne(false))
  }
  return findOne(false)
}
```

### Live-preview wrapper — guard against missing id

`@payloadcms/live-preview-react`'s default request handler POSTs to `/api/{collection}/{id}` to merge relationships. With no id (empty shell case for unsaved pages, or slug-edited pages we couldn't find by slug), the URL becomes `/api/pages/undefined` and returns 500. Skip the hook entirely until the document has an id:

```tsx
// frontend/app/components/payload/live-preview-wrapper.tsx
import { useLivePreview } from '@payloadcms/live-preview-react'
import { useRouteLoaderData } from 'react-router'

export function LivePreviewWrapper<T extends object>({
  children,
  initialData,
  isPreview,
}: {
  children: (data: T) => React.ReactNode
  initialData: T
  isPreview: boolean
}) {
  if (!isPreview) return <>{children(initialData)}</>

  // Empty-shell case (unsaved page or slug changed but not yet saved) —
  // initialData has no id, so useLivePreview's request handler would POST to
  // /api/{collection}/undefined and 500. Render the shell as-is; the next URL
  // refresh (after save) carries a real id and engages the hook normally.
  const id = (initialData as { id?: unknown }).id
  if (id === undefined || id === null) return <>{children(initialData)}</>

  return <LivePreviewInner initialData={initialData}>{children}</LivePreviewInner>
}

function LivePreviewInner<T extends object>({
  children,
  initialData,
}: {
  children: (data: T) => React.ReactNode
  initialData: T
}) {
  const rootData = useRouteLoaderData('root') as { ENV?: { API_URL?: string } } | undefined
  const serverURL = rootData?.ENV?.API_URL ?? ''
  // depth must match the loader's fetch depth so merged docs have the same shape.
  const { data } = useLivePreview<T>({ depth: 2, initialData, serverURL })
  return <>{children(data)}</>
}
```

## Verification Checklist

Walk through these in a real browser when wiring up live preview on a new project or environment:

- [ ] Open the page in Payload admin → live-preview tab loads the iframe (no `Refused to load` error)
- [ ] Open browser devtools in the iframe context → no CSP `connect-src` violations on `/api/{collection}/{id}` POSTs
- [ ] Safari: no `Unable to post message to <url>. Recipient has origin <other>` warning
- [ ] Edit a field in the admin → iframe content updates without a full reload
- [ ] Reload the iframe → loader fetches the draft, content matches admin form
- [ ] Save the page as a draft → preview reflects the saved draft on next load
- [ ] Publish → preview reflects published content
- [ ] Create a brand-new page (no save yet) → preview iframe shows the empty layout shell, no 500s in network tab
- [ ] Rename the slug in the form → preview URL updates, content still loads (because `id=` carries through)
- [ ] After deploying a Caddyfile change → preview headers reflect the new config (`docker compose ps caddy` should show recently-restarted)

## Backport

Mark KG entries with `Backport: <reason>` so `/webstack update` can lift these to other Payload+RR8 projects:

- `RouterDataNotInstanceofResponse` — RR8 framework behavior, applies anywhere
- `FrontendApiUrlInternalVsPublic` — applies to any Payload + Docker-deployed frontend
- `CaddyVolumeMountedConfigNeedsRestart` — applies to any Caddy + compose deployment
- `PayloadFindDraftSlugReturnsEmpty` — Payload v3 quirk, applies to any project using `find?draft=true&where[slug]`
- `PayloadLivePreviewMissingId` — applies to any project using `@payloadcms/live-preview-react` with empty-shell preview fallback

## See Also

- `vendor/payload/cms-3` — General Payload 3 patterns
- `vendor/payload/rest-client` — REST client usage
- `vendor/react-router-8/special-files` — `root.tsx`, `entry.server.tsx`
- `vendor/react-router-8/error-handling` — `instanceof Response` vs `data()`
