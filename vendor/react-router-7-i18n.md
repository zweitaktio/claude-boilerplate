---
version: 1.5.0
applies: remix-i18next & react-router@7
target: graph
tags: [i18n, routing, locale, translations, ssr, language, remix-i18next]
---

# React Router 7 i18n with remix-i18next

Comprehensive internationalization setup for React Router 7 SSR applications using remix-i18next, i18next, and react-i18next.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| remix-i18next | https://github.com/sergiodxa/remix-i18next | Primary integration library |
| i18next docs | https://www.i18next.com/overview/getting-started | Core i18n library |
| react-i18next | https://react.i18next.com | React bindings |
| i18next-parser | https://github.com/i18next/i18next-parser | Key extraction tool |
| Context7 | `/i18next/i18next` | Good coverage |

## Dependencies

```json
{
  "dependencies": {
    "i18next": "^25.x",
    "i18next-browser-languagedetector": "^8.x",
    "i18next-fs-backend": "^2.x",
    "i18next-http-backend": "^3.x",
    "react-i18next": "^16.x",
    "remix-i18next": "^7.x"
  },
  "devDependencies": {
    "i18next-parser": "^9.x"
  }
}
```

## File Structure

```
app/
├── config/
│   └── i18n.ts              # Language constants and helpers
├── i18n.ts                   # i18next config object
├── i18n-types.d.ts           # TypeScript augmentation
├── i18next.server.ts         # Server-side i18next instance
├── entry.server.tsx          # SSR entry with i18next
├── entry.client.tsx          # Client hydration with i18next
├── root.tsx                  # Layout with language sync
├── routes/
│   ├── _index.tsx            # Root redirect to /:lang/
│   ├── $lang._index.tsx      # Language-prefixed home
│   └── $lang.$slug.tsx       # Language-prefixed pages
└── services/
    └── cookies/
        └── i18nextCookie.ts  # Language cookie config
public/
└── locales/
    ├── common.en.json        # English translations
    └── common.de.json        # German translations
i18next-parser.config.mjs     # Extraction tool config
```

## Configuration Files

### `app/config/i18n.ts` — Language Constants

```typescript
export const SUPPORTED_LANGUAGES = ['en', 'de'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

// For OpenGraph and meta tags
export const LOCALE_MAP: Record<SupportedLanguage, string> = {
  de: 'de_CH',
  en: 'en_US',
}

export function getSupportedLanguageOrDefault(lang: string | undefined): SupportedLanguage {
  if (lang && isSupportedLanguage(lang)) {
    return lang
  }
  return DEFAULT_LANGUAGE
}

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
}
```

### `app/i18n.ts` — i18next Config Object

```typescript
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '~/config/i18n'

export default {
  defaultNS: 'common',
  fallbackLng: DEFAULT_LANGUAGE,
  jsonFileSchema: '{{ns}}.{{lng}}.json',
  supportedLngs: [...SUPPORTED_LANGUAGES],
}
```

### `app/services/cookies/i18nextCookie.ts` — Cookie Config

```typescript
import { createCookie } from 'react-router'

export const i18nextCookie = createCookie('i18next', {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
})
```

### `i18next-parser.config.mjs` — Extraction Config

```javascript
export default {
  contextSeparator: '_',
  createOldCatalogs: true,
  defaultNamespace: 'common',
  defaultValue: '',
  indentation: 2,
  keepRemoved: false,
  keySeparator: '.',
  lexers: {
    default: ['JavascriptLexer'],
    js: ['JavascriptLexer'],
    jsx: ['JsxLexer'],
    mjs: ['JavascriptLexer'],
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
  },
  lineEnding: 'auto',
  locales: ['en', 'de'],  // Must match SUPPORTED_LANGUAGES
  namespaceSeparator: ':',
  output: 'public/locales/$NAMESPACE.$LOCALE.json',
  pluralSeparator: '_',
  sort: true,
  verbose: false,
}
```

## Server Setup

### `app/i18next.server.ts` — Server Instance

```typescript
import Backend from 'i18next-fs-backend'
import { resolve } from 'node:path'
import { RemixI18Next } from 'remix-i18next/server'

import i18n from '~/i18n'

const i18nextServer = new RemixI18Next({
  detection: {
    fallbackLanguage: i18n.fallbackLng,
    // Custom detection: extract language from URL path
    async findLocale(request) {
      const pathname = new URL(request.url).pathname
      const locale = pathname?.split('/').at(1)
      return locale || ''
    },
    order: ['custom', 'header', 'cookie'],
    supportedLanguages: i18n.supportedLngs,
  },
  i18next: {
    ...i18n,
    backend: {
      loadPath: resolve(`./public/locales/${i18n.jsonFileSchema}`),
    },
  },
  plugins: [Backend],
})

export default i18nextServer
```

