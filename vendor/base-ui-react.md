---
version: 1.0.0
applies: "@base-ui/react@1"
target: graph
priority: high
tags: [base-ui, headless, components, a11y, dialog, popover, menu, select, combobox, tabs]
---

# Base UI React (@base-ui/react v1)

Headless React components — behavior, state, keyboard navigation, and ARIA out of the box. You provide all styling.

## Documentation

| Source | URL | Notes |
|--------|-----|-------|
| Official docs | https://base-ui.com/react | Component API reference |
| npm | `@base-ui/react` | v1.x — single tree-shakeable package |
| GitHub | https://github.com/mui/base-ui | Source, issues |

## Core Patterns

**Import:** per-component deep imports (tree-shakes unused components):
```tsx
import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
```

**Compound components:** all components use `Root > subcomponents` pattern.

**Floating components** (Dialog, Popover, Menu, Select, Tooltip, Combobox) share this structure:
```
Root > Trigger + Portal > [Backdrop] + Positioner > Popup > content
```

**Styling:** `className` prop on every subcomponent — string or state callback:
```tsx
// Static
<Menu.Item className="px-3 py-2 rounded-btn" />

// State-dependent
<Switch.Thumb className={(state) => state.checked ? 'translate-x-5' : 'translate-x-0'} />
```

**Data attributes** for CSS state selectors — works with Tailwind's `data-[]` modifier:
```tsx
<Dialog.Backdrop className="opacity-0 data-[open]:opacity-100 transition" />
<Menu.Item className="data-[highlighted]:bg-base-200" />
<Accordion.Trigger className="data-[panel-open]:font-bold" />
```

Key attributes: `data-open`, `data-closed`, `data-checked`, `data-unchecked`, `data-highlighted`, `data-selected`, `data-disabled`, `data-panel-open`, `data-starting-style`, `data-ending-style`.

## DaisyUI Integration

DaisyUI classes assume specific HTML structures. Base UI renders its own compound component tree. Compatibility varies:

| Component | DaisyUI structural classes | Styling approach |
|-----------|---------------------------|------------------|
| Dialog | `modal-box` won't work (expects `<dialog>`) | Tailwind + theme tokens (`bg-base-100 rounded-box shadow-xl`) |
| Menu | `menu` class works on Popup | DaisyUI `menu` + Tailwind for items |
| Popover | No DaisyUI equivalent | Tailwind + theme tokens |
| Select | `select` is for native `<select>` only | Tailwind + theme tokens |
| Tabs | `tab` works on Tab triggers | DaisyUI `tabs`/`tab` on List/Tab subcomponents |
| Tooltip | No DaisyUI equivalent | Tailwind + theme tokens |
| Accordion | `collapse` expects `<details>` | Tailwind + theme tokens |

**Rule of thumb:** use DaisyUI's semantic color tokens (`bg-base-100`, `bg-base-200`, `text-base-content`, `rounded-box`, `shadow-lg`) and action classes (`btn`, `btn-primary`) on Base UI subcomponents. Avoid DaisyUI's structural container classes (`modal`, `dropdown`, `collapse`).

## Component Cheatsheet

### Dialog

```tsx
import { Dialog } from '@base-ui/react/dialog'

<Dialog.Root>
  <Dialog.Trigger className="btn btn-primary">Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 bg-black/30 transition data-[starting-style]:opacity-0" />
    <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-100 rounded-box p-6 shadow-xl max-w-md w-full">
      <Dialog.Title className="text-lg font-bold">Title</Dialog.Title>
      <Dialog.Description className="py-4">Content</Dialog.Description>
      <div className="flex justify-end gap-2">
        <Dialog.Close className="btn">Cancel</Dialog.Close>
        <Dialog.Close className="btn btn-primary">Confirm</Dialog.Close>
      </div>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

### Menu

```tsx
import { Menu } from '@base-ui/react/menu'

<Menu.Root>
  <Menu.Trigger className="btn">Options</Menu.Trigger>
  <Menu.Portal>
    <Menu.Positioner sideOffset={4}>
      <Menu.Popup className="menu bg-base-100 rounded-box w-52 p-2 shadow-lg">
        <Menu.Item className="rounded-btn px-3 py-2 data-[highlighted]:bg-base-200">Edit</Menu.Item>
        <Menu.Separator className="divider my-1" />
        <Menu.Item className="rounded-btn px-3 py-2 data-[highlighted]:bg-base-200">Delete</Menu.Item>
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
```

### Select

```tsx
import { Select } from '@base-ui/react/select'

