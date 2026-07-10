---
version: 2.0.0
applies: remix-i18next@8 & react-router@8
target: rules
domain: i18n
paths: ["**/locales/**", "**/i18n*", "scripts/**"]
tags: [i18n, translations, workflow, languages, pitfalls, operations]
---

# React Router 8 i18n — Operations

Translation workflow, language management, pitfalls, and known issues. For architecture see `VendorReactRouter8I18nSetup`.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| i18next docs | https://www.i18next.com/ | Core i18n library |
| i18next-cli | https://github.com/i18next/i18next-cli | Extraction + type generation |
| remix-i18next | https://github.com/sergiodxa/remix-i18next | v8 middleware integration |
| Context7 | `/i18next/i18next` | Good coverage |

## Translation File Workflow

**Never edit JSON translation files directly.** Use extraction:

1. Add `t()` calls in code with source-language defaults
2. Run `yarn i18n:extract`
3. The parser creates/updates keys in every locale under `app/locales/{lng}/{ns}.json`

```typescript
// 1. Add in code
t('feature.newButton', 'Click here')

// 2. Run extraction
yarn i18n:extract

// 3. Parser writes app/locales/en/common.json, app/locales/de/common.json, ...
```

**Exception — updating existing strings:** if an English string changes meaning, manually update the translated versions in every other language too. Don't leave them stale.

## Extraction Config

`i18next.config.ts` (v8 uses `defineConfig` from `i18next-cli`):

```typescript
import { defineConfig } from 'i18next-cli'

export default defineConfig({
  extract: {
    defaultNS: 'common',
    input: ['app/**/*.{ts,tsx}'],
    keySeparator: '.',
    nsSeparator: ':',
    output: 'app/locales/{{language}}/{{namespace}}.json',
    // Source language keeps the code default; other locales start empty
    defaultValue: (key, _ns, language, value) => (language === 'en' && value ? value : ''),
    removeUnusedKeys: true,
  },
  lint: { ignoredTags: ['noscript'] },
  locales: ['en', 'de'], // source language ('en') can differ from served languages
  types: {
    input: ['app/locales/en/*.json'],
    output: 'app/types/i18next.d.ts',
    resourcesFile: 'app/types/resources.d.ts',
  },
})
```

Common scripts: `i18n:extract` (extract + types), `i18n:extract:watch`, `i18n:types`, `i18n:lint`.

## Language Switcher Component

```typescript
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'

import { supportedLngs } from '~/i18n-config'

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const switchLanguage = (newLang: string) => {
    // Replace the leading language segment in the URL
    const parts = location.pathname.split('/')
    parts[1] = newLang
    navigate(parts.join('/'))
  }

  return (
    <div className="flex gap-2">
      {supportedLngs.map((lang) => (
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

Switching navigates to a `/{newLang}/...` URL; the i18n middleware detects the new segment and the root effect calls `i18n.changeLanguage`. The locale cookie is re-set by the root loader, so the choice persists.

## Server-Side Translation in Loaders

There is no standalone server instance in v8 — pull the request's i18next instance (already scoped to the detected locale) from the middleware and destructure `t`:

```typescript
import { getInstance } from '~/middleware/i18next'
import { type Route } from './+types/route'

export async function loader({ context }: Route.LoaderArgs) {
  const { t } = getInstance(context)
  const pageTitle = t('page.title', 'Default Title') // e.g. meta tags, error messages
  return { pageTitle }
}
```

## Detection Order

Configured in the i18n middleware's `detection.order` (`['custom', 'searchParams', 'cookie', 'header']`):

1. **URL path** — first segment (`/en/about` → `en`), via the custom `findLocale`
2. **`?lng` search param**
3. **Cookie** — the `lng` cookie (an explicit prior choice)
4. **`Accept-Language` header** — browser preference
5. **Fallback** — `defaultLocale`

Cookie **before** header is deliberate: an explicit language switch must survive a visit to a non-prefixed URL like `/`.

## Key Rules

1. **Always provide source-language defaults** in `t()` calls — the UI is never blank
2. **Never use dynamic keys** — `t()` must use static strings for extraction
3. **Validate `:lang` once** in the `_lang-guard` layout route (404 unsupported), not in every loader
4. **Include the language in all internal links** — `/${i18n.language}/${slug}`
5. **Run `yarn i18n:extract`** after adding new `t()` calls
6. **Trust server detection on the client** — client detection uses `order: ['htmlTag']`, no caches

## Adding a New Language

To add French (`fr`):

### 1. Register the language — `app/i18n-config.ts`

```typescript
import de from '~/locales/de'
import en from '~/locales/en'
import fr from '~/locales/fr' // NEW barrel (created in step 2)