### `app/entry.server.tsx` — SSR Entry

```typescript
import { createReadableStreamFromReadable } from '@react-router/node'
import { createInstance } from 'i18next'
import Backend from 'i18next-fs-backend'
import { isbot } from 'isbot'
import { resolve } from 'node:path'
import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { type EntryContext, ServerRouter } from 'react-router'

import i18n from './i18n'
import i18nextServer from './i18next.server'

const ABORT_DELAY = 5_000

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  return isbot(request.headers.get('user-agent') || '')
    ? handleBotRequest(request, responseStatusCode, responseHeaders, reactRouterContext)
    : handleBrowserRequest(request, responseStatusCode, responseHeaders, reactRouterContext)
}

async function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  const instance = createInstance()
  const lng = await i18nextServer.getLocale(request)
  const ns = i18nextServer.getRouteNamespaces(reactRouterContext)

  await instance
    .use(initReactI18next)
    .use(Backend)
    .init({
      ...i18n,
      backend: { loadPath: resolve('./public/locales/{{ns}}.{{lng}}.json') },
      lng,
      ns,
    })

  return new Promise((resolve, reject) => {
    let shellRendered = false
    const { abort, pipe } = renderToPipeableStream(
      <I18nextProvider i18n={instance}>
        <ServerRouter context={reactRouterContext} url={request.url} />
      </I18nextProvider>,
      {
        onAllReady() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)
          responseHeaders.set('Content-Type', 'text/html')
          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }))
          pipe(body)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          if (shellRendered) console.error(error)
        },
        onShellError(error: unknown) {
          reject(error)
        },
      },
    )
    setTimeout(abort, ABORT_DELAY)
  })
}

async function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  const instance = createInstance()
  const lng = await i18nextServer.getLocale(request)
  const ns = i18nextServer.getRouteNamespaces(reactRouterContext)

  await instance
    .use(initReactI18next)
    .use(Backend)
    .init({
      ...i18n,
      backend: { loadPath: resolve('./public/locales/{{ns}}.{{lng}}.json') },
      lng,
      ns,
    })

  return new Promise((resolve, reject) => {
    let shellRendered = false
    const { abort, pipe } = renderToPipeableStream(
      <I18nextProvider i18n={instance}>
        <ServerRouter context={reactRouterContext} url={request.url} />
      </I18nextProvider>,
      {
        onError(error: unknown) {
          responseStatusCode = 500
          if (shellRendered) console.error(error)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onShellReady() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)
          responseHeaders.set('Content-Type', 'text/html')
          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }))
          pipe(body)
        },
      },
    )
    setTimeout(abort, ABORT_DELAY)
  })
}
```

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

Update `i18next-parser.config.mjs` to extract new namespaces:

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
"i18n:extract": "i18next 'app/**/*.{js,ts,tsx}' --config i18next-parser.config.mjs"
```

## Translation File Workflow

**Never edit JSON translation files directly.** Use the extraction workflow:

1. Add `t()` calls in code with English defaults
2. Run `yarn i18n:extract`
3. Parser creates/updates keys in all locale files

```typescript
// 1. Add in code
t('feature.newButton', 'Click here')

// 2. Run extraction
yarn i18n:extract

// 3. Parser adds to public/locales/common.en.json, common.de.json, etc.
```

**Exception — updating existing strings:**

If an existing English string changes meaning, manually update ALL language files with translated versions:

```json
// common.en.json — English changed
{ "action.save": "Save changes" }  // was "Save"

// common.de.json — must update translation too
{ "action.save": "Änderungen speichern" }  // was "Speichern"
```

Don't just change English and leave other languages stale.

## Language Switcher Component

```typescript
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'

