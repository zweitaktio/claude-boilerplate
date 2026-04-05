---
version: 1.1.0
applies: remix-i18next & react-router@7
target: rules
domain: i18n
paths: ["**/*.tsx", "**/locales/**"]
tags: [i18n, routing, translations, components, namespace, trans, patterns]
---

# React Router 7 i18n — Usage Patterns

Component-level i18n patterns, namespace splitting, Trans component, and routing with language prefixes.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| react-i18next | https://react.i18next.com | React bindings, hooks, Trans component |
| i18next docs | https://www.i18next.com/overview/getting-started | Core i18n library |
| GitHub | https://github.com/i18next/react-i18next | Source, issues |
| Context7 | `/i18next/react-i18next` | Good coverage |

## Client Setup

### `app/entry.client.tsx` — Client Hydration

```typescript
import i18next from 'i18next'
import I18nLanguageDetector from 'i18next-browser-languagedetector'
import I18nBackend from 'i18next-http-backend'
import { startTransition, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { HydratedRouter } from 'react-router/dom'
import { getInitialNamespaces } from 'remix-i18next/client'

import i18n from '~/i18n'

async function hydrate() {
  await i18next
    .use(initReactI18next)
    .use(I18nLanguageDetector)
    .use(I18nBackend)
    .init({
      ...i18n,
      backend: { loadPath: `/locales/${i18n.jsonFileSchema}` },
      detection: {
        // Only use htmlTag — trust server-detected language via <html lang>
        caches: [],
        order: ['htmlTag'],
      },
      ns: getInitialNamespaces(),
    })

  startTransition(() => {
    hydrateRoot(
      document,
      <I18nextProvider i18n={i18next}>
        <StrictMode>
          <HydratedRouter />
        </StrictMode>
      </I18nextProvider>,
    )
  })
}

void hydrate()
```

## Root Layout

### `app/root.tsx` — Language Sync

```typescript
import { type PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { useChangeLanguage } from 'remix-i18next/react'

// Declare which namespace(s) this route uses
export const handle = {
  i18n: 'common',
}

export default function App() {
  return <Outlet />
}

export function Layout({ children }: PropsWithChildren) {
  const { i18n } = useTranslation()

  // Sync React Router's detected language with react-i18next
  useChangeLanguage(i18n.language)

  return (
    <html dir={i18n.dir()} lang={i18n.language}>
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

```typescript
import { type LoaderFunctionArgs, redirect } from 'react-router'

import i18nextServer from '~/i18next.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const locale = await i18nextServer.getLocale(request)
  return redirect(`/${locale}/`)
}
```

### `app/routes/$lang._index.tsx` — Language-Prefixed Page

```typescript
import { type LoaderFunctionArgs } from 'react-router'

import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '~/config/i18n'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const lang = params.lang as SupportedLanguage

  // Validate language — 404 if unsupported
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    throw new Response('Not Found', { status: 404 })
  }

  return { lang }
}

const HomePage = ({ loaderData }: Route.ComponentProps) => {
  return <div>Home page in {loaderData.lang}</div>
}
export default HomePage
```

## TypeScript Types

### `app/i18n-types.d.ts` — Type Augmentation

```typescript
import type commonEn from '../public/locales/common.en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof commonEn
    }
  }
}
```

## Translation Files

### `public/locales/common.en.json`

```json
{
  "common": {
    "404": {
      "message": "The page you are looking for does not exist.",
      "title": "Page not found"
    }
  },
  "nav": {
    "about": "About",
    "contact": "Contact",
    "home": "Home"
  },
  "footer": {
    "copyright": "© {{year}} Company Name",
    "rss": "RSS"
  },
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
public/locales/
├── common.en.json      # Shared UI: nav, footer, errors, 404
├── common.de.json
├── admin.en.json       # Admin panel only
├── admin.de.json
├── checkout.en.json    # Checkout flow only
└── checkout.de.json
```

### When to Create a New Namespace

| Scenario | Namespace |
|----------|-----------|
| Shared across all pages (nav, footer, errors) | `common` (default) |
| Feature module with many strings (admin, checkout) | Dedicated namespace |
| A few strings in a feature | Keep in `common` |

**Rule of thumb:** Create a new namespace when a feature has 20+ translation keys.

### Configuration

Update `i18next.config.ts` to extract new namespaces:

```javascript
export default {
  defaultNamespace: 'common',
  // Parser extracts based on useTranslation() calls
  // No need to list namespaces explicitly
}
```

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
// public/locales/admin.en.json
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

```typescript
// app/i18n-types.d.ts
import type adminEn from '../public/locales/admin.en.json'
import type commonEn from '../public/locales/common.en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      admin: typeof adminEn
      common: typeof commonEn
    }
  }
}
```

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
