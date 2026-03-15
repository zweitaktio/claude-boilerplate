---
version: 1.0.0
vendor: VendorBaseUiReact
source_template: vendor/base-ui-react.md
applies: "@base-ui/react"
tags: [base-ui, select, dialog, z-index, stacking-context]
---

# Base UI Select inside Dialog — z-index on Positioner, not Popup

Pitfall: When rendering a Base UI Select inside a Base UI Dialog, the Select dropdown renders behind the Dialog overlay. Adding z-index to the Select Popup has no effect.

## Symptom

Select dropdown is invisible or appears behind the Dialog backdrop when opened. No errors — it renders but is visually hidden.

## Root Cause

Base UI's `Select.Positioner` creates the stacking context at the document level (via `position: fixed` or portal). The `Select.Popup` is a child inside that stacking context. Setting `z-index` on the Popup only affects stacking within the Positioner — it has no effect on document-level stacking against the Dialog overlay (typically `z-50`).

## Fix

Set z-index on the `Select.Positioner`, not the `Select.Popup`:

```tsx
<Select.Positioner sideOffset={4} className="z-[100]">
  <Select.Popup className="bg-base-100 rounded-box p-2 shadow-lg">
    {/* items */}
  </Select.Popup>
</Select.Positioner>
```

## Prevention

Any floating Base UI component (Select, Menu, Popover, Combobox) rendered inside a Dialog needs z-index on the **Positioner**, not the Popup. The Positioner is what participates in document-level stacking.