export const supportedLngs = ['en', 'de', 'fr'] as const // add 'fr'

export const i18nConfig = {
  defaultNS: 'common',
  fallbackLng: defaultLocale as string,
  resources: { de, en, fr }, // add 'fr' — bundled server-side
  supportedLngs: [...supportedLngs] as string[],
}
```

### 2. Create the locale barrel — `app/locales/fr.ts`

```typescript
import common from './fr/common.json'

const resources = { common } as const
export default resources
```

### 3. Add to extraction — `i18next.config.ts`

```typescript
locales: ['en', 'de', 'fr'], // add 'fr'
```

### 4. Extract, then translate

```bash
yarn i18n:extract   # creates app/locales/fr/*.json with empty values
```

Fill in the `app/locales/fr/*.json` strings, then run `yarn i18n:types`.

### Files Affected

| File | Change |
|------|--------|
| `app/i18n-config.ts` | Add to `supportedLngs` and `resources` |
| `app/locales/fr.ts` | New barrel importing each namespace |
| `i18next.config.ts` | Add to `locales` |
| `app/locales/fr/*.json` | Created by extraction, then translated |

## Removing a Language

To remove German (`de`), reverse the above: drop it from `supportedLngs` and `resources` in `app/i18n-config.ts`, delete `app/locales/de.ts`, remove it from `locales` in `i18next.config.ts`, and delete the `app/locales/de/` directory. Re-run `yarn i18n:extract` to confirm it's gone.

## Pitfalls

### Never pass an array to useTranslation()

The i18next-cli extractor cannot resolve namespace arrays:

```typescript
// ❌ Extractor can't resolve this
const { t } = useTranslation(['admin', 'common'])

// ✅ Single namespace per call
const { t } = useTranslation('admin')
```

Declare multiple namespaces in route `handle.i18n` (arrays are fine there — needed for loading).

### Don't use Trans for plain text

`<Trans>` is for JSX inside translations (links, formatting). For plain strings, `t()` is simpler:

```typescript
// ❌ Overkill for plain text
<Trans i18nKey="nav.about">About</Trans>

// ✅ Use t()
{t('nav.about', 'About')}
```

### Never use native Date methods in i18n apps

`date.toLocaleDateString()` and `new Intl.DateTimeFormat()` ignore the app's i18n locale context. Use `date-fns` with the locale from i18n:

```typescript
import { format } from 'date-fns'
import { de, enUS, fr } from 'date-fns/locale'

const locales = { de, en: enUS, fr }

// ✅ Always pass locale from i18n context
format(date, 'dd.MM.yyyy', { locale: locales[currentLanguage] })

// ❌ Never — ignores app locale
date.toLocaleDateString()
new Intl.DateTimeFormat().format(date)
```

### JSON locale files — never Edit/Write directly

Use `jq` via Bash to set translation values. The Edit/Write tools corrupt JSON key ordering and escaping. A hook (`i18n-extract-reminder`) blocks these operations automatically.

```bash
# ✅ Set a translation value (path is app/locales/{lng}/{ns}.json)
jq '.nav.newItem = "Neuer Eintrag"' \
  app/locales/de/common.json > /tmp/common.json && mv /tmp/common.json app/locales/de/common.json

# ✅ Set multiple values at once
jq '.nav += {"newItem": "Neuer Eintrag", "settings": "Einstellungen"}' \
  app/locales/de/common.json > /tmp/common.json && mv /tmp/common.json app/locales/de/common.json
```

## Known Issues

### Key collision with nested keys
Parent and child keys must not collide. `t('nav')` and `t('nav.about')` in the same namespace causes i18next to return an object instead of a string.

**Fix:** Use unique parent keys or flatten the structure.

### i18next-cli empty strings silently break t() fallbacks

`yarn i18n:extract` creates missing translation keys with empty string values (`""`). i18next's default `returnEmptyString: true` means existing keys with `""` return `""` instead of the fallback default passed to `t()`.

**Impact:** UI elements render with correct `data-testid` but invisible text — no error, no console warning. Playwright sees elements as "hidden" (empty content).

**Fix:** Translate new keys immediately after extraction. If you can't yet, either delete the empty entries or set `returnEmptyString: false` (empty strings then fall through to the default).

### Client/server language mismatch
If the client shows a different language than the server-rendered HTML, check:
1. `<html lang>` is set correctly in `root.tsx` (from `i18n.language`)
2. Client detection uses `order: ['htmlTag']` only, `caches: []`
3. The root effect calls `i18n.changeLanguage(loaderData.locale)`
