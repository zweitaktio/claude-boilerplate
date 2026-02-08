---
version: 1.1.0
applies: tailwindcss@4
target: graph
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
