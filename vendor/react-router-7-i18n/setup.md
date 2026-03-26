---
version: 1.0.0
applies: remix-i18next & react-router@7
target: rules
domain: i18n
paths: ["**/i18n*", "**/entry.server*", "**/config/i18n*"]
tags: [i18n, routing, ssr, remix-i18next, setup, configuration, server]
---

# React Router 7 i18n — Setup & Configuration

Internationalization setup for React Router 7 SSR applications using remix-i18next, i18next, and react-i18next.

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
