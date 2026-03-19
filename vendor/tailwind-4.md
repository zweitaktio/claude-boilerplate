---
version: 1.2.0
applies: tailwindcss@4
target: graph
domain: styling
priority: high
tags: [tailwind, css, styling, utilities, responsive, themes]
---

# Tailwind CSS v4

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Official docs | https://tailwindcss.com/docs | v4 docs (check version selector) |
| v4 beta docs | https://v4.tailwindcss.com | During beta period |
| Context7 | `/tailwindlabs/tailwindcss` | Verify v4 content |
| GitHub | https://github.com/tailwindlabs/tailwindcss | Source, issues, changelog |

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