import { SUPPORTED_LANGUAGES } from '~/config/i18n'

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const switchLanguage = (newLang: string) => {
    // Replace current language segment in URL
    const pathParts = location.pathname.split('/')
    pathParts[1] = newLang  // Replace language segment
    const newPath = pathParts.join('/')

    navigate(newPath)
  }

  return (
    <div className="flex gap-2">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          className={i18n.language === lang ? 'font-bold' : ''}
          onClick={() => switchLanguage(lang)}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
```

## Server-Side Translation in Loaders

```typescript
import { type LoaderFunctionArgs } from 'react-router'

import i18nextServer from '~/i18next.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Get translation function for server-side use
  const t = await i18nextServer.getFixedT(request)

  // Use in loader (e.g., for meta tags, error messages)
  const pageTitle = t('page.title', 'Default Title')

  return { pageTitle }
}
```

## Detection Order

1. **URL Path** — First segment (e.g., `/en/about` → `en`)
2. **Cookie** — `i18next` cookie (fallback)
3. **Accept-Language Header** — Browser preference (fallback)
4. **Default** — `DEFAULT_LANGUAGE` from config

## Key Rules

1. **Always provide English defaults** in `t()` calls — ensures UI is never blank
2. **Never use dynamic keys** — `t()` must use static strings for extraction
3. **Validate language in loaders** — return 404 for unsupported languages
4. **Include language in all internal links** — `/${i18n.language}/${slug}`
5. **Run `yarn i18n:extract`** after adding new `t()` calls
6. **Trust server detection on client** — use `htmlTag` order only, no caches

## Adding a New Language

When adding a new language (e.g., French `fr`), update these files:

### 1. Language Configuration

**`app/config/i18n.ts`**

```typescript
export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr'] as const  // Add 'fr'
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

export const LOCALE_MAP: Record<SupportedLanguage, string> = {
  de: 'de_CH',
  en: 'en_US',
  fr: 'fr_FR',  // Add locale for OpenGraph/meta tags
}
```

### 2. Parser Configuration

**`i18next-parser.config.mjs`**

```javascript
export default {
  locales: ['en', 'de', 'fr'],  // Add 'fr'
  // ... rest of config
}
```

### 3. Run Extraction

```bash
yarn i18n:extract
```

This creates new translation files:
- `public/locales/common.fr.json`
- `public/locales/admin.fr.json`
- (etc. for each namespace)

New files are populated with empty strings for each key.

### 4. Add Translations

Translate all strings in the new `*.fr.json` files. Keys are extracted with empty values — fill them in.

### 5. Content Files (if applicable)

If the project has language-specific content (MDX, markdown):

```bash
# Copy content structure for new language
cp -r content/en content/fr

# Translate content files
```

### 6. Test

1. Visit `/{newLang}/` (e.g., `/fr/`)
2. Verify language detection works
3. Check all UI strings are translated
4. Test language switcher

### Files Affected Summary

| File | Change |
|------|--------|
| `app/config/i18n.ts` | Add to `SUPPORTED_LANGUAGES` and `LOCALE_MAP` |
| `i18next-parser.config.mjs` | Add to `locales` array |
| `public/locales/*.{lang}.json` | Created by extraction, then translated |
| `content/{lang}/` | Copy and translate (if content is localized) |
| `app/i18n-types.d.ts` | No change needed (types from `en` only) |

---

## Removing a Language

When removing a language (e.g., removing German `de`):

### 1. Language Configuration

**`app/config/i18n.ts`**

```typescript
export const SUPPORTED_LANGUAGES = ['en'] as const  // Remove 'de'

export const LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: 'en_US',
  // Remove de: 'de_CH'
}
```

### 2. Parser Configuration

**`i18next-parser.config.mjs`**

```javascript
export default {
  locales: ['en'],  // Remove 'de'
}
```

### 3. Delete Translation Files

```bash
rm public/locales/*.de.json
rm public/locales/*.de_old.json  # If exists
```

### 4. Delete Content Files (if applicable)

```bash
rm -rf content/de
```

### 5. Update Sitemap/SEO (if applicable)

If the sitemap or SEO config references languages, update those too.

### 6. Run Extraction (optional)

```bash
yarn i18n:extract
```

Confirms the removed language is no longer generated.

### Files Affected Summary

| File | Change |
|------|--------|
| `app/config/i18n.ts` | Remove from `SUPPORTED_LANGUAGES` and `LOCALE_MAP` |
| `i18next-parser.config.mjs` | Remove from `locales` array |
| `public/locales/*.{lang}.json` | Delete files |
| `content/{lang}/` | Delete directory (if content is localized) |

---

## Known Issues

### Key collision with nested keys
Parent and child keys must not collide. `t('nav')` and `t('nav.about')` in the same namespace causes i18next to return an object instead of a string.

**Fix:** Use unique parent keys or flatten the structure.

### Client/server language mismatch
If client shows different language than server-rendered HTML, check:
1. `<html lang>` attribute is set correctly in root.tsx
2. Client detection uses `order: ['htmlTag']` only
3. `useChangeLanguage()` is called in Layout
