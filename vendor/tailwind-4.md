---
version: 1.2.3
applies: tailwindcss@4
target: rules
domain: styling
paths: ["**/*.tsx", "**/*.css"]
priority: high
tags: [tailwind, css, styling, utilities, responsive, themes]
---

# Tailwind CSS v4

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Official docs | https://tailwindcss.com/docs | v4 docs |
| GitHub | https://github.com/tailwindlabs/tailwindcss | Source, issues, changelog |
| Context7 | `/tailwindlabs/tailwindcss` | Verify v4 content |

## Quick Reference

- Use `@tailwindcss/vite` plugin (not PostCSS)
- Use `@theme` for custom design tokens
- Use `@plugin` for plugins (not `plugins: []` in config)
- No `tailwind.config.js` — configuration in CSS via `@theme` blocks
## Conditional Classes with cn()

Use a `cn()` helper (clsx + tailwind-merge) for conditional and merged classes. **Never use template literal concatenation.**

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

```tsx
// ✅ Conditional classes
<div className={cn('px-4', isActive && 'bg-blue-500', disabled && 'opacity-50')} />

// ✅ Merging with props (allows overrides without conflicts)
<Button className={cn('my-class', props.className)} />

// ✅ Object syntax for variants
cn('btn', { 'btn-primary': variant === 'primary' })

// ✅ Static string — no cn() needed
<div className="flex items-center gap-4" />

// ❌ Template literals — breaks with conditionals, whitespace bugs
<div className={`px-4 ${isActive ? 'bg-blue-500' : ''}`} />
<Button className={`my-class ${props.className}`} />
```

Key points:
- `cn()` resolves Tailwind class conflicts (e.g. `p-4` + `p-2` → `p-2`)
- Handles `undefined` gracefully (no "undefined" string in class)
- Only use `cn()` when classes are conditional or merged — static strings don't need it

## Component Variants with CVA

Use `class-variance-authority` for typed component variant patterns:

```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva('btn', {
  variants: {
    variant: {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      outline: 'btn-outline',
    },
    size: {
      xs: 'btn-xs',
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = ({ variant, size, className, ...props }: ButtonProps) => {
  return <button className={twMerge(buttonVariants({ variant, size }), className)} {...props} />
}
```

Key rules:
- Always use `twMerge` to allow className overrides without conflicts
- Export `VariantProps<typeof xVariants>` for type-safe variant props
- Put `defaultVariants` in CVA config, not in component defaults
- Combine with DaisyUI classes as the base (e.g. `cva('btn', { ... })`)

## Known Issues

### Typography plugin: `not-prose` is a one-way escape

`not-prose` cannot be re-entered. Nesting `prose` inside a `not-prose` ancestor has no effect — the Typography plugin strips styles permanently.

```tsx
// ❌ Broken — prose inside not-prose is ignored
<div className="prose">
  <div className="not-prose">
    <div className="prose">  {/* Has NO effect */}
      <h2>Unstyled heading</h2>
    </div>
  </div>
</div>

// ✅ Fix — make each rich text block self-contained
// Remove prose from outer wrapper, remove not-prose from container blocks,
// apply prose directly on each RichText component's own wrapper div
<div>
  <div>
    <div className="prose max-w-none">
      <h2>Styled heading</h2>
    </div>
  </div>
</div>
```

This affects any layout with container blocks (sections, columns, cards) that need to opt out of prose for structural elements but re-enable it for rich text content inside.
