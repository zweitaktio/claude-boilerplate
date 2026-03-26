---
version: 1.0.0
applies: remix-i18next & react-router@7
target: rules
domain: i18n
paths: ["**/locales/**", "**/i18n*", "scripts/**"]
tags: [i18n, translations, workflow, languages, pitfalls, operations]
---

# React Router 7 i18n — Operations

Translation workflow, language management, pitfalls, and known issues.

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

## Pitfalls

### Never pass an array to useTranslation()

The i18next-parser extractor cannot resolve namespace arrays:

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
# ✅ Set a translation value
jq '.nav.newItem = "Neuer Eintrag"' \
  app/locales/de.json > /tmp/de.json && mv /tmp/de.json app/locales/de.json

# ✅ Set multiple values at once
jq '.nav += {"newItem": "Neuer Eintrag", "settings": "Einstellungen"}' \
  app/locales/de.json > /tmp/de.json && mv /tmp/de.json app/locales/de.json
```

## Known Issues

### Key collision with nested keys
Parent and child keys must not collide. `t('nav')` and `t('nav.about')` in the same namespace causes i18next to return an object instead of a string.

**Fix:** Use unique parent keys or flatten the structure.

### i18next-parser empty strings silently break t() fallbacks

`yarn i18n:extract` creates missing translation keys with empty string values (`""`) in locale JSON files. i18next's default `returnEmptyString: true` means existing keys with `""` return `""` instead of the fallback default value passed to `t()`.

**Impact:** UI elements render with correct `data-testid` but invisible text — no error, no console warning. Playwright tests see elements as "hidden" (empty content).

**Fix:** Always translate new keys immediately after extraction. If you can't translate yet, either delete the empty entries or set `returnEmptyString: false` in the i18next config (which makes empty strings fall through to the default value).

### Client/server language mismatch
If client shows different language than server-rendered HTML, check:
1. `<html lang>` attribute is set correctly in root.tsx
2. Client detection uses `order: ['htmlTag']` only
3. `useChangeLanguage()` is called in Layout
