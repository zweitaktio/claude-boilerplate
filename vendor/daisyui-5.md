---
version: 1.3.0
applies: daisyui@5
target: graph
tags: [daisyui, ui, components, tailwind, styling, themes]
---

# DaisyUI 5

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| llms.txt | https://daisyui.com/llms.txt | **Preferred** — fetch via WebFetch |
| Official docs | https://daisyui.com/docs | Component reference |
| Context7 | `/saadeghi/daisyui` | May return v4 docs — verify `fieldset` class exists |
| GitHub | https://github.com/saadeghi/daisyui | Source, issues, changelog |

## Documentation Lookup

**IMPORTANT:** Always verify the installed version in `package.json` before using this memory. DaisyUI 4 and 5 have breaking differences (form classes, syntax).

For up-to-date documentation:
1. **Preferred:** Fetch https://daisyui.com/llms.txt directly via WebFetch
2. **Alternative:** Use Context7 with `/saadeghi/daisyui` but verify it returns v5 docs (check for `fieldset` class — v4 uses `form-control`)

**Do NOT use Context7 blindly** — it may return v4 documentation which will cause errors on v5 projects.

## Installation & Config (Tailwind CSS v4)

```css
@import 'tailwindcss';
@plugin "daisyui" {
  themes: light --default, dark --prefersdark;
  logs: false;
}
```

## Core Rule
Always use DaisyUI component classes (badge, btn, card, alert, etc.) instead of hand-rolling styles with plain Tailwind.

## Plugin Options

| Option | Description | Example |
|--------|-------------|---------|
| `themes` | Enable specific themes | `themes: light --default, dark --prefersdark;` |
| `--default` | Set as default theme | `light --default` |
| `--prefersdark` | Use for `prefers-color-scheme: dark` | `dark --prefersdark` |
| `root` | Root selector for CSS variables | `root: ":root";` |
| `prefix` | Prefix all daisyUI classes | `prefix: daisy-;` |
| `logs` | Enable/disable console logs | `logs: false;` |
| `exclude` | Exclude specific components | `exclude: rootscrollgutter, checkbox;` |

### All Available Themes

light, dark, cupcake, bumblebee, emerald, corporate, synthwave, retro, cyberpunk, valentine, halloween, garden, forest, aqua, lofi, pastel, fantasy, wireframe, black, luxury, dracula, cmyk, autumn, business, acid, lemonade, night, coffee, winter, dim, nord, sunset, caramellatte, abyss, silk

## Key Components

**Button:** `btn` + `btn-primary|secondary|accent|neutral|info|success|warning|error` + `btn-outline|soft|dash|ghost|link` + `btn-xs|sm|md|lg|xl` + `btn-wide|block|circle|square` + `btn-active|btn-disabled`

**Card:** `card` + `card-body`, `card-title`, `card-actions` + `card-border|dash` + `card-xs|sm|md|lg|xl`

**Modal:** Native `<dialog class="modal">` + `modal-box` + `modal-action` + `modal-backdrop` + `modal-bottom|modal-middle|modal-top` + responsive: `sm:modal-middle`

**Badge:** `badge` + color/size variants

**Alert:** `alert` + `alert-info|success|warning|error`

## Form Components (v5 — NOT v4)

**IMPORTANT:** DaisyUI 5 removed `form-control`, `label-text`, `label-text-alt`, `input-bordered`, `select-bordered`, `textarea-bordered`. Use the `fieldset`/`label` pattern instead.

| Class | Element | Purpose |
|-------|---------|---------|
| `fieldset` | `<fieldset>` | Groups related form fields |
| `fieldset-legend` | `<legend>` | Title for a styled fieldset group |
| `label` | `<label>` or `<p>` | Field label or helper/error text |
| `input` | `<input>` | Text input (bordered by default in v5) |
| `select` | `<select>` | Dropdown select |
| `textarea` | `<textarea>` | Multiline text |
| `checkbox` | `<input type="checkbox">` | Checkbox |
| `toggle` | `<input type="checkbox">` | Toggle switch |
| `radio` | `<input type="radio">` | Radio button |
| `file-input` | `<input type="file">` | File upload |
| `floating-label` | `<label>` | Floating label effect |
| `join` / `join-item` | `<div>` / children | Grouped inputs/buttons |

### Single Field
```html
<fieldset class="fieldset">
  <label class="label">Email</label>
  <input type="email" class="input" placeholder="Email" />
  <p class="label">Helper text or error</p>
</fieldset>
```

