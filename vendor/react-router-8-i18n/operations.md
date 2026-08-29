---
version: 2.2.1
applies: remix-i18next@8 & react-router@8
target: rules
domain: i18n
paths: ["**/locales/**", "**/i18n*", "scripts/**"]
tags: [i18n, translations, workflow, languages, pitfalls, operations]
---

# React Router 8 i18n — Operations

Translation workflow, language management, pitfalls, and known issues. For architecture see `vendor/react-router-8-i18n/setup`.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| i18next docs | https://www.i18next.com/ | Core i18n library |
| i18next-cli | https://github.com/i18next/i18next-cli | Extraction + type generation |
| remix-i18next | https://github.com/sergiodxa/remix-i18next | v8 middleware integration |

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

v8 has no standalone server instance. Pull the request's i18next instance from the middleware, and
destructure `t`. The middleware already scopes that instance to the detected locale.

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

1. **URL path** — the first segment, so `/en/about` gives `en`. The custom `findLocale` reads it
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

### If the backend is Payload CMS — content locales

A UI locale and a Payload **content** locale are separate things. The section above covers the UI
locale.

When the backend is Payload with `localization.locales`, a new language needs an edit in **two** sources
of truth. The first is the backend locale constant that feeds `localization.locales`. The second is the
frontend i18n constant. The order of the steps matters.

**1. Regenerate the types before you touch a hardcoded locale union.** `payload-types.ts` encodes the
locale union. Every `payload.create` and `payload.update` call site with a `locale` validates against it.

Add the locale to the backend constant. Then run the type generation and the type-copy step *first*.

An edit to a `z.enum` schema or a locale cast before the regeneration produces many
`TS2322: '<locale>' is not assignable` errors. They clear after the regeneration. They are noise, never
real failures.

**2. Let `tsc` find the localized dictionaries.** A typed `Record<Locale, …>` dictionary becomes a
compile error until you add the new locale. `tsc` is the completeness oracle. Run it, and work through
the list.

Expect hits well beyond the translation files. The list covers transactional email copy, PDF and
document text, label maps, seeded CMS content, and inline message maps inside endpoints. A `date-fns`
locale map needs a locale *import*, never a translation.

**3. Grep for the casts, because `tsc` cannot see them.** A cast such as `as 'de' | 'en' | 'fr'` narrows
the new locale away in silence. The compiler does *not* flag it, because a cast defines its own type.
Find these with grep, never with the compiler.

**4. Migrations — the enum add.** Adding a content locale emits `ALTER TYPE … ADD VALUE` for **every** `_locales` enum in the schema (one per localized collection and version table).

- **Idempotency:** add `IF NOT EXISTS` to every `ADD VALUE` and `ADD COLUMN` in `up()`. On PG12 and
  later, `ALTER TYPE … ADD VALUE IF NOT EXISTS` runs inside a migration transaction, as long as the same
  transaction does not USE the new value. A locale addition only adds, so it is safe. `down()` needs no
  guard.
- **`migrate:create` captures all pending drift, not only your change.** It diffs the latest migration
  snapshot against the *current* config. It therefore sweeps in a committed but unmigrated schema change
  from a teammate. Never hand-edit the generated snapshot `.json` to strip a foreign column, because
  that breaks the migration chain. Sequence your commit with the other change instead.
- **Shared-branch problem:** `migrate:create` rewrites `migrations/index.ts` to import every migration
  file on disk. That includes a teammate's uncommitted file. Your migration then couples to their
  unfinished work.
- Do **not** run the migrate command in local dev, because dev auto-applies a schema change. The migration first runs on staging or production.

## Removing a Language

To remove German (`de`), reverse the steps above. Drop `de` from `supportedLngs` and `resources` in
`app/i18n-config.ts`. Delete `app/locales/de.ts`. Remove `de` from `locales` in `i18next.config.ts`.
Delete the `app/locales/de/` directory. Then re-run `yarn i18n:extract` to confirm the removal.

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

`core/i18n` rule 10 states the rule. This is what it looks like:

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

### The first locale in the array gets source-language text, not a blank

i18next-cli treats **`locales[0]` as the primary locale** and writes the code's `t()` default straight
into it, bypassing the `defaultValue` function that blanks every other locale. If the array is sorted
alphabetically and the source language is not first — `['de','en','es','fr','it']` with
`fallbackLng: 'en'` — then `de` receives English while `es`/`fr`/`it` receive `""`.

The consequence is that **the primary locale is the one with no untranslated marker**: source text in
a `de` file is indistinguishable from a deliberate translation that happens to match, and a
`select(getpath($p)=="")` blank audit reports nothing for it. Detect by diffing against the source
locale instead:

```bash
jq -r --slurpfile en app/locales/en/<ns>.json \
  'paths(scalars) as $p | select(getpath($p) == ($en[0] | getpath($p))) | $p|join(".")' \
  app/locales/de/<ns>.json
```

Expect a few legitimate hits (words identical across the two languages) — read the list, never pipe it
into a fix. **Audit every namespace, not the ones you edited**: an audit scoped to where work happens
can never find a namespace nobody works in.

Either put the source language first in `locales`, or keep the audit above in the loop. Nothing checks
that `locales[0]` and `fallbackLng` agree.

### Prove dynamic `t()` call sites are covered before `removeUnusedKeys: true`

The extractor only sees **static** `t('literal')` calls. Any key reached through a template literal or
a variable looks unused and is deleted. Before trusting the prune:

```bash
git grep -nE "[ (,{=>?:&|]t\(\`|[ (,{=>?:&|]t\([A-Za-z_]" \
  -- 'app/**/*.{ts,tsx}' ':!app/locales' ':!app/types'
```

Every hit must either be covered by a `preservePatterns` glob, or backed by a dummy extraction file
supplying source-language defaults. Everything else is a static literal the extractor re-adds, so
anything pruned is provably dead. Then regenerate types and run the typecheck — `tsc` deriving from
the pruned source JSON is the empirical proof that no live key was removed.

Breadcrumbs (key from a route `handle` export) and help topics (key a runtime prop) are the two
families that are intentionally dynamic. Keep them in `preservePatterns`; do not "fix" them into
static lookups.

**Run the formatter before committing generated `resources.d.ts`.** i18next-cli emits quoted keys,
double quotes and trailing commas, so a fresh types run shows a large diff that vanishes once
prettier runs. If you stage at commit time (`git commit --only`) and a pre-commit hook reformats
*after* staging, the commit carries the unformatted version and the file is dirty again the moment
the commit finishes — which reads to peers as an unknown-owner artifact.

## Known Issues

### Key collision with nested keys
`core/i18n` rule 8 forbids this. The symptom here: i18next returns an object instead of a string, and
the UI renders nothing.

**Fix:** Use a unique parent key, or flatten the structure.

### i18next-cli empty strings silently break t() fallbacks

`yarn i18n:extract` creates missing translation keys with empty string values (`""`). i18next's default `returnEmptyString: true` means existing keys with `""` return `""` instead of the fallback default passed to `t()`.

**Impact:** UI elements render with correct `data-testid` but invisible text — no error, no console warning. Playwright sees elements as "hidden" (empty content).

**Fix:** Translate new keys immediately after extraction. If you can't yet, either delete the empty entries or set `returnEmptyString: false` (empty strings then fall through to the default).

### Client/server language mismatch
If the client shows a different language than the server-rendered HTML, check:
1. `<html lang>` is set correctly in `root.tsx` (from `i18n.language`)
2. Client detection uses `order: ['htmlTag']` only, `caches: []`
3. The root effect calls `i18n.changeLanguage(loaderData.locale)`
