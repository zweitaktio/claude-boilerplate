---
version: 2.0.0
applies: remix-i18next@8 & react-router@8
target: rules
domain: i18n
paths: ["**/*.tsx", "**/locales/**"]
tags: [i18n, routing, translations, components, namespace, trans, patterns]
---

# React Router 8 i18n — Usage Patterns

Component-level i18n patterns, namespace splitting, Trans component, and routing with language prefixes.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| react-i18next | https://react.i18next.com | React bindings, hooks, Trans component |
| i18next docs | https://www.i18next.com/overview/getting-started | Core i18n library |
| GitHub | https://github.com/i18next/react-i18next | Source, issues |
| Context7 | `/i18next/react-i18next` | Good coverage |

## Client Setup

The client (`entry.client.tsx`) loads namespaces from the `/api/locales/:lang/:ns` resource route via `i18next-fetch-backend`, with `detection: { caches: [], order: ['htmlTag'] }` so it trusts the server-set `<html lang>`. See `VendorReactRouter8I18nSetup` for the full file. Do **not** use `i18next-http-backend` / `getInitialNamespaces` — those are the v7 pattern.

## Root Layout & Language Sync

**`useChangeLanguage` was removed in remix-i18next v8.** Sync i18next to the server-detected locale (`loaderData.locale`, from the root loader's `getLocale(context)`) with an effect, and drive `<html lang>`/`dir` from i18next:

```typescript
import { useEffect, type PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'

// Declare which namespace(s) this route tree uses
export const handle = { i18n: ['common'] }

export default function App({ loaderData }: Route.ComponentProps) {
  const { i18n } = useTranslation()
  useEffect(() => {
    if (i18n.language !== loaderData.locale) void i18n.changeLanguage(loaderData.locale)
  }, [i18n, loaderData.locale])
  return <Outlet />
}

export function Layout({ children }: PropsWithChildren) {
  const { i18n } = useTranslation()
  return (
    <html dir={i18n.dir(i18n.language)} lang={i18n.language}>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Links />
        <Meta />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
```

## Routing

### `app/routes.ts` — Language-Prefixed Routes

```typescript
import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  // Root redirects to detected language
  index('./routes/_index.tsx'),

  // Language-prefixed routes
  route(':lang/', './routes/$lang._index.tsx', { id: 'home' }),
  route(':lang/:slug', './routes/$lang.$slug.tsx', { id: 'page' }),

  // API routes (no language prefix)
  route('api/health', './routes/api/health.ts'),

  // Fallback
  route('*', './routes/404.tsx'),
] satisfies RouteConfig
```

### `app/routes/_index.tsx` — Root Redirect

The bare `/` route redirects to the detected locale. Read it from `context` (the i18n middleware set it); use 302 since the target is content-negotiated:

```typescript
import { redirect } from 'react-router'

import { getLocale } from '~/middleware/i18next'
import { type Route } from './+types/_index'

export async function loader({ context }: Route.LoaderArgs) {
  throw redirect(`/${getLocale(context)}`, 302)
}
```

### `app/routes/home.tsx` — Language-Prefixed Page

Routes under the `:lang` prefix don't re-validate the language — the `_lang-guard` layout already 404s unsupported locales. Just read `params.lang`:

```typescript
import { type Route } from './+types/home'

export async function loader({ params }: Route.LoaderArgs) {
  return { lang: params.lang }
}

export default function HomePage({ loaderData }: Route.ComponentProps) {
  return <div>Home page in {loaderData.lang}</div>
}
```

## TypeScript Types

`i18next-cli` generates `app/types/i18next.d.ts` (and `resources.d.ts`) from your source-language files — run `yarn i18n:types` (or `i18n:extract`, which runs types too). Don't hand-write the augmentation:

```typescript
// app/types/i18next.d.ts — generated
import type Resources from './resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    enableSelector: false
    resources: Resources
  }
}
```

## Translation Files

Each namespace is a JSON file at `app/locales/{lng}/{ns}.json`. The file *is* the namespace — keys live at the top level (no wrapping `common` key):

### `app/locales/en/common.json`

```json
{
  "nav": { "about": "About", "contact": "Contact", "home": "Home" },
  "footer": { "copyright": "© {{year}} Company Name", "rss": "RSS" },
  "items_one": "{{count}} item",
  "items_other": "{{count}} items"
}
```

## Usage Patterns

### Basic Translation

```typescript
import { useTranslation } from 'react-i18next'

export const MyComponent = () => {
  const { t } = useTranslation()

  return (
    <div>
      {/* Always provide English default */}
      <h1>{t('nav.home', 'Home')}</h1>
      <p>{t('common.404.message', 'Page not found')}</p>
    </div>
  )
}
```

### With Interpolation

```typescript
const { t } = useTranslation()

// Simple interpolation
t('footer.copyright', '© {{year}} Company', { year: 2024 })

// Plurals (automatic based on count)
t('items', { count: 1 })   // → "1 item"
t('items', { count: 5 })   // → "5 items"
```

### Multiple Namespaces

```typescript
// In route handle
export const handle = {
  i18n: ['common', 'admin'],  // Load multiple namespaces
}

// In component
const { t } = useTranslation('admin')  // Use admin namespace
t('login.title', 'Admin Login')

// Or switch namespace per call
const { t } = useTranslation()
t('admin:login.title', 'Admin Login')  // namespace:key syntax
```

## Namespace Splitting Pattern

Split translations into multiple files (namespaces) to:
- Reduce bundle size — only load translations needed for current route
- Organize by feature — admin, checkout, settings, etc.
- Enable lazy loading — load namespace when feature is accessed

### File Structure

```
app/locales/
├── en/
│   ├── common.json     # Shared UI: nav, footer, errors, 404
│   ├── admin.json      # Admin panel only
│   └── checkout.json   # Checkout flow only
└── de/
    ├── common.json
    ├── admin.json
    └── checkout.json
```

### When to Create a New Namespace

| Scenario | Namespace |
|----------|-----------|
| Shared across all pages (nav, footer, errors) | `common` (default) |
| Feature module with many strings (admin, checkout) | Dedicated namespace |
| A few strings in a feature | Keep in `common` |

**Rule of thumb:** Create a new namespace when a feature has 20+ translation keys.

### Configuration

No per-namespace config needed — `i18next-cli` discovers namespaces from `useTranslation('...')` and `t('ns:key')` usage. See `VendorReactRouter8I18nOperations` for the full `i18next.config.ts`.

### Route Declaration

Declare which namespaces a route needs in its `handle` export:

```typescript
// app/features/admin/routes/admin-layout.tsx
export const handle = {
  i18n: 'admin',  // Single namespace
}

// app/features/checkout/routes/checkout-layout.tsx
export const handle = {
  i18n: ['common', 'checkout'],  // Multiple namespaces
}
```

remix-i18next uses `getRouteNamespaces()` to collect all namespaces from matched routes and load them server-side.

### Component Usage

All components within a feature use the feature's namespace:

```typescript
// app/features/admin/components/sidebar.tsx
import { useTranslation } from 'react-i18next'

export const AdminSidebar = () => {
  const { t } = useTranslation('admin')  // Always specify namespace

  return (
    <nav>
      <span>{t('nav.content', 'Content')}</span>
      <span>{t('nav.settings', 'Settings')}</span>
    </nav>
  )
}
```

### Translation File Example

```json
// app/locales/en/admin.json
{
  "nav": {
    "content": "Content",
    "settings": "Settings",
    "logout": "Logout"
  },
  "dashboard": {
    "welcome": "Welcome",
    "selectFile": "Select a file to edit"
  },
  "editor": {
    "save": "Save",
    "saved": "Saved",
    "unsaved": "Unsaved changes"
  }
}
```

### Cross-Namespace Access

If a component needs strings from multiple namespaces:

```typescript
const { t } = useTranslation()

// Access different namespaces with prefix
t('common:errors.notFound', 'Not found')
t('admin:editor.save', 'Save')

// Or get multiple t functions
const { t: tCommon } = useTranslation('common')
const { t: tAdmin } = useTranslation('admin')
```

### TypeScript Types for Multiple Namespaces

No manual work — `i18next-cli` regenerates `app/types/resources.d.ts` for **all** namespaces on `yarn i18n:extract` / `i18n:types`. Just add the namespace's JSON files and re-run extraction.

### Trans Component for JSX in Translations

Use `<Trans>` when translated text contains React components (links, formatting, icons):

```tsx
import { Trans } from 'react-i18next'
import { Link } from 'react-router'

// Basic — link inside text
<Trans i18nKey="terms.agreement">
  By signing up, you agree to our <Link to="/terms">Terms of Service</Link>.
</Trans>
```

```json
{
  "terms.agreement": "By signing up, you agree to our <0>Terms of Service</0>."
}
```

**More examples:**

```tsx
// Bold/italic formatting
<Trans i18nKey="warning.permanent">
  This action is <strong>permanent</strong> and cannot be undone.
</Trans>
// → "This action is <0>permanent</0> and cannot be undone."

// Multiple components (indexed in order)
<Trans i18nKey="footer.credits">
  Built with <a href="https://react.dev">React</a> by <Link to="/about">Tegonal</Link>.
</Trans>
// → "Built with <0>React</0> by <1>Tegonal</1>."

// With interpolation
<Trans i18nKey="greeting.welcome" values={{ name: userName }}>
  Hello, <strong>{{name}}</strong>! Welcome back.
</Trans>
// → "Hello, <0>{{name}}</0>! Welcome back."

// Named components (clearer than indices)
<Trans
  i18nKey="legal.notice"
  components={{
    terms: <Link to="/terms" />,
    privacy: <Link to="/privacy" />,
  }}
>
  See our <terms>Terms</terms> and <privacy>Privacy Policy</privacy>.
</Trans>
// → "See our <terms>Terms</terms> and <privacy>Privacy Policy</privacy>."
```

**When to use `<Trans>` vs `t()`:**

| Scenario | Use |
|----------|-----|
| Plain text | `t('key', 'Default')` |
| Text with variables | `t('key', { count: 5 })` |
| JSX inside text (links, bold, icons) | `<Trans>` |
| Dynamic component positions by language | `<Trans>` |

**Rules:**
- Key must still be static (same as `t()`)
- Components indexed `<0>`, `<1>`, `<2>` in JSX order, or use named components
- Provide English default in component children
- Don't use `<Trans>` for plain text — `t()` is simpler

### Links with Language Prefix

```typescript
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export const Nav = () => {
  const { i18n } = useTranslation()

  return (
    <nav>
      {/* Internal links include language prefix */}
      <Link to={`/${i18n.language}/about`}>About</Link>
      <Link to={`/${i18n.language}/contact`}>Contact</Link>

      {/* External links */}
      <a href={`/${i18n.language}/feed.xml`}>RSS</a>
    </nav>
  )
}
```

### NavLink Helper Component

```typescript
interface NavItemLinkProps {
  item: { slug?: string; url?: string; label: string }
  lang: string
  className?: string
}

export const NavItemLink = ({ item, lang, className }: NavItemLinkProps) => {
  const href = item.url || `/${lang}/${item.slug}`
  const isExternal = item.url?.startsWith('http')

  if (isExternal) {
    return (
      <a className={className} href={href} rel="noopener noreferrer" target="_blank">
        {item.label}
      </a>
    )
  }

  return (
    <Link className={className} to={href}>
      {item.label}
    </Link>
  )
}
```

## Commands

```bash
# Extract translation keys from code
yarn i18n:extract

# Add to package.json scripts:
"i18n:extract": "i18next-cli extract && i18next-cli types"
```