### Fieldset Group (bordered box)
```html
<fieldset class="fieldset bg-base-200 border-base-300 rounded-box border p-4">
  <legend class="fieldset-legend">Login</legend>
  <label class="label">Email</label>
  <input type="email" class="input" />
  <label class="label">Password</label>
  <input type="password" class="input" />
  <button class="btn btn-neutral mt-4">Login</button>
</fieldset>
```

### Inline Label (prefix/suffix)
```html
<label class="input">
  <span class="label">https://</span>
  <input type="text" placeholder="URL" />
</label>
```

### Floating Label
```html
<label class="floating-label">
  <span>Email</span>
  <input type="email" class="input input-md" placeholder="mail@example.com" />
</label>
```

### Join Group
```html
<div class="join">
  <input class="input join-item" placeholder="Search" />
  <select class="select join-item"><option>All</option></select>
  <button class="btn join-item">Go</button>
</div>
```

### Checkbox/Toggle
```html
<fieldset class="fieldset">
  <label class="label cursor-pointer justify-start gap-3">
    <input type="checkbox" class="checkbox" />
    <span>Remember me</span>
  </label>
</fieldset>
```

### Input Sizes & Colors

All form inputs support sizes: `input-xs`, `input-sm`, `input-md`, `input-lg`, `input-xl` (same pattern for select, textarea, checkbox, toggle).

All form inputs support colors: `input-primary`, `input-error`, `input-warning`, etc. (same pattern for select, textarea).

### Radio Group
```html
<fieldset class="fieldset">
  <div class="flex flex-col gap-2">
    <label class="label cursor-pointer justify-start gap-3">
      <input type="radio" class="radio radio-primary" name="status" checked />
      <span>Draft</span>
    </label>
    <label class="label cursor-pointer justify-start gap-3">
      <input type="radio" class="radio radio-primary" name="status" />
      <span>Published</span>
    </label>
  </div>
</fieldset>
```

### Radio Button Group (join)
```html
<div class="join">
  <input type="radio" name="view" aria-label="Grid" class="btn join-item" checked />
  <input type="radio" name="view" aria-label="List" class="btn join-item" />
</div>
```

### File Input
```html
<fieldset class="fieldset">
  <label class="label">Upload</label>
  <input type="file" class="file-input w-full" />
  <p class="label">Max 10MB</p>
</fieldset>
```

## Wrapper Components Pattern

Projects should wrap DaisyUI primitives in reusable components with `label`, `error`, `hint` props. Use `class-variance-authority` for size/color variants.

```tsx
// Usage
<Input label="Email" error={errors.email} hint="We won't share it" placeholder="mail@example.com" />
<Select label="Role" options={[{ label: 'Admin', value: 'admin' }]} placeholder="Pick one" />
<Textarea label="Bio" placeholder="Tell us about yourself" />
<Checkbox label="Accept terms" />
<Toggle label="Enable notifications" />
```

Props: `label`, `error`, `hint`, `size` (xs/sm/md/lg), `variant` (primary/error/warning/etc).

For raw DaisyUI usage (inline labels, joins, radios), use the classes directly.

## Color System
Uses OKLCH format via CSS variables: `--color-primary`, `--color-base-100`, etc.

## Custom Theme
```css
@plugin "daisyui/theme" {
  name: "mytheme";
  default: true;
  color-scheme: light;
  --color-primary: oklch(55% 0.3 240);
  /* ... */
}
```

## Theme Switching

Use `data-theme` attribute on `<html>` or `theme-controller` class:

```html
<html data-theme="dark">

<!-- Toggle with theme controller -->
<input type="checkbox" value="dark" class="toggle theme-controller" />
```

## Background Colors

- `bg-base-100` — Main background (use instead of `bg-white`)
- `bg-base-200` — Slightly darker
- `bg-base-300` — Even darker
- `bg-neutral` — Neutral color
- `bg-primary`, `bg-secondary`, `bg-accent` — Theme colors

## Base UI Integration

DaisyUI is CSS-only. For components that need focus management, keyboard navigation, or ARIA state management, use Base UI (`@base-ui/react`) for behavior and DaisyUI classes/theme tokens for styling. See `VendorBaseUiReact` for patterns.

**Do NOT use these DaisyUI CSS-only patterns in production:**
- `<dialog class="modal">` — no focus trap, no programmatic open/close
- `<div class="dropdown">` — no keyboard navigation, no ARIA roles
- `<details class="collapse">` — no ARIA expanded state

Use Base UI Dialog, Menu, and Accordion instead, styled with DaisyUI theme tokens.

## Class Cheatsheet