<Select.Root>
  <Select.Trigger className="btn btn-outline justify-between min-w-48">
    <Select.Value placeholder="Pick one" />
    <Select.Icon>▼</Select.Icon>
  </Select.Trigger>
  <Select.Portal>
    <Select.Positioner sideOffset={4}>
      <Select.Popup className="bg-base-100 rounded-box p-2 shadow-lg">
        <Select.List>
          {items.map((item) => (
            <Select.Item key={item.value} value={item.value}
              className="rounded-btn px-3 py-2 data-[highlighted]:bg-base-200">
              <Select.ItemIndicator>✓</Select.ItemIndicator>
              <Select.ItemText>{item.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.List>
      </Select.Popup>
    </Select.Positioner>
  </Select.Portal>
</Select.Root>
```

### Combobox

```tsx
import { Combobox } from '@base-ui/react/combobox'

<Combobox.Root items={items}>
  <div className="flex gap-1">
    <Combobox.Input className="input" placeholder="Search..." />
    <Combobox.Trigger className="btn btn-square btn-ghost">▼</Combobox.Trigger>
  </div>
  <Combobox.Portal>
    <Combobox.Positioner sideOffset={4}>
      <Combobox.Popup className="bg-base-100 rounded-box p-2 shadow-lg max-h-60 overflow-auto">
        <Combobox.Empty className="px-3 py-2 text-base-content/50">No results</Combobox.Empty>
        <Combobox.List>
          {(item) => (
            <Combobox.Item key={item.value} value={item}
              className="rounded-btn px-3 py-2 data-[highlighted]:bg-base-200">
              {item.label}
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Positioner>
  </Combobox.Portal>
</Combobox.Root>
```

### Popover

```tsx
import { Popover } from '@base-ui/react/popover'

<Popover.Root>
  <Popover.Trigger className="btn btn-ghost btn-sm">Info</Popover.Trigger>
  <Popover.Portal>
    <Popover.Positioner sideOffset={8}>
      <Popover.Popup className="bg-base-100 rounded-box p-4 shadow-lg max-w-xs">
        <Popover.Arrow className="fill-base-100" />
        <Popover.Title className="font-bold mb-2">Details</Popover.Title>
        <Popover.Description>Popover content here.</Popover.Description>
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>
```

### Tabs

```tsx
import { Tabs } from '@base-ui/react/tabs'

<Tabs.Root defaultValue="tab1">
  <Tabs.List className="tabs tabs-border">
    <Tabs.Tab value="tab1" className="tab data-[selected]:tab-active">Tab 1</Tabs.Tab>
    <Tabs.Tab value="tab2" className="tab data-[selected]:tab-active">Tab 2</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="tab1" className="p-4">Content 1</Tabs.Panel>
  <Tabs.Panel value="tab2" className="p-4">Content 2</Tabs.Panel>
</Tabs.Root>
```

### Accordion

```tsx
import { Accordion } from '@base-ui/react/accordion'

<Accordion.Root>
  <Accordion.Item>
    <Accordion.Header>
      <Accordion.Trigger className="flex w-full justify-between p-4 font-medium bg-base-200 rounded-box">
        Question
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Panel className="p-4">Answer content</Accordion.Panel>
  </Accordion.Item>
</Accordion.Root>
```

Props: `multiple` (allow multiple open), `defaultValue` / `value` + `onValueChange` (controlled).

### Tooltip

```tsx
import { Tooltip } from '@base-ui/react/tooltip'

<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger className="btn btn-ghost btn-sm">Hover me</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner sideOffset={8}>
        <Tooltip.Popup className="bg-neutral text-neutral-content rounded-box px-3 py-1.5 text-sm shadow-lg">
          <Tooltip.Arrow className="fill-neutral" />
          Tooltip text
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
```

Wrap app or section in `<Tooltip.Provider>` once for shared delay timing.

### Switch

```tsx
import { Switch } from '@base-ui/react/switch'

<label className="label cursor-pointer justify-start gap-3">
  <Switch.Root defaultChecked
    className="relative inline-flex h-6 w-11 rounded-full bg-base-300 data-[checked]:bg-primary transition">
    <Switch.Thumb className="size-5 translate-x-0.5 rounded-full bg-base-100 shadow transition data-[checked]:translate-x-5" />
  </Switch.Root>
  <span>Notifications</span>
</label>
```

### Checkbox

```tsx
import { Checkbox } from '@base-ui/react/checkbox'

<label className="label cursor-pointer justify-start gap-3">
  <Checkbox.Root className="size-5 rounded border border-base-300 bg-base-100 data-[checked]:bg-primary data-[checked]:border-primary flex items-center justify-center">
    <Checkbox.Indicator className="text-primary-content text-sm">✓</Checkbox.Indicator>
  </Checkbox.Root>
  <span>Accept terms</span>
</label>
```

Props: `indeterminate` for mixed state (parent checkbox in hierarchical selections).

## CVA Wrapper Pattern

All project wrappers use CVA + twMerge for typed variants. See `VendorTailwind4` for the full CVA pattern.

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'
import { Dialog } from '@base-ui/react/dialog'

const dialogVariants = cva(
  'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-100 rounded-box shadow-xl',
  {
    variants: {
      size: { sm: 'max-w-sm p-4', md: 'max-w-md p-6', lg: 'max-w-lg p-8' },
    },
    defaultVariants: { size: 'md' },
  },
)

interface ModalProps extends VariantProps<typeof dialogVariants> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
}

export const Modal = ({ size, title, children, className, ...props }: ModalProps) => (
  <Dialog.Root {...props}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 bg-black/30" />
      <Dialog.Popup className={twMerge(dialogVariants({ size }), className)}>
        <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
)
```