```
Buttons:   btn btn-{primary|secondary|accent|neutral|info|success|warning|error}
                btn-{outline|soft|dash|ghost|link}  btn-{xs|sm|md|lg|xl}
Cards:     card > card-body > card-title + card-actions
Badges:    badge badge-{color} badge-{xs|sm|md|lg|xl}
Alerts:    alert alert-{info|success|warning|error}
Forms:     fieldset > label + input/select/textarea + label(hint/error)
Layout:    join > join-item, divider, stack
Nav:       navbar, breadcrumbs, menu > li > a
Loading:   loading loading-{spinner|dots|ring|ball|bars|infinity} loading-{xs|sm|md|lg|xl}
Toggle:    toggle toggle-{color} toggle-{xs|sm|md|lg|xl}
Checkbox:  checkbox checkbox-{color} checkbox-{xs|sm|md|lg|xl}
```

## Component Cheatsheets

Source: https://daisyui.com/llms.txt (DaisyUI 5 official LLM reference)

| Component | Classes |
|-----------|---------|
| **btn** | color: `btn-neutral/primary/secondary/accent/info/success/warning/error` · style: `btn-outline/dash/soft/ghost/link` · size: `btn-xs/sm/md/lg/xl` · modifier: `btn-wide/block/square/circle` · behavior: `btn-active/btn-disabled` |
| **badge** | color: `badge-neutral/primary/secondary/accent/info/success/warning/error` · style: `badge-outline/dash/soft/ghost` · size: `badge-xs/sm/md/lg/xl` |
| **card** | parts: `card-body/card-title/card-actions/figure` · size: `card-xs/sm/md/lg/xl` · modifier: `card-dash/card-border` · responsive: `sm:card-horizontal` |
| **alert** | color: `alert-info/success/warning/error` · style: `alert-outline/dash/soft` · direction: `alert-vertical/alert-horizontal` · responsive: `sm:alert-horizontal` |
| **tabs** | parts: `tab/tab-content` · style: `tabs-box/tabs-border/tabs-lift` · modifier: `tab-active/tab-disabled` · placement: `tabs-top/tabs-bottom` |
| **modal** | parts: `modal-box/modal-action/modal-backdrop/modal-toggle` · modifier: `modal-open` · placement: `modal-top/middle/bottom/start/end` · use native `<dialog>` element |
| **collapse** | parts: `collapse-title/collapse-content` · modifier: `collapse-arrow/collapse-plus/collapse-open/collapse-close` · use `name` attr for radio-group behavior |
| **dropdown** | use `<details>`+`<summary>` or popover API or CSS focus · parts: `dropdown-content` · placement: `dropdown-top/bottom/left/right/end` · modifier: `dropdown-open/hover` |
| **forms** | `fieldset/fieldset-legend/label/input/select/textarea/checkbox/toggle/radio/file-input/floating-label` · `join/join-item` for grouped inputs · `validator` class for HTML5 validation styling |
| **menu** | parts: `menu-title/menu-dropdown/menu-dropdown-toggle` · modifier: `menu-disabled/active/focus` · size: `menu-xs/sm/md/lg/xl` · direction: `menu-vertical/horizontal` |
| **skeleton** | component: `skeleton` · modifier: `skeleton-text` · use for loading states |
| **tooltip** | placement: `tooltip-top/bottom/left/right` · color: `tooltip-primary/secondary/accent/info/success/warning/error` · modifier: `tooltip-open` |
| **swap** | parts: `swap-on/swap-off/swap-indeterminate` · modifier: `swap-active` · style: `swap-rotate/swap-flip` |
| **indicator** | parts: `indicator-item` · placement: `indicator-top/middle/bottom` + `indicator-start/center/end` |
| **join** | class `join` on container, `join-item` on children · direction: `join-vertical/join-horizontal` · works with btn, input, select, etc. |
| **loading** | style: `loading-spinner/dots/ring/ball/bars/infinity` · size: `loading-xs/sm/md/lg/xl` |
| **status** | color: `status-primary/secondary/accent/info/success/warning/error` · size: `status-xs/sm/md/lg/xl` |
| **list** | parts: `list-row` · vertical list with optional icons/actions |
| **divider** | modifier: `divider-neutral/primary/secondary/accent/info/success/warning/error` · direction: `divider-vertical/horizontal` · placement: `divider-start/end` |
| **drawer** | parts: `drawer-toggle/drawer-content/drawer-side/drawer-overlay` · placement: `drawer-end` · modifier: `drawer-open` · variant: `is-drawer-open:/is-drawer-close:` |

## Known Issues
- v4 → v5 migration: all `form-control`, `label-text`, `input-bordered` classes must be replaced
- `bordered` variant removed from inputs — inputs are bordered by default in v5
